package kafkamanager

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/twmb/franz-go/pkg/kadm"
)

// ListConsumerGroups returns high-level status, member counts, and lag for all consumer groups in the cluster
func (m *KafkaManager) ListConsumerGroups(ctx context.Context) ([]ConsumerGroupSummary, error) {
	admin, err := m.getAdminClient()
	if err != nil {
		return nil, err
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	listedGroups, err := admin.ListGroups(timeoutCtx)
	if err != nil {
		return nil, fmt.Errorf("failed to list consumer groups: %w", err)
	}

	if len(listedGroups) == 0 {
		return []ConsumerGroupSummary{}, nil
	}

	groupNames := make([]string, 0, len(listedGroups))
	for name := range listedGroups {
		groupNames = append(groupNames, name)
	}

	// Fetch lag and described details for all groups
	lags, _ := admin.Lag(timeoutCtx, groupNames...)

	results := make([]ConsumerGroupSummary, 0, len(listedGroups))
	for _, lg := range listedGroups {
		summary := ConsumerGroupSummary{
			Group:        lg.Group,
			State:        lg.State,
			ProtocolType: lg.ProtocolType,
			Coordinator:  lg.Coordinator,
		}

		if dLag, ok := lags[lg.Group]; ok && dLag.DescribeErr == nil {
			summary.MembersCount = len(dLag.Members)
			summary.Protocol = dLag.Protocol
			summary.TotalLag = dLag.Lag.Total()
			summary.TopicsCount = len(dLag.Lag)
			if dLag.State != "" {
				summary.State = dLag.State
			}
			if dLag.Coordinator.NodeID != 0 {
				summary.Coordinator = dLag.Coordinator.NodeID
			}
		}

		if summary.State == "" {
			summary.State = "Unknown"
		}

		results = append(results, summary)
	}

	// Sort alphabetically by group name
	sort.Slice(results, func(i, j int) bool {
		return strings.ToLower(results[i].Group) < strings.ToLower(results[j].Group)
	})

	return results, nil
}

// GetConsumerGroupDetails returns deep inspection of members, partition assignments, and lag metrics
func (m *KafkaManager) GetConsumerGroupDetails(ctx context.Context, group string) (*ConsumerGroupDetailInfo, error) {
	if strings.TrimSpace(group) == "" {
		return nil, errors.New("group name cannot be empty")
	}

	admin, err := m.getAdminClient()
	if err != nil {
		return nil, err
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	lags, err := admin.Lag(timeoutCtx, group)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch lag for group %s: %w", group, err)
	}

	dLag, ok := lags[group]
	if !ok {
		return nil, fmt.Errorf("group %s not found in lag response", group)
	}
	if dLag.DescribeErr != nil {
		return nil, fmt.Errorf("failed to describe group %s: %w", group, dLag.DescribeErr)
	}

	details := &ConsumerGroupDetailInfo{
		Group:        dLag.Group,
		State:        dLag.State,
		ProtocolType: dLag.ProtocolType,
		Protocol:     dLag.Protocol,
		Coordinator:  dLag.Coordinator.NodeID,
		TotalLag:     dLag.Lag.Total(),
		Members:      make([]ConsumerGroupMemberInfo, 0, len(dLag.Members)),
		Partitions:   make([]ConsumerGroupPartitionLag, 0),
	}

	// Process Members and their assigned topic-partitions
	for _, mbr := range dLag.Members {
		assignedMap := make(map[string][]int32)
		if cAssign, ok := mbr.Assigned.AsConsumer(); ok && cAssign != nil {
			for _, t := range cAssign.Topics {
				parts := make([]int32, len(t.Partitions))
				copy(parts, t.Partitions)
				sort.Slice(parts, func(i, j int) bool { return parts[i] < parts[j] })
				assignedMap[t.Topic] = parts
			}
		}

		details.Members = append(details.Members, ConsumerGroupMemberInfo{
			MemberID:           mbr.MemberID,
			ClientID:           mbr.ClientID,
			ClientHost:         mbr.ClientHost,
			AssignedPartitions: assignedMap,
		})
	}

	// Process Partition Lag entries
	sortedLags := dLag.Lag.Sorted()
	for _, l := range sortedLags {
		partLag := ConsumerGroupPartitionLag{
			Topic:         l.Topic,
			Partition:     l.Partition,
			CurrentOffset: l.Commit.At,
			EndOffset:     l.End.Offset,
			Lag:           l.Lag,
		}

		if l.Member != nil {
			partLag.MemberID = l.Member.MemberID
			partLag.ClientID = l.Member.ClientID
			partLag.ClientHost = l.Member.ClientHost
		}

		details.Partitions = append(details.Partitions, partLag)
	}

	// Sort partitions by topic name then partition number
	sort.Slice(details.Partitions, func(i, j int) bool {
		if details.Partitions[i].Topic != details.Partitions[j].Topic {
			return details.Partitions[i].Topic < details.Partitions[j].Topic
		}
		return details.Partitions[i].Partition < details.Partitions[j].Partition
	})

	return details, nil
}

// ResetConsumerGroupOffsets commits new offsets for target topic partitions in a consumer group
func (m *KafkaManager) ResetConsumerGroupOffsets(ctx context.Context, params ResetOffsetsParams) error {
	group := strings.TrimSpace(params.Group)
	if group == "" {
		return errors.New("consumer group name is required")
	}

	strategy := strings.ToLower(strings.TrimSpace(params.Strategy))
	if strategy != "earliest" && strategy != "latest" && strategy != "timestamp" && strategy != "offset" {
		return fmt.Errorf("invalid strategy '%s', must be 'earliest', 'latest', 'timestamp', or 'offset'", strategy)
	}

	if strategy == "timestamp" && params.Timestamp <= 0 {
		return errors.New("timestamp must be greater than 0 for 'timestamp' strategy")
	}
	if strategy == "offset" && params.Offset < 0 {
		return errors.New("offset must be non-negative for 'offset' strategy")
	}

	admin, err := m.getAdminClient()
	if err != nil {
		return err
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	// 1. Identify target topic-partitions
	targetTopicParts := make(map[string][]int32)

	if params.Topic != "" {
		// Specific topic requested
		topic := strings.TrimSpace(params.Topic)
		if len(params.Partitions) > 0 {
			targetTopicParts[topic] = params.Partitions
		} else {
			// Find all partitions for this topic
			topicsMeta, err := admin.ListTopics(timeoutCtx, topic)
			if err != nil {
				return fmt.Errorf("failed to fetch topic metadata for %s: %w", topic, err)
			}
			top, ok := topicsMeta[topic]
			if !ok {
				return fmt.Errorf("topic %s does not exist", topic)
			}
			parts := make([]int32, 0, len(top.Partitions))
			for p := range top.Partitions {
				parts = append(parts, p)
			}
			targetTopicParts[topic] = parts
		}
	} else {
		// All topics currently committed by the consumer group
		fetchedOffsets, err := admin.FetchOffsets(timeoutCtx, group)
		if err != nil {
			return fmt.Errorf("failed to fetch current offsets for group %s: %w", group, err)
		}
		if len(fetchedOffsets.Offsets()) == 0 {
			return fmt.Errorf("group %s has no committed topics/partitions to reset; please specify a topic", group)
		}
		for top, partMap := range fetchedOffsets.Offsets() {
			parts := make([]int32, 0, len(partMap))
			for p := range partMap {
				parts = append(parts, p)
			}
			targetTopicParts[top] = parts
		}
	}

	// 2. Resolve new offsets according to strategy
	toCommit := make(kadm.Offsets)
	topicsList := make([]string, 0, len(targetTopicParts))
	for t := range targetTopicParts {
		topicsList = append(topicsList, t)
	}

	switch strategy {
	case "earliest":
		startOffsets, err := admin.ListStartOffsets(timeoutCtx, topicsList...)
		if err != nil {
			return fmt.Errorf("failed to list start offsets: %w", err)
		}
		for t, parts := range targetTopicParts {
			for _, p := range parts {
				if lo, ok := startOffsets.Lookup(t, p); ok && lo.Err == nil {
					toCommit.AddOffset(t, p, lo.Offset, -1)
				}
			}
		}

	case "latest":
		endOffsets, err := admin.ListEndOffsets(timeoutCtx, topicsList...)
		if err != nil {
			return fmt.Errorf("failed to list end offsets: %w", err)
		}
		for t, parts := range targetTopicParts {
			for _, p := range parts {
				if lo, ok := endOffsets.Lookup(t, p); ok && lo.Err == nil {
					toCommit.AddOffset(t, p, lo.Offset, -1)
				}
			}
		}

	case "timestamp":
		timeOffsets, err := admin.ListOffsetsAfterMilli(timeoutCtx, params.Timestamp, topicsList...)
		if err != nil {
			return fmt.Errorf("failed to list offsets after timestamp: %w", err)
		}
		// Also fetch latest offsets as fallback if time offset isn't found
		endOffsets, _ := admin.ListEndOffsets(timeoutCtx, topicsList...)

		for t, parts := range targetTopicParts {
			for _, p := range parts {
				if lo, ok := timeOffsets.Lookup(t, p); ok && lo.Err == nil && lo.Offset >= 0 {
					toCommit.AddOffset(t, p, lo.Offset, -1)
				} else if lo, ok := endOffsets.Lookup(t, p); ok && lo.Err == nil {
					// Fallback to end offset if timestamp is past all records
					toCommit.AddOffset(t, p, lo.Offset, -1)
				}
			}
		}

	case "offset":
		for t, parts := range targetTopicParts {
			for _, p := range parts {
				toCommit.AddOffset(t, p, params.Offset, -1)
			}
		}
	}

	if len(toCommit) == 0 {
		return errors.New("no valid offsets could be determined for the target partitions")
	}

	// 3. Commit the new offsets to the group
	resp, err := admin.CommitOffsets(timeoutCtx, group, toCommit)
	if err != nil {
		return fmt.Errorf("failed to commit offsets: %w", err)
	}
	if respErr := resp.Error(); respErr != nil {
		return fmt.Errorf("error committing reset offsets: %w", respErr)
	}

	return nil
}

// DeleteConsumerGroup deletes a dead or empty consumer group
func (m *KafkaManager) DeleteConsumerGroup(ctx context.Context, group string) error {
	group = strings.TrimSpace(group)
	if group == "" {
		return errors.New("consumer group name is required")
	}

	admin, err := m.getAdminClient()
	if err != nil {
		return err
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	resp, err := admin.DeleteGroup(timeoutCtx, group)
	if err != nil {
		return fmt.Errorf("failed to delete group %s: %w", group, err)
	}
	if resp.Err != nil {
		return fmt.Errorf("failed to delete group %s: %w", group, resp.Err)
	}

	return nil
}
