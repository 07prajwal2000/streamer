package kafkamanager

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// GetKafkaMessages queries records from a topic according to the specified strategy and limit
func (m *KafkaManager) GetKafkaMessages(ctx context.Context, params GetKafkaMessagesParams) ([]KafkaRecord, error) {
	topic := strings.TrimSpace(params.Topic)
	if topic == "" {
		return nil, errors.New("topic name is required")
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 50
	} else if limit > 1000 {
		limit = 1000
	}

	strategy := strings.ToLower(strings.TrimSpace(params.Strategy))
	if strategy == "" {
		strategy = "latest"
	}
	if strategy != "latest" && strategy != "earliest" && strategy != "timestamp" && strategy != "offset" {
		return nil, fmt.Errorf("invalid strategy '%s', must be 'latest', 'earliest', 'timestamp', or 'offset'", strategy)
	}

	admin, err := m.getAdminClient()
	if err != nil {
		return nil, err
	}

	watermarkCtx, cancelWatermarks := context.WithTimeout(ctx, 10*time.Second)
	defer cancelWatermarks()

	// 1. Resolve target partitions
	targetPartitions := params.Partitions
	if len(targetPartitions) == 0 {
		topMeta, err := admin.ListTopics(watermarkCtx, topic)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch topic metadata: %w", err)
		}
		t, ok := topMeta[topic]
		if !ok {
			return nil, fmt.Errorf("topic %s not found", topic)
		}
		targetPartitions = make([]int32, 0, len(t.Partitions))
		for p := range t.Partitions {
			targetPartitions = append(targetPartitions, p)
		}
		sort.Slice(targetPartitions, func(i, j int) bool { return targetPartitions[i] < targetPartitions[j] })
	}

	if len(targetPartitions) == 0 {
		return []KafkaRecord{}, nil
	}

	// 2. Fetch start and end offsets for target partitions
	startOffsets, err := admin.ListStartOffsets(watermarkCtx, topic)
	if err != nil {
		return nil, fmt.Errorf("failed to list start offsets: %w", err)
	}

	endOffsets, err := admin.ListEndOffsets(watermarkCtx, topic)
	if err != nil {
		return nil, fmt.Errorf("failed to list end offsets: %w", err)
	}

	// 3. Compute partition starting offsets
	consumedParts := make(map[string]map[int32]kgo.Offset)
	consumedParts[topic] = make(map[int32]kgo.Offset)

	limitPerPartition := int64((limit / len(targetPartitions)) + 1)
	if limitPerPartition < 5 {
		limitPerPartition = 5
	}

	for _, p := range targetPartitions {
		so, okStart := startOffsets.Lookup(topic, p)
		eo, okEnd := endOffsets.Lookup(topic, p)
		if !okStart || !okEnd || so.Err != nil || eo.Err != nil {
			continue
		}

		startOff := so.Offset
		endOff := eo.Offset
		if startOff >= endOff {
			// Partition is empty
			continue
		}

		switch strategy {
		case "latest":
			startAt := endOff - limitPerPartition
			if startAt < startOff {
				startAt = startOff
			}
			consumedParts[topic][p] = kgo.NewOffset().At(startAt)

		case "earliest":
			consumedParts[topic][p] = kgo.NewOffset().At(startOff)

		case "offset":
			startAt := params.Offset
			if startAt < startOff {
				startAt = startOff
			}
			if startAt >= endOff {
				startAt = endOff - 1
			}
			consumedParts[topic][p] = kgo.NewOffset().At(startAt)

		case "timestamp":
			timeOffsets, err := admin.ListOffsetsAfterMilli(watermarkCtx, params.Timestamp, topic)
			if err == nil {
				if to, ok := timeOffsets.Lookup(topic, p); ok && to.Err == nil && to.Offset >= 0 {
					consumedParts[topic][p] = kgo.NewOffset().At(to.Offset)
				}
			}
		}
	}

	if len(consumedParts[topic]) == 0 {
		return []KafkaRecord{}, nil
	}

	// 4. Create ephemeral consumer
	consumer, err := m.getConsumerClient(kgo.ConsumePartitions(consumedParts))
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer client: %w", err)
	}
	defer consumer.Close()

	// 5. Poll records with timeout
	pollCtx, cancelPoll := context.WithTimeout(ctx, 4*time.Second)
	defer cancelPoll()

	records := make([]KafkaRecord, 0, limit)
	for len(records) < limit {
		fetches := consumer.PollRecords(pollCtx, limit-len(records))
		if fetches.IsClientClosed() || pollCtx.Err() != nil {
			break
		}

		iter := fetches.RecordIter()
		empty := true
		for !iter.Done() {
			empty = false
			rec := iter.Next()

			kRec := KafkaRecord{
				Topic:     rec.Topic,
				Partition: rec.Partition,
				Offset:    rec.Offset,
				Timestamp: rec.Timestamp.UnixMilli(),
				Key:       string(rec.Key),
				Payload:   string(rec.Value),
			}

			if len(rec.Headers) > 0 {
				kRec.Headers = make(map[string]string)
				for _, h := range rec.Headers {
					kRec.Headers[h.Key] = string(h.Value)
				}
			}

			records = append(records, kRec)
			if len(records) >= limit {
				break
			}
		}

		if empty {
			break
		}
	}

	// Sort newest first
	sort.Slice(records, func(i, j int) bool {
		if records[i].Timestamp != records[j].Timestamp {
			return records[i].Timestamp > records[j].Timestamp
		}
		return records[i].Offset > records[j].Offset
	})

	return records, nil
}

// StartKafkaLiveTail begins real-time consumption of a topic and emits events to Wails
func (m *KafkaManager) StartKafkaLiveTail(topic string, partitions []int32) error {
	topic = strings.TrimSpace(topic)
	if topic == "" {
		return errors.New("topic name is required")
	}

	m.StopKafkaLiveTail()

	var consumerOpts []kgo.Opt
	if len(partitions) > 0 {
		consumedParts := make(map[string]map[int32]kgo.Offset)
		consumedParts[topic] = make(map[int32]kgo.Offset)
		for _, p := range partitions {
			consumedParts[topic][p] = kgo.NewOffset().AtEnd()
		}
		consumerOpts = append(consumerOpts, kgo.ConsumePartitions(consumedParts))
	} else {
		consumerOpts = append(consumerOpts,
			kgo.ConsumeTopics(topic),
			kgo.ConsumeResetOffset(kgo.NewOffset().AtEnd()),
		)
	}

	consumer, err := m.getConsumerClient(consumerOpts...)
	if err != nil {
		return fmt.Errorf("failed to initialize live tail consumer: %w", err)
	}

	tailCtx, cancel := context.WithCancel(context.Background())

	m.tailMu.Lock()
	m.tailCancel = cancel
	m.tailMu.Unlock()

	go m.liveTailLoop(tailCtx, consumer)

	return nil
}

func (m *KafkaManager) liveTailLoop(ctx context.Context, consumer *kgo.Client) {
	defer consumer.Close()

	for {
		if ctx.Err() != nil {
			return
		}

		fetches := consumer.PollFetches(ctx)
		if fetches.IsClientClosed() || ctx.Err() != nil {
			return
		}

		iter := fetches.RecordIter()
		for !iter.Done() {
			rec := iter.Next()

			kRec := KafkaRecord{
				Topic:     rec.Topic,
				Partition: rec.Partition,
				Offset:    rec.Offset,
				Timestamp: rec.Timestamp.UnixMilli(),
				Key:       string(rec.Key),
				Payload:   string(rec.Value),
			}

			if len(rec.Headers) > 0 {
				kRec.Headers = make(map[string]string)
				for _, h := range rec.Headers {
					kRec.Headers[h.Key] = string(h.Value)
				}
			}

			if m.ctx != nil {
				runtime.EventsEmit(m.ctx, "kafka:live-record", kRec)
			}
		}
	}
}

// StopKafkaLiveTail stops any active real-time message stream
func (m *KafkaManager) StopKafkaLiveTail() {
	m.tailMu.Lock()
	defer m.tailMu.Unlock()

	if m.tailCancel != nil {
		m.tailCancel()
		m.tailCancel = nil
	}
}

// ProduceKafkaRecord publishes a message record to a topic
func (m *KafkaManager) ProduceKafkaRecord(ctx context.Context, params ProduceKafkaRecordParams) (*ProduceRecordResult, error) {
	topic := strings.TrimSpace(params.Topic)
	if topic == "" {
		return nil, errors.New("topic name is required")
	}

	m.mu.RLock()
	client := m.client
	m.mu.RUnlock()

	if client == nil {
		return nil, errors.New("not connected to a Kafka cluster")
	}

	rec := &kgo.Record{
		Topic: topic,
	}

	if params.IsTombstone {
		rec.Value = nil
	} else {
		rec.Value = []byte(params.Payload)
	}

	if params.Key != "" {
		rec.Key = []byte(params.Key)
	}

	if params.Partition >= 0 {
		rec.Partition = params.Partition
	}

	if len(params.Headers) > 0 {
		for k, v := range params.Headers {
			rec.Headers = append(rec.Headers, kgo.RecordHeader{
				Key:   k,
				Value: []byte(v),
			})
		}
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	results := client.ProduceSync(timeoutCtx, rec)
	produced, err := results.First()
	if err != nil {
		return nil, fmt.Errorf("failed to produce message: %w", err)
	}

	return &ProduceRecordResult{
		Topic:     produced.Topic,
		Partition: produced.Partition,
		Offset:    produced.Offset,
		Timestamp: produced.Timestamp.UnixMilli(),
	}, nil
}
