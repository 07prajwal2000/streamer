package mcpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"streamer/internal/kafkamanager"
	"streamer/internal/natsmanager"
	"streamer/internal/rabbitmqmanager"
	"streamer/internal/sqsmanager"
)

// DefaultActionCatalog builds the list of all registered actions
func DefaultActionCatalog() []ActionDefinition {
	return []ActionDefinition{
		// -------------------------------------------------------------
		// System Actions
		// -------------------------------------------------------------
		{
			Action:      "system.get_status",
			Namespace:   "system",
			Description: "Get the active connection status, protocol, and cluster telemetry",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.GetConnectionStatus()
			},
		},
		{
			Action:      "system.list_connections",
			Namespace:   "system",
			Description: "List all saved connection profiles (Kafka, NATS, SQS) stored in Streamer",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.ListSavedConnections()
			},
		},
		{
			Action:      "system.switch_connection",
			Namespace:   "system",
			Description: "Switch the active connection to a saved connection profile by ID",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "profile_id", Type: "string", Description: "The ID of the saved connection profile", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				id := extractFirstString(params, "profile_id", "id", "connection_id", "profile")
				if id == "" {
					return nil, fmt.Errorf("profile_id is required")
				}
				if err := b.ConnectProfile(id); err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "connected_profile_id": id}, nil
			},
		},

		// -------------------------------------------------------------
		// Apache Kafka / Redpanda Actions
		// -------------------------------------------------------------
		{
			Action:      "kafka.list_topics",
			Namespace:   "kafka",
			Description: "List all Kafka topics in the cluster with partition counts, replication factors, and message estimates",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "include_internal", Type: "boolean", Description: "Whether to include internal topics (e.g. __consumer_offsets)", Required: false, Default: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				includeInternal := getBool(params, "include_internal", false)
				return b.ListKafkaTopics(includeInternal)
			},
		},
		{
			Action:      "kafka.get_topic_details",
			Namespace:   "kafka",
			Description: "Get detailed partition health, leaders, ISRs, offsets, and configs for a Kafka topic",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "topic", Type: "string", Description: "Name of the topic", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				topic := extractFirstString(params, "topic", "topic_name", "name")
				if topic == "" {
					return nil, fmt.Errorf("topic parameter is required")
				}
				return b.GetKafkaTopicDetails(topic)
			},
		},
		{
			Action:      "kafka.get_brokers",
			Namespace:   "kafka",
			Description: "List all active broker nodes in the Kafka cluster with host, port, rack, and controller status",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.GetKafkaBrokers()
			},
		},
		{
			Action:      "kafka.list_consumer_groups",
			Namespace:   "kafka",
			Description: "List all Kafka consumer groups with coordinator, rebalance state, protocol, and total lag",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.ListKafkaConsumerGroups()
			},
		},
		{
			Action:      "kafka.get_consumer_group_details",
			Namespace:   "kafka",
			Description: "Get deep details of a consumer group including partition-level lag and active member assignments",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "group", Type: "string", Description: "Consumer group name / ID", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				group := extractFirstString(params, "group", "group_id", "consumer_group")
				if group == "" {
					return nil, fmt.Errorf("group parameter is required")
				}
				return b.GetKafkaConsumerGroupDetails(group)
			},
		},
		{
			Action:      "kafka.get_messages",
			Namespace:   "kafka",
			Description: "Query records from a Kafka topic with partition filtering and offset/timestamp strategy",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "topic", Type: "string", Description: "Kafka topic name", Required: true},
				{Name: "partition", Type: "integer", Description: "Partition ID (-1 for all partitions)", Required: false, Default: -1},
				{Name: "limit", Type: "integer", Description: "Maximum records to fetch (default 20, max 100)", Required: false, Default: 20},
				{Name: "strategy", Type: "string", Description: "Offset seek strategy: 'latest', 'earliest', 'offset', 'timestamp'", Required: false, Default: "latest"},
				{Name: "offset", Type: "integer", Description: "Starting offset if strategy is 'offset'", Required: false},
				{Name: "timestamp", Type: "integer", Description: "Starting epoch ms if strategy is 'timestamp'", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				topic := extractFirstString(params, "topic", "topic_name")
				if topic == "" {
					return nil, fmt.Errorf("topic parameter is required")
				}
				partID := getInt32(params, "partition", -1)
				var parts []int32
				if partID >= 0 {
					parts = []int32{partID}
				}
				limit := getInt(params, "limit", 20)
				if limit <= 0 {
					limit = 20
				}
				if limit > 100 {
					limit = 100
				}
				strategy := getString(params, "strategy", "latest")
				offset := getInt64(params, "offset", 0)
				ts := getInt64(params, "timestamp", 0)

				records, err := b.GetKafkaMessages(kafkamanager.GetKafkaMessagesParams{
					Topic:      topic,
					Partitions: parts,
					Strategy:   strategy,
					Offset:     offset,
					Timestamp:  ts,
					Limit:      limit,
				})
				if err != nil {
					return nil, err
				}

				// Truncate huge payloads to preserve LLM token context
				for i := range records {
					if len(records[i].Payload) > 16384 {
						records[i].Payload = records[i].Payload[:16384] + "... [payload truncated at 16KB]"
					}
				}
				return records, nil
			},
		},
		{
			Action:      "kafka.produce_record",
			Namespace:   "kafka",
			Description: "Publish a record/message to a Kafka topic with optional key and headers",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "topic", Type: "string", Description: "Target topic name", Required: true},
				{Name: "payload", Type: "string", Description: "Record payload/value/message (string or JSON object)", Required: true},
				{Name: "key", Type: "string", Description: "Optional partition key", Required: false},
				{Name: "partition", Type: "integer", Description: "Explicit partition ID (-1 for automatic hashing)", Required: false, Default: -1},
				{Name: "headers", Type: "object", Description: "Optional key-value record headers", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				topic := extractFirstString(params, "topic", "topic_name", "target_topic")
				if topic == "" {
					return nil, fmt.Errorf("topic parameter is required")
				}
				payload := extractPayload(params)
				isTombstone := getBool(params, "is_tombstone", false)
				if payload == "" && !isTombstone {
					return nil, fmt.Errorf("payload (or message/value) is required and cannot be empty")
				}
				key := extractFirstString(params, "key", "partition_key", "message_key")
				part := getInt32(params, "partition", -1)
				headers := getStringMap(params, "headers")

				return b.ProduceKafkaRecord(kafkamanager.ProduceKafkaRecordParams{
					Topic:       topic,
					Key:         key,
					Payload:     payload,
					Partition:   part,
					Headers:     headers,
					IsTombstone: isTombstone,
				})
			},
		},
		{
			Action:      "kafka.publish_message",
			Namespace:   "kafka",
			Description: "Publish a message/record to a Kafka topic (alias for kafka.produce_record)",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "topic", Type: "string", Description: "Target topic name", Required: true},
				{Name: "payload", Type: "string", Description: "Record payload/value/message (string or JSON object)", Required: true},
				{Name: "key", Type: "string", Description: "Optional partition key", Required: false},
				{Name: "partition", Type: "integer", Description: "Explicit partition ID (-1 for automatic hashing)", Required: false, Default: -1},
				{Name: "headers", Type: "object", Description: "Optional key-value record headers", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				topic := extractFirstString(params, "topic", "topic_name", "target_topic")
				if topic == "" {
					return nil, fmt.Errorf("topic parameter is required")
				}
				payload := extractPayload(params)
				isTombstone := getBool(params, "is_tombstone", false)
				if payload == "" && !isTombstone {
					return nil, fmt.Errorf("payload (or message/value) is required and cannot be empty")
				}
				key := extractFirstString(params, "key", "partition_key", "message_key")
				part := getInt32(params, "partition", -1)
				headers := getStringMap(params, "headers")

				return b.ProduceKafkaRecord(kafkamanager.ProduceKafkaRecordParams{
					Topic:       topic,
					Key:         key,
					Payload:     payload,
					Partition:   part,
					Headers:     headers,
					IsTombstone: isTombstone,
				})
			},
		},
		{
			Action:      "kafka.create_topic",
			Namespace:   "kafka",
			Description: "Create a new Kafka topic with custom partitions, replication factor, and retention settings",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "topic", Type: "string", Description: "Topic name to create", Required: true},
				{Name: "partitions", Type: "integer", Description: "Number of partitions (default 1)", Required: false, Default: 1},
				{Name: "replication_factor", Type: "integer", Description: "Replication factor (default 1)", Required: false, Default: 1},
				{Name: "cleanup_policy", Type: "string", Description: "Cleanup policy: 'delete' or 'compact'", Required: false, Default: "delete"},
				{Name: "retention_ms", Type: "integer", Description: "Retention period in milliseconds (-1 for infinite)", Required: false},
				{Name: "custom_configs", Type: "object", Description: "Optional key-value configuration overrides", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				topic := extractFirstString(params, "topic", "topic_name", "name")
				if topic == "" {
					return nil, fmt.Errorf("topic parameter is required")
				}
				partitions := getInt32(params, "partitions", 1)
				repFactor := int16(getInt(params, "replication_factor", 1))
				cleanup := extractFirstString(params, "cleanup_policy", "cleanupPolicy")
				if cleanup == "" {
					cleanup = "delete"
				}
				retention := getInt64(params, "retention_ms", 0)
				customConfigs := getStringMap(params, "custom_configs")

				err := b.CreateKafkaTopic(kafkamanager.CreateTopicParams{
					Topic:             topic,
					Partitions:        partitions,
					ReplicationFactor: repFactor,
					CleanupPolicy:     cleanup,
					RetentionMs:       retention,
					CustomConfigs:     customConfigs,
				})
				if err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "topic": topic, "partitions": partitions}, nil
			},
		},
		{
			Action:      "kafka.update_topic_partitions",
			Namespace:   "kafka",
			Description: "Increase the total partition count of an existing Kafka topic",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "topic", Type: "string", Description: "Target topic name", Required: true},
				{Name: "new_total", Type: "integer", Description: "New total partition count (must be greater than current)", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				topic := extractFirstString(params, "topic", "topic_name")
				newTotal := getInt(params, "new_total", getInt(params, "partitions", getInt(params, "count", 0)))
				if topic == "" || newTotal <= 0 {
					return nil, fmt.Errorf("topic and valid new_total are required")
				}
				if err := b.UpdateKafkaTopicPartitions(topic, newTotal); err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "topic": topic, "new_total_partitions": newTotal}, nil
			},
		},
		{
			Action:      "kafka.update_topic_configs",
			Namespace:   "kafka",
			Description: "Alter dynamic configuration parameters for an existing Kafka topic",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "topic", Type: "string", Description: "Target topic name", Required: true},
				{Name: "configs", Type: "object", Description: "Map of configuration key-values to set (e.g. {'retention.ms': '86400000'})", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				topic := extractFirstString(params, "topic", "topic_name")
				configs := getStringMap(params, "configs")
				if topic == "" || len(configs) == 0 {
					return nil, fmt.Errorf("topic and configs map are required")
				}
				if err := b.UpdateKafkaTopicConfigs(topic, configs); err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "topic": topic, "updated_configs": configs}, nil
			},
		},

		// -------------------------------------------------------------
		// NATS & JetStream Actions
		// -------------------------------------------------------------
		{
			Action:      "nats.publish",
			Namespace:   "nats",
			Description: "Publish a message to a NATS subject with optional reply-to subject",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "subject", Type: "string", Description: "Target subject (e.g. 'orders.created')", Required: true},
				{Name: "payload", Type: "string", Description: "Message payload (text or JSON)", Required: true},
				{Name: "reply_to", Type: "string", Description: "Optional reply subject for request-reply pattern", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				subj := extractFirstString(params, "subject", "topic", "channel", "subj", "target")
				if subj == "" {
					return nil, fmt.Errorf("subject parameter is required")
				}
				payload := extractPayload(params)
				if payload == "" {
					return nil, fmt.Errorf("payload (or message/data) is required and cannot be empty")
				}
				replyTo := extractFirstString(params, "reply_to", "replyTo", "reply")
				if err := b.PublishNats(subj, replyTo, nil, payload); err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "subject": subj}, nil
			},
		},
		{
			Action:      "nats.request",
			Namespace:   "nats",
			Description: "Send a request to a NATS subject and synchronously wait for a response",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "subject", Type: "string", Description: "Target request subject", Required: true},
				{Name: "payload", Type: "string", Description: "Request payload (text or JSON)", Required: true},
				{Name: "timeout_ms", Type: "integer", Description: "Timeout in milliseconds (default 2000)", Required: false, Default: 2000},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				subj := extractFirstString(params, "subject", "topic", "channel", "subj", "target")
				if subj == "" {
					return nil, fmt.Errorf("subject parameter is required")
				}
				payload := extractPayload(params)
				if payload == "" {
					return nil, fmt.Errorf("payload (or message/data) is required and cannot be empty")
				}
				timeout := getInt(params, "timeout_ms", getInt(params, "timeout", 2000))
				return b.RequestNats(subj, nil, payload, timeout)
			},
		},
		{
			Action:      "nats.list_streams",
			Namespace:   "nats",
			Description: "List all NATS JetStream streams with message count, byte size, consumers, and subjects",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.ListNatsStreams()
			},
		},
		{
			Action:      "nats.get_stream_messages",
			Namespace:   "nats",
			Description: "Fetch stored messages from a JetStream stream by sequence number",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "stream", Type: "string", Description: "Name of the JetStream stream", Required: true},
				{Name: "start_seq", Type: "integer", Description: "Starting sequence number (default 1)", Required: false, Default: 1},
				{Name: "limit", Type: "integer", Description: "Max messages to fetch (default 20, max 100)", Required: false, Default: 20},
				{Name: "reverse", Type: "boolean", Description: "Read in reverse (newest first)", Required: false, Default: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				stream := extractFirstString(params, "stream", "stream_name", "name")
				if stream == "" {
					return nil, fmt.Errorf("stream parameter is required")
				}
				startSeq := uint64(getInt64(params, "start_seq", 1))
				limit := getInt(params, "limit", 20)
				if limit <= 0 {
					limit = 20
				}
				if limit > 100 {
					limit = 100
				}
				reverse := getBool(params, "reverse", false)

				msgs, err := b.GetNatsStreamMessages(stream, startSeq, limit, reverse)
				if err != nil {
					return nil, err
				}
				for i := range msgs {
					if len(msgs[i].Data) > 16384 {
						msgs[i].Data = msgs[i].Data[:16384] + "... [data truncated at 16KB]"
					}
				}
				return msgs, nil
			},
		},
		{
			Action:      "nats.create_stream",
			Namespace:   "nats",
			Description: "Create a new JetStream stream with subject routing and retention policies",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "name", Type: "string", Description: "Unique stream name", Required: true},
				{Name: "subjects", Type: "array", Description: "List of subjects bound to this stream (e.g. ['orders.>'])", Required: true},
				{Name: "storage", Type: "string", Description: "Storage type: 'file' or 'memory' (default 'file')", Required: false, Default: "file"},
				{Name: "retention", Type: "string", Description: "Retention policy: 'limits', 'interest', or 'workqueue'", Required: false, Default: "limits"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				name := extractFirstString(params, "name", "stream", "stream_name")
				subjects := getStringSlice(params, "subjects", "subject")
				if name == "" || len(subjects) == 0 {
					return nil, fmt.Errorf("name and non-empty subjects array are required")
				}
				storage := extractFirstString(params, "storage", "storage_type")
				if storage == "" {
					storage = "file"
				}
				retention := extractFirstString(params, "retention", "retention_policy")
				if retention == "" {
					retention = "limits"
				}

				err := b.CreateNatsStream(natsmanager.StreamCreateParams{
					Name:      name,
					Subjects:  subjects,
					Storage:   storage,
					Retention: retention,
				})
				if err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "stream": name, "subjects": subjects}, nil
			},
		},
		{
			Action:      "nats.list_kv_buckets",
			Namespace:   "nats",
			Description: "List all NATS Key-Value (KV) store buckets in the cluster",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.ListNatsKVBuckets()
			},
		},
		{
			Action:      "nats.get_kv_entry",
			Namespace:   "nats",
			Description: "Retrieve the current value and revision of a key from a NATS KV bucket",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "bucket", Type: "string", Description: "KV Bucket name", Required: true},
				{Name: "key", Type: "string", Description: "Key name", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				bucket := extractFirstString(params, "bucket", "bucket_name", "store")
				key := extractFirstString(params, "key", "key_name")
				if bucket == "" || key == "" {
					return nil, fmt.Errorf("bucket and key parameters are required")
				}
				return b.GetNatsKVEntry(bucket, key)
			},
		},
		{
			Action:      "nats.put_kv_entry",
			Namespace:   "nats",
			Description: "Write or update a key-value pair in a NATS KV bucket",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "bucket", Type: "string", Description: "KV Bucket name", Required: true},
				{Name: "key", Type: "string", Description: "Key name", Required: true},
				{Name: "value", Type: "string", Description: "Value content to store (text or JSON)", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				bucket := extractFirstString(params, "bucket", "bucket_name", "store")
				key := extractFirstString(params, "key", "key_name")
				val := extractPayload(params)
				if bucket == "" || key == "" {
					return nil, fmt.Errorf("bucket and key parameters are required")
				}
				if val == "" {
					return nil, fmt.Errorf("value (or payload/data) is required and cannot be empty")
				}
				rev, err := b.PutNatsKVEntry(bucket, key, val)
				if err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "bucket": bucket, "key": key, "revision": rev}, nil
			},
		},

		// -------------------------------------------------------------
		// Amazon SQS Actions
		// -------------------------------------------------------------
		{
			Action:      "sqs.list_queues",
			Namespace:   "sqs",
			Description: "List all Amazon SQS queues with URL, visible count, in-flight messages, and DLQ status",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "prefix", Type: "string", Description: "Optional queue name prefix filter", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				prefix := extractFirstString(params, "prefix", "queue_name_prefix", "filter")
				return b.ListSQSQueues(prefix)
			},
		},
		{
			Action:      "sqs.get_queue_details",
			Namespace:   "sqs",
			Description: "Get complete attributes, policies, DLQ configuration, and tags for an SQS queue",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "queue_url", Type: "string", Description: "The full SQS queue URL or queue name", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				rawURL := extractFirstString(params, "queue_url", "queue", "queue_name", "url", "queueUrl")
				queueURL := resolveSQSQueueURL(b, rawURL)
				if queueURL == "" {
					return nil, fmt.Errorf("queue_url parameter is required")
				}
				return b.GetSQSQueueDetails(queueURL)
			},
		},
		{
			Action:      "sqs.poll_messages",
			Namespace:   "sqs",
			Description: "Receive and inspect messages from an SQS queue without deleting them",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "queue_url", Type: "string", Description: "The full SQS queue URL or queue name", Required: true},
				{Name: "max_messages", Type: "integer", Description: "Number of messages to retrieve (1-10, default 10)", Required: false, Default: 10},
				{Name: "wait_time_seconds", Type: "integer", Description: "Long polling wait time in seconds (0-20, default 2)", Required: false, Default: 2},
				{Name: "visibility_timeout", Type: "integer", Description: "Visibility timeout in seconds for received messages (default 30)", Required: false, Default: 30},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				rawURL := extractFirstString(params, "queue_url", "queue", "queue_name", "url", "queueUrl")
				queueURL := resolveSQSQueueURL(b, rawURL)
				if queueURL == "" {
					return nil, fmt.Errorf("queue_url parameter is required")
				}
				maxMsgs := int32(getInt(params, "max_messages", 10))
				if maxMsgs <= 0 || maxMsgs > 10 {
					maxMsgs = 10
				}
				waitTime := int32(getInt(params, "wait_time_seconds", 2))
				visTimeout := int32(getInt(params, "visibility_timeout", 30))

				msgs, err := b.PollSQSMessages(sqsmanager.PollSQSMessagesParams{
					QueueURL:          queueURL,
					MaxMessages:       maxMsgs,
					WaitTimeSeconds:   waitTime,
					VisibilityTimeout: visTimeout,
				})
				if err != nil {
					return nil, err
				}
				for i := range msgs {
					if len(msgs[i].Body) > 16384 {
						msgs[i].Body = msgs[i].Body[:16384] + "... [body truncated at 16KB]"
					}
				}
				return msgs, nil
			},
		},
		{
			Action:      "sqs.send_message",
			Namespace:   "sqs",
			Description: "Send a message to an Amazon SQS queue with optional deduplication and message group IDs",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "queue_url", Type: "string", Description: "Target SQS queue URL or queue name", Required: true},
				{Name: "body", Type: "string", Description: "Message body payload (string or JSON)", Required: true},
				{Name: "delay_seconds", Type: "integer", Description: "Delivery delay in seconds (0-900, standard queues only)", Required: false, Default: 0},
				{Name: "message_group_id", Type: "string", Description: "Message group ID (required for FIFO queues)", Required: false},
				{Name: "message_deduplication_id", Type: "string", Description: "Message deduplication ID (for FIFO queues without content-based deduplication)", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				rawURL := extractFirstString(params, "queue_url", "queue", "queue_name", "url", "queueUrl")
				queueURL := resolveSQSQueueURL(b, rawURL)
				if queueURL == "" {
					return nil, fmt.Errorf("queue_url parameter is required")
				}
				body := extractPayload(params)
				if body == "" {
					return nil, fmt.Errorf("body (or payload/message) is required and cannot be empty")
				}
				delay := int32(getInt(params, "delay_seconds", getInt(params, "delay", 0)))
				groupID := extractFirstString(params, "message_group_id", "group_id", "groupId")
				dedupID := extractFirstString(params, "message_deduplication_id", "deduplication_id", "dedup_id")

				return b.SendSQSMessage(sqsmanager.SendSQSMessageParams{
					QueueURL:               queueURL,
					Body:                   body,
					DelaySeconds:           delay,
					MessageGroupID:         groupID,
					MessageDeduplicationID: dedupID,
				})
			},
		},
		{
			Action:      "sqs.create_queue",
			Namespace:   "sqs",
			Description: "Create a new Standard or FIFO SQS queue with customizable visibility and retention",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "queue_name", Type: "string", Description: "Queue name (must end in .fifo if FIFO)", Required: true},
				{Name: "is_fifo", Type: "boolean", Description: "Whether to create a FIFO queue (default false)", Required: false, Default: false},
				{Name: "visibility_timeout", Type: "integer", Description: "Visibility timeout in seconds (default 30)", Required: false, Default: 30},
				{Name: "message_retention_period", Type: "integer", Description: "Retention in seconds (default 345600 = 4 days)", Required: false, Default: 345600},
				{Name: "delay_seconds", Type: "integer", Description: "Delivery delay in seconds (default 0)", Required: false, Default: 0},
				{Name: "content_based_deduplication", Type: "boolean", Description: "Enable content-based deduplication for FIFO queues", Required: false, Default: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				name := extractFirstString(params, "queue_name", "name", "queue")
				if name == "" {
					return nil, fmt.Errorf("queue_name parameter is required")
				}
				isFIFO := getBool(params, "is_fifo", false)
				visTimeout := int32(getInt(params, "visibility_timeout", 30))
				retention := int32(getInt(params, "message_retention_period", 345600))
				delay := int32(getInt(params, "delay_seconds", 0))
				contentDedup := getBool(params, "content_based_deduplication", false)

				return b.CreateSQSQueue(sqsmanager.CreateQueueParams{
					QueueName:                 name,
					IsFIFO:                    isFIFO,
					VisibilityTimeout:         visTimeout,
					MessageRetentionPeriod:    retention,
					DelaySeconds:              delay,
					ContentBasedDeduplication: contentDedup,
				})
			},
		},
		{
			Action:      "sqs.update_queue_attributes",
			Namespace:   "sqs",
			Description: "Update configuration attributes of an existing SQS queue (e.g. VisibilityTimeout, DelaySeconds)",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "queue_url", Type: "string", Description: "The full SQS queue URL or queue name", Required: true},
				{Name: "attributes", Type: "object", Description: "Map of attribute names to new string values", Required: true},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				rawURL := extractFirstString(params, "queue_url", "queue", "queue_name", "url", "queueUrl")
				queueURL := resolveSQSQueueURL(b, rawURL)
				attrs := getStringMap(params, "attributes")
				if queueURL == "" || len(attrs) == 0 {
					return nil, fmt.Errorf("queue_url and non-empty attributes map are required")
				}
				if err := b.UpdateSQSQueueAttributes(queueURL, attrs); err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "queue_url": queueURL, "updated_attributes": attrs}, nil
			},
		},
		{
			Action:      "sqs.redrive_dlq",
			Namespace:   "sqs",
			Description: "Redrive dead-letter messages from a DLQ back into the active source queue",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "dlq_url", Type: "string", Description: "Dead Letter Queue URL or queue name to drain from", Required: true},
				{Name: "source_queue_url", Type: "string", Description: "Target active queue URL or queue name to receive redriven messages", Required: true},
				{Name: "max_messages", Type: "integer", Description: "Maximum messages to redrive (default 50, max 200)", Required: false, Default: 50},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				rawDLQ := extractFirstString(params, "dlq_url", "dlq", "source_url", "dlqUrl")
				dlqURL := resolveSQSQueueURL(b, rawDLQ)
				rawSrc := extractFirstString(params, "source_queue_url", "target_queue_url", "target_url", "destination_url", "dest_queue_url")
				srcURL := resolveSQSQueueURL(b, rawSrc)
				if dlqURL == "" || srcURL == "" {
					return nil, fmt.Errorf("dlq_url and source_queue_url are required")
				}
				maxMsgs := int32(getInt(params, "max_messages", 50))
				if maxMsgs <= 0 || maxMsgs > 200 {
					maxMsgs = 50
				}
				return b.RedriveDLQ(sqsmanager.RedriveDLQParams{
					SourceQueueURL: dlqURL,
					TargetQueueURL: srcURL,
					MaxMessages:    int(maxMsgs),
				})
			},
		},

		// -------------------------------------------------------------
		// RabbitMQ / AMQP Actions
		// -------------------------------------------------------------
		{
			Action:      "rabbitmq.get_overview",
			Namespace:   "rabbitmq",
			Description: "Get cluster-wide RabbitMQ metrics, Erlang version, queue/exchange totals, and message rates",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.GetRabbitMQOverview()
			},
		},
		{
			Action:      "rabbitmq.list_nodes",
			Namespace:   "rabbitmq",
			Description: "List all RabbitMQ cluster nodes with memory, disk free, file descriptors, and alarm states",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.ListRabbitMQNodes()
			},
		},
		{
			Action:      "rabbitmq.list_vhosts",
			Namespace:   "rabbitmq",
			Description: "List all virtual hosts in the RabbitMQ cluster with message totals and rates",
			ReadOnly:    true,
			Parameters:  []ActionParam{},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				return b.ListRabbitMQVHosts()
			},
		},
		{
			Action:      "rabbitmq.list_queues",
			Namespace:   "rabbitmq",
			Description: "List all queues in a virtual host with message counts, consumers, and queue type",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "vhost", Type: "string", Description: "Virtual host name (default '/' or active vhost)", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				vhost := extractFirstString(params, "vhost", "virtual_host")
				return b.ListRabbitMQQueues(vhost)
			},
		},
		{
			Action:      "rabbitmq.get_queue_details",
			Namespace:   "rabbitmq",
			Description: "Get detailed attributes, consumer list, and bindings for a specific RabbitMQ queue",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "queue", Type: "string", Description: "The queue name", Required: true},
				{Name: "vhost", Type: "string", Description: "Virtual host name (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				queue := extractFirstString(params, "queue", "queue_name", "name")
				if queue == "" {
					return nil, fmt.Errorf("queue name is required")
				}
				vhost := extractFirstString(params, "vhost", "virtual_host")
				return b.GetRabbitMQQueueDetails(vhost, queue)
			},
		},
		{
			Action:      "rabbitmq.create_queue",
			Namespace:   "rabbitmq",
			Description: "Create a new RabbitMQ queue (classic, quorum, or stream) with optional TTL, Max-Length, or DLX",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "name", Type: "string", Description: "The queue name", Required: true},
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
				{Name: "type", Type: "string", Description: "Queue type: 'classic', 'quorum', or 'stream'", Required: false, Default: "classic"},
				{Name: "durable", Type: "boolean", Description: "Whether queue survives broker restarts (required true for quorum)", Required: false, Default: true},
				{Name: "auto_delete", Type: "boolean", Description: "Whether queue is deleted when last consumer unsubscribes", Required: false, Default: false},
				{Name: "message_ttl", Type: "integer", Description: "Per-queue message TTL in milliseconds (x-message-ttl)", Required: false},
				{Name: "dead_letter_exchange", Type: "string", Description: "Target DLX exchange (x-dead-letter-exchange)", Required: false},
				{Name: "dead_letter_routing_key", Type: "string", Description: "Target DLX routing key (x-dead-letter-routing-key)", Required: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				name := extractFirstString(params, "name", "queue", "queue_name")
				if name == "" {
					return nil, fmt.Errorf("queue name is required")
				}
				return b.CreateRabbitMQQueue(rabbitmqmanager.CreateQueueParams{
					Name:                 name,
					VHost:                extractFirstString(params, "vhost", "virtual_host"),
					Type:                 extractFirstString(params, "type", "queue_type"),
					Durable:              getBool(params, "durable", true),
					AutoDelete:           getBool(params, "auto_delete", false),
					MessageTTL:           getInt64(params, "message_ttl", 0),
					DeadLetterExchange:   extractFirstString(params, "dead_letter_exchange", "dlx"),
					DeadLetterRoutingKey: extractFirstString(params, "dead_letter_routing_key", "dlx_key"),
				})
			},
		},
		{
			Action:      "rabbitmq.list_exchanges",
			Namespace:   "rabbitmq",
			Description: "List all exchanges in a virtual host with type (direct, fanout, topic, headers) and durability",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				vhost := extractFirstString(params, "vhost", "virtual_host")
				return b.ListRabbitMQExchanges(vhost)
			},
		},
		{
			Action:      "rabbitmq.get_exchange_details",
			Namespace:   "rabbitmq",
			Description: "Get detailed attributes and bindings for an exchange",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "exchange", Type: "string", Description: "Exchange name", Required: true},
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				exchange := extractFirstString(params, "exchange", "exchange_name", "name")
				vhost := extractFirstString(params, "vhost", "virtual_host")
				return b.GetRabbitMQExchangeDetails(vhost, exchange)
			},
		},
		{
			Action:      "rabbitmq.create_exchange",
			Namespace:   "rabbitmq",
			Description: "Create a new exchange (direct, fanout, topic, or headers)",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "name", Type: "string", Description: "Exchange name", Required: true},
				{Name: "type", Type: "string", Description: "Type: 'direct', 'fanout', 'topic', or 'headers'", Required: false, Default: "direct"},
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
				{Name: "durable", Type: "boolean", Description: "Whether exchange survives broker restarts", Required: false, Default: true},
				{Name: "auto_delete", Type: "boolean", Description: "Whether exchange auto-deletes when all queues unbind", Required: false, Default: false},
				{Name: "internal", Type: "boolean", Description: "Whether exchange can only be published to by other exchanges", Required: false, Default: false},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				name := extractFirstString(params, "name", "exchange", "exchange_name")
				if name == "" {
					return nil, fmt.Errorf("exchange name is required")
				}
				return b.CreateRabbitMQExchange(rabbitmqmanager.CreateExchangeParams{
					Name:       name,
					VHost:      extractFirstString(params, "vhost", "virtual_host"),
					Type:       extractFirstString(params, "type", "exchange_type"),
					Durable:    getBool(params, "durable", true),
					AutoDelete: getBool(params, "auto_delete", false),
					Internal:   getBool(params, "internal", false),
				})
			},
		},
		{
			Action:      "rabbitmq.list_bindings",
			Namespace:   "rabbitmq",
			Description: "List all exchange-to-queue and exchange-to-exchange bindings in a virtual host",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				vhost := extractFirstString(params, "vhost", "virtual_host")
				return b.ListRabbitMQBindings(vhost)
			},
		},
		{
			Action:      "rabbitmq.create_binding",
			Namespace:   "rabbitmq",
			Description: "Bind an exchange to a destination queue or exchange with a routing key",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "source", Type: "string", Description: "Source exchange name", Required: true},
				{Name: "destination", Type: "string", Description: "Destination queue or exchange name", Required: true},
				{Name: "destination_type", Type: "string", Description: "Destination type: 'queue' or 'exchange'", Required: false, Default: "queue"},
				{Name: "routing_key", Type: "string", Description: "Routing key / binding key pattern (e.g. 'orders.*')", Required: false, Default: ""},
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				source := extractFirstString(params, "source", "source_exchange", "exchange")
				dest := extractFirstString(params, "destination", "destination_name", "target", "queue")
				if source == "" || dest == "" {
					return nil, fmt.Errorf("source exchange and destination are required")
				}
				err := b.CreateRabbitMQBinding(rabbitmqmanager.CreateBindingParams{
					Source:          source,
					Destination:     dest,
					DestinationType: extractFirstString(params, "destination_type", "type"),
					RoutingKey:      extractFirstString(params, "routing_key", "key"),
					VHost:           extractFirstString(params, "vhost", "virtual_host"),
				})
				if err != nil {
					return nil, err
				}
				return map[string]any{"success": true, "source": source, "destination": dest}, nil
			},
		},
		{
			Action:      "rabbitmq.publish_message",
			Namespace:   "rabbitmq",
			Description: "Publish a message to an exchange with routing key, delivery mode, headers, and publisher confirms",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "exchange", Type: "string", Description: "Exchange name (empty string for default direct exchange)", Required: false, Default: ""},
				{Name: "routing_key", Type: "string", Description: "Routing key or target queue name", Required: true},
				{Name: "payload", Type: "string", Description: "Message payload (string, JSON, or object)", Required: true},
				{Name: "content_type", Type: "string", Description: "MIME Content-Type (e.g. 'application/json')", Required: false, Default: "application/json"},
				{Name: "delivery_mode", Type: "integer", Description: "1 for non-persistent, 2 for persistent", Required: false, Default: 2},
				{Name: "wait_for_confirm", Type: "boolean", Description: "Wait for broker ACK confirmation before returning", Required: false, Default: true},
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				payload := extractPayload(params)
				if payload == "" {
					return nil, fmt.Errorf("message payload is required")
				}
				routingKey := extractFirstString(params, "routing_key", "key", "queue")
				return b.PublishRabbitMQMessage(rabbitmqmanager.PublishRMQMessageParams{
					Exchange:       extractFirstString(params, "exchange", "exchange_name"),
					RoutingKey:     routingKey,
					Payload:        payload,
					ContentType:    extractFirstString(params, "content_type"),
					DeliveryMode:   uint8(getInt(params, "delivery_mode", 2)),
					WaitForConfirm: getBool(params, "wait_for_confirm", true),
					VHost:          extractFirstString(params, "vhost", "virtual_host"),
				})
			},
		},
		{
			Action:      "rabbitmq.peek_messages",
			Namespace:   "rabbitmq",
			Description: "Non-destructively peek/inspect messages from a RabbitMQ queue without consuming them",
			ReadOnly:    true,
			Parameters: []ActionParam{
				{Name: "queue", Type: "string", Description: "Queue name to inspect", Required: true},
				{Name: "count", Type: "integer", Description: "Number of messages to peek (default 10, max 100)", Required: false, Default: 10},
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				queue := extractFirstString(params, "queue", "queue_name")
				if queue == "" {
					return nil, fmt.Errorf("queue name is required")
				}
				count := getInt(params, "count", 10)
				return b.PeekRabbitMQMessages(rabbitmqmanager.PeekRMQMessagesParams{
					QueueName: queue,
					Count:     count,
					AckMode:   "ack_requeue_true",
					VHost:     extractFirstString(params, "vhost", "virtual_host"),
				})
			},
		},
		{
			Action:      "rabbitmq.redrive_dlq",
			Namespace:   "rabbitmq",
			Description: "Safely redrive dead-letter messages from a DLQ back to their original target destination",
			ReadOnly:    false,
			Parameters: []ActionParam{
				{Name: "source_queue", Type: "string", Description: "Dead letter queue name to drain from", Required: true},
				{Name: "target_exchange", Type: "string", Description: "Target exchange (optional: extracted from x-death header)", Required: false},
				{Name: "target_routing_key", Type: "string", Description: "Target routing key (optional: extracted from x-death header)", Required: false},
				{Name: "max_messages", Type: "integer", Description: "Maximum messages to redrive (default 50)", Required: false, Default: 50},
				{Name: "vhost", Type: "string", Description: "Virtual host (default '/')", Required: false, Default: "/"},
			},
			Handler: func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error) {
				srcQueue := extractFirstString(params, "source_queue", "source", "dlq")
				if srcQueue == "" {
					return nil, fmt.Errorf("source_queue is required")
				}
				return b.RedriveRabbitMQDLQ(rabbitmqmanager.RedriveDLQParams{
					SourceQueue:      srcQueue,
					TargetExchange:   extractFirstString(params, "target_exchange", "exchange"),
					TargetRoutingKey: extractFirstString(params, "target_routing_key", "routing_key"),
					MaxMessages:      getInt(params, "max_messages", 50),
					VHost:            extractFirstString(params, "vhost", "virtual_host"),
				})
			},
		},
	}
}

// Helper methods for safe parameter retrieval
func getString(params map[string]any, key string, defaultVal string) string {
	if params == nil {
		return defaultVal
	}
	val, ok := params[key]
	if !ok || val == nil {
		return defaultVal
	}
	if s, ok := val.(string); ok {
		return strings.TrimSpace(s)
	}
	return fmt.Sprintf("%v", val)
}

func getInt(params map[string]any, key string, defaultVal int) int {
	if params == nil {
		return defaultVal
	}
	val, ok := params[key]
	if !ok || val == nil {
		return defaultVal
	}
	switch v := val.(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return defaultVal
	}
}

func getInt32(params map[string]any, key string, defaultVal int32) int32 {
	return int32(getInt(params, key, int(defaultVal)))
}

func getInt64(params map[string]any, key string, defaultVal int64) int64 {
	if params == nil {
		return defaultVal
	}
	val, ok := params[key]
	if !ok || val == nil {
		return defaultVal
	}
	switch v := val.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case int32:
		return int64(v)
	case float64:
		return int64(v)
	default:
		return defaultVal
	}
}

func getBool(params map[string]any, key string, defaultVal bool) bool {
	if params == nil {
		return defaultVal
	}
	val, ok := params[key]
	if !ok || val == nil {
		return defaultVal
	}
	if b, ok := val.(bool); ok {
		return b
	}
	return defaultVal
}

func getStringSlice(params map[string]any, keys ...string) []string {
	if params == nil {
		return nil
	}
	for _, key := range keys {
		val, ok := params[key]
		if !ok || val == nil {
			continue
		}
		if list, ok := val.([]string); ok {
			return list
		}
		if list, ok := val.([]any); ok {
			result := make([]string, 0, len(list))
			for _, item := range list {
				if s, ok := item.(string); ok {
					trimmed := strings.TrimSpace(s)
					if trimmed != "" {
						result = append(result, trimmed)
					}
				}
			}
			if len(result) > 0 {
				return result
			}
		}
		if s, ok := val.(string); ok {
			s = strings.TrimSpace(s)
			if s != "" {
				parts := strings.Split(s, ",")
				result := make([]string, 0, len(parts))
				for _, p := range parts {
					if trimmed := strings.TrimSpace(p); trimmed != "" {
						result = append(result, trimmed)
					}
				}
				if len(result) > 0 {
					return result
				}
			}
		}
	}
	return nil
}

func getStringMap(params map[string]any, key string) map[string]string {
	if params == nil {
		return nil
	}
	val, ok := params[key]
	if !ok || val == nil {
		return nil
	}
	if m, ok := val.(map[string]string); ok {
		return m
	}
	if m, ok := val.(map[string]any); ok {
		result := make(map[string]string, len(m))
		for k, v := range m {
			result[k] = fmt.Sprintf("%v", v)
		}
		return result
	}
	return nil
}

// extractFirstString returns the first non-empty string among the candidate keys.
func extractFirstString(params map[string]any, keys ...string) string {
	if params == nil {
		return ""
	}
	for _, k := range keys {
		val, ok := params[k]
		if !ok || val == nil {
			continue
		}
		switch v := val.(type) {
		case string:
			s := strings.TrimSpace(v)
			if s != "" {
				return s
			}
		default:
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}

// resolveSQSQueueURL resolves an SQS queue identifier (full URL or simple queue name)
// to a canonical SQS Queue URL if possible.
func resolveSQSQueueURL(b StreamerBackend, rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	if strings.HasPrefix(rawURL, "http://") || strings.HasPrefix(rawURL, "https://") {
		return rawURL
	}
	if b != nil {
		queues, err := b.ListSQSQueues(rawURL)
		if err == nil {
			for _, q := range queues {
				if q.QueueName == rawURL || strings.HasSuffix(q.QueueURL, "/"+rawURL) {
					return q.QueueURL
				}
			}
		}
	}
	return rawURL
}

// extractPayload retrieves message payload content across common parameter aliases
// ("payload", "value", "message", "body", "data", "msg", "content", "text", "val")
// and properly serializes JSON objects/maps/arrays if passed.
func extractPayload(params map[string]any) string {
	if params == nil {
		return ""
	}
	aliases := []string{"payload", "value", "message", "body", "data", "msg", "content", "text", "val"}
	for _, key := range aliases {
		val, ok := params[key]
		if !ok || val == nil {
			continue
		}
		switch v := val.(type) {
		case string:
			s := strings.TrimSpace(v)
			if s != "" {
				return s
			}
		case []byte:
			if len(v) > 0 {
				return string(v)
			}
		case map[string]any, []any:
			jsonBytes, err := json.Marshal(v)
			if err == nil {
				return string(jsonBytes)
			}
		default:
			if jsonBytes, err := json.Marshal(v); err == nil && string(jsonBytes) != "null" && string(jsonBytes) != `""` {
				s := strings.TrimSpace(string(jsonBytes))
				if s != "" {
					return s
				}
			}
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}
