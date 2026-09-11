package kafkamanager

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/twmb/franz-go/pkg/kadm"
)

var validTopicNameRegex = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

// ValidateTopicName checks if the topic name satisfies Kafka naming rules
func ValidateTopicName(name string) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return fmt.Errorf("topic name cannot be empty")
	}
	if len(trimmed) > 249 {
		return fmt.Errorf("topic name exceeds maximum length of 249 characters")
	}
	if trimmed == "." || trimmed == ".." {
		return fmt.Errorf("topic name cannot be '.' or '..'")
	}
	if !validTopicNameRegex.MatchString(trimmed) {
		return fmt.Errorf("topic name contains invalid characters; only letters, digits, '.', '_', and '-' are allowed")
	}
	return nil
}

// ListTopics returns a list of all topics in the cluster with metrics and health status
func (m *KafkaManager) ListTopics(ctx context.Context, includeInternal bool) ([]TopicSummary, error) {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return nil, fmt.Errorf("not connected to a Kafka cluster")
	}

	meta, err := admin.Metadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch cluster metadata: %w", err)
	}

	var topicNames []string
	filteredTopics := make(map[string]kadm.TopicDetail)

	for name, detail := range meta.Topics {
		isInternal := detail.IsInternal || strings.HasPrefix(name, "_")
		if !includeInternal && isInternal {
			continue
		}
		topicNames = append(topicNames, name)
		filteredTopics[name] = detail
	}

	sort.Strings(topicNames)

	var startOffsets kadm.ListedOffsets
	var endOffsets kadm.ListedOffsets
	configsMap := make(map[string]kadm.ResourceConfig)

	if len(topicNames) > 0 {
		// Best effort fetching of start and end offsets to compute message counts
		if so, err := admin.ListStartOffsets(ctx, topicNames...); err == nil {
			startOffsets = so
		}
		if eo, err := admin.ListEndOffsets(ctx, topicNames...); err == nil {
			endOffsets = eo
		}
		if resConfigs, err := admin.DescribeTopicConfigs(ctx, topicNames...); err == nil {
			for _, rc := range resConfigs {
				configsMap[rc.Name] = rc
			}
		}
	}

	summaries := make([]TopicSummary, 0, len(topicNames))

	for _, name := range topicNames {
		detail := filteredTopics[name]
		isInternal := detail.IsInternal || strings.HasPrefix(name, "_")
		numPartitions := len(detail.Partitions)
		replicationFactor := 0
		underReplicatedCount := 0
		totalMessages := int64(0)

		if numPartitions > 0 {
			firstPart := detail.Partitions[0]
			replicationFactor = len(firstPart.Replicas)

			for _, part := range detail.Partitions {
				if len(part.ISR) < len(part.Replicas) {
					underReplicatedCount++
				}

				if startOffsets != nil && endOffsets != nil {
					st, okStart := startOffsets.Lookup(name, part.Partition)
					en, okEnd := endOffsets.Lookup(name, part.Partition)
					if okStart && okEnd && en.Offset >= st.Offset {
						totalMessages += (en.Offset - st.Offset)
					}
				}
			}
		}

		cleanupPolicy := "delete"
		retentionMs := ""
		retentionBytes := ""

		if rc, ok := configsMap[name]; ok && rc.Err == nil {
			for _, c := range rc.Configs {
				switch c.Key {
				case "cleanup.policy":
					if val := c.MaybeValue(); val != "" {
						cleanupPolicy = val
					}
				case "retention.ms":
					retentionMs = c.MaybeValue()
				case "retention.bytes":
					retentionBytes = c.MaybeValue()
				}
			}
		}

		summaries = append(summaries, TopicSummary{
			Name:                 name,
			IsInternal:           isInternal,
			PartitionsCount:      numPartitions,
			ReplicationFactor:    replicationFactor,
			CleanupPolicy:        cleanupPolicy,
			RetentionMs:          retentionMs,
			RetentionBytes:       retentionBytes,
			UnderReplicatedCount: underReplicatedCount,
			TotalMessages:        totalMessages,
		})
	}

	return summaries, nil
}

// GetTopicDetails returns deep partition health and configuration details for a specific topic
func (m *KafkaManager) GetTopicDetails(ctx context.Context, topic string) (*TopicDetailInfo, error) {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return nil, fmt.Errorf("not connected to a Kafka cluster")
	}

	meta, err := admin.Metadata(ctx, topic)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metadata for topic %s: %w", topic, err)
	}

	detail, ok := meta.Topics[topic]
	if !ok || detail.Err != nil {
		if detail.Err != nil {
			return nil, fmt.Errorf("failed to load topic details: %w", detail.Err)
		}
		return nil, fmt.Errorf("topic %q not found in cluster", topic)
	}

	isInternal := detail.IsInternal || strings.HasPrefix(topic, "_")
	numPartitions := len(detail.Partitions)
	replicationFactor := 0
	underReplicatedCount := 0
	totalMessages := int64(0)

	startOffsets, _ := admin.ListStartOffsets(ctx, topic)
	endOffsets, _ := admin.ListEndOffsets(ctx, topic)

	partitions := make([]PartitionInfo, 0, numPartitions)
	for _, part := range detail.Partitions {
		isUnder := len(part.ISR) < len(part.Replicas)
		if isUnder {
			underReplicatedCount++
		}

		if len(part.Replicas) > replicationFactor {
			replicationFactor = len(part.Replicas)
		}

		isPreferred := len(part.Replicas) > 0 && part.Leader == part.Replicas[0]

		startOffset := int64(0)
		endOffset := int64(0)
		msgCount := int64(0)

		if startOffsets != nil {
			if st, ok := startOffsets.Lookup(topic, part.Partition); ok {
				startOffset = st.Offset
			}
		}
		if endOffsets != nil {
			if en, ok := endOffsets.Lookup(topic, part.Partition); ok {
				endOffset = en.Offset
			}
		}
		if endOffset >= startOffset {
			msgCount = endOffset - startOffset
			totalMessages += msgCount
		}

		replicasCopy := append([]int32{}, part.Replicas...)
		isrCopy := append([]int32{}, part.ISR...)
		offlineCopy := append([]int32{}, part.OfflineReplicas...)

		partitions = append(partitions, PartitionInfo{
			Partition:         part.Partition,
			Leader:            part.Leader,
			LeaderEpoch:       part.LeaderEpoch,
			Replicas:          replicasCopy,
			ISR:               isrCopy,
			OfflineReplicas:   offlineCopy,
			IsUnderReplicated: isUnder,
			IsPreferredLeader: isPreferred,
			StartOffset:       startOffset,
			EndOffset:         endOffset,
			MessageCount:      msgCount,
		})
	}

	sort.Slice(partitions, func(i, j int) bool {
		return partitions[i].Partition < partitions[j].Partition
	})

	// Fetch dynamic & default configurations
	var configs []BrokerConfigEntry
	resConfigs, err := admin.DescribeTopicConfigs(ctx, topic)
	if err == nil {
		for _, rc := range resConfigs {
			if rc.Name == topic && rc.Err == nil {
				for _, c := range rc.Configs {
					configs = append(configs, BrokerConfigEntry{
						Name:        c.Key,
						Value:       c.MaybeValue(),
						Source:      c.Source.String(),
						IsSensitive: c.Sensitive,
						IsReadOnly:  c.Source.String() == "STATIC_BROKER_CONFIG",
					})
				}
			}
		}
	}

	sort.Slice(configs, func(i, j int) bool {
		return configs[i].Name < configs[j].Name
	})

	return &TopicDetailInfo{
		Name:                 topic,
		IsInternal:           isInternal,
		PartitionsCount:      numPartitions,
		ReplicationFactor:    replicationFactor,
		TotalMessages:        totalMessages,
		UnderReplicatedCount: underReplicatedCount,
		Partitions:           partitions,
		Configs:              configs,
	}, nil
}

// CreateTopic creates a new topic with the specified partitions, replication factor, and configuration
func (m *KafkaManager) CreateTopic(ctx context.Context, params CreateTopicParams) error {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return fmt.Errorf("not connected to a Kafka cluster")
	}

	topicName := strings.TrimSpace(params.Topic)
	if err := ValidateTopicName(topicName); err != nil {
		return err
	}

	partitions := params.Partitions
	if partitions <= 0 {
		partitions = 1
	}

	replicationFactor := params.ReplicationFactor
	if replicationFactor <= 0 {
		replicationFactor = 1
	}

	configs := make(map[string]*string)
	if params.CleanupPolicy != "" {
		policy := params.CleanupPolicy
		configs["cleanup.policy"] = &policy
	}
	if params.RetentionMs > 0 {
		ret := fmt.Sprintf("%d", params.RetentionMs)
		configs["retention.ms"] = &ret
	}
	if params.RetentionBytes > 0 {
		retB := fmt.Sprintf("%d", params.RetentionBytes)
		configs["retention.bytes"] = &retB
	}
	if params.MinInSyncReplicas > 0 {
		minISR := fmt.Sprintf("%d", params.MinInSyncReplicas)
		configs["min.insync.replicas"] = &minISR
	}
	for k, v := range params.CustomConfigs {
		val := v
		configs[k] = &val
	}

	resp, err := admin.CreateTopic(ctx, partitions, replicationFactor, configs, topicName)
	if err != nil {
		return fmt.Errorf("failed to create topic %s: %w", topicName, err)
	}
	if resp.Err != nil {
		return fmt.Errorf("topic creation rejected: %w", resp.Err)
	}

	return nil
}

// DeleteTopic removes a topic from the cluster
func (m *KafkaManager) DeleteTopic(ctx context.Context, topic string) error {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return fmt.Errorf("not connected to a Kafka cluster")
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	resp, err := admin.DeleteTopic(ctx, topic)
	if err != nil {
		return fmt.Errorf("failed to delete topic %s: %w", topic, err)
	}
	if resp.Err != nil {
		return fmt.Errorf("topic deletion error: %w", resp.Err)
	}

	return nil
}

// UpdateTopicPartitions expands the partition count for a topic (Kafka only supports increasing partitions)
func (m *KafkaManager) UpdateTopicPartitions(ctx context.Context, topic string, newTotal int) error {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return fmt.Errorf("not connected to a Kafka cluster")
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	resps, err := admin.UpdatePartitions(ctx, newTotal, topic)
	if err != nil {
		return fmt.Errorf("failed to expand partitions: %w", err)
	}

	for _, resp := range resps {
		if resp.Err != nil {
			return fmt.Errorf("failed to update partition count: %w", resp.Err)
		}
	}

	return nil
}

// UpdateTopicConfigs alters configuration properties on a topic
func (m *KafkaManager) UpdateTopicConfigs(ctx context.Context, topic string, configs map[string]string) error {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return fmt.Errorf("not connected to a Kafka cluster")
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	var alterConfigs []kadm.AlterConfig
	for k, v := range configs {
		trimmedKey := strings.TrimSpace(k)
		if trimmedKey == "" {
			continue
		}
		if v == "" {
			alterConfigs = append(alterConfigs, kadm.AlterConfig{
				Op:   kadm.DeleteConfig,
				Name: trimmedKey,
			})
		} else {
			val := v
			alterConfigs = append(alterConfigs, kadm.AlterConfig{
				Op:    kadm.SetConfig,
				Name:  trimmedKey,
				Value: &val,
			})
		}
	}

	if len(alterConfigs) == 0 {
		return nil
	}

	resps, err := admin.AlterTopicConfigs(ctx, alterConfigs, topic)
	if err != nil {
		return fmt.Errorf("failed to alter topic configurations: %w", err)
	}

	for _, r := range resps {
		if r.Err != nil {
			return fmt.Errorf("error updating config: %w", r.Err)
		}
	}

	return nil
}

// PurgeTopicMessages deletes records up to the latest offset (high watermark) across all partitions
func (m *KafkaManager) PurgeTopicMessages(ctx context.Context, topic string) error {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return fmt.Errorf("not connected to a Kafka cluster")
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	endOffsets, err := admin.ListEndOffsets(ctx, topic)
	if err != nil {
		return fmt.Errorf("failed to fetch topic partition offsets: %w", err)
	}

	offsets := kadm.Offsets{}
	for tName, partMap := range endOffsets {
		if tName != topic {
			continue
		}
		for pID, off := range partMap {
			if off.Err == nil && off.Offset > 0 {
				offsets.Add(kadm.Offset{
					Topic:     topic,
					Partition: pID,
					At:        off.Offset,
				})
			}
		}
	}

	if len(offsets) == 0 {
		return nil // Topic is already empty
	}

	resps, err := admin.DeleteRecords(ctx, offsets)
	if err != nil {
		return fmt.Errorf("failed to purge records: %w", err)
	}

	if err := resps.Error(); err != nil {
		return fmt.Errorf("failed to purge records: %w", err)
	}

	return nil
}

// PurgePartitionMessages deletes all records in a single partition up to its latest offset
func (m *KafkaManager) PurgePartitionMessages(ctx context.Context, topic string, partition int32) error {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return fmt.Errorf("not connected to a Kafka cluster")
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	endOffsets, err := admin.ListEndOffsets(ctx, topic)
	if err != nil {
		return fmt.Errorf("failed to fetch end offsets: %w", err)
	}

	partOffsets, ok := endOffsets[topic]
	if !ok {
		return fmt.Errorf("topic %s not found", topic)
	}

	off, ok := partOffsets[partition]
	if !ok {
		return fmt.Errorf("partition %d not found in topic %s", partition, topic)
	}

	if off.Err != nil {
		return fmt.Errorf("error reading partition offset: %w", off.Err)
	}

	if off.Offset <= 0 {
		return nil
	}

	offsets := kadm.Offsets{}
	offsets.Add(kadm.Offset{
		Topic:     topic,
		Partition: partition,
		At:        off.Offset,
	})

	resps, err := admin.DeleteRecords(ctx, offsets)
	if err != nil {
		return fmt.Errorf("failed to purge partition records: %w", err)
	}

	if err := resps.Error(); err != nil {
		return fmt.Errorf("failed to purge partition records: %w", err)
	}

	return nil
}

// DeleteRecordsUpTo deletes records in a partition up to the specified offset (exclusive)
func (m *KafkaManager) DeleteRecordsUpTo(ctx context.Context, topic string, partition int32, offset int64) error {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return fmt.Errorf("not connected to a Kafka cluster")
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		return fmt.Errorf("topic name cannot be empty")
	}

	if offset <= 0 {
		return nil
	}

	offsets := kadm.Offsets{}
	offsets.Add(kadm.Offset{
		Topic:     topic,
		Partition: partition,
		At:        offset,
	})

	resps, err := admin.DeleteRecords(ctx, offsets)
	if err != nil {
		return fmt.Errorf("failed to delete records: %w", err)
	}

	if err := resps.Error(); err != nil {
		return fmt.Errorf("failed to delete records: %w", err)
	}

	return nil
}

