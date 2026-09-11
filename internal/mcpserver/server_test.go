package mcpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"testing"
	"time"

	"streamer/internal/kafkamanager"
	"streamer/internal/natsmanager"
	"streamer/internal/sqsmanager"

	"github.com/mark3labs/mcp-go/mcp"
)

type mockBackend struct {
	activeProto         string
	topics              []kafkamanager.TopicSummary
	queues              []sqsmanager.SQSQueueSummary
	lastProducedPayload string
	lastNatsSubject     string
	lastNatsPayload     string
	lastKVBucket        string
	lastKVKey           string
	lastKVVal           string
	lastSQSQueueURL     string
	lastSQSBody         string
}

func (m *mockBackend) GetActiveProtocol() string {
	return m.activeProto
}

func (m *mockBackend) GetConnectionStatus() (any, error) {
	return map[string]any{"connected": true, "protocol": m.activeProto}, nil
}

func (m *mockBackend) ListSavedConnections() (any, error) {
	return []map[string]any{{"id": "test-1", "name": "Test Profile"}}, nil
}

func (m *mockBackend) ConnectProfile(id string) error {
	return nil
}

func (m *mockBackend) ListKafkaTopics(includeInternal bool) ([]kafkamanager.TopicSummary, error) {
	return m.topics, nil
}

func (m *mockBackend) GetKafkaTopicDetails(topic string) (*kafkamanager.TopicDetailInfo, error) {
	return &kafkamanager.TopicDetailInfo{Name: topic, PartitionsCount: 3}, nil
}

func (m *mockBackend) GetKafkaBrokers() ([]kafkamanager.BrokerInfo, error) {
	return []kafkamanager.BrokerInfo{{NodeID: 1, Host: "localhost", Port: 9092}}, nil
}

func (m *mockBackend) ListKafkaConsumerGroups() ([]kafkamanager.ConsumerGroupSummary, error) {
	return []kafkamanager.ConsumerGroupSummary{{Group: "group-1", State: "Stable"}}, nil
}

func (m *mockBackend) GetKafkaConsumerGroupDetails(group string) (*kafkamanager.ConsumerGroupDetailInfo, error) {
	return &kafkamanager.ConsumerGroupDetailInfo{Group: group, TotalLag: 10}, nil
}

func (m *mockBackend) GetKafkaMessages(params kafkamanager.GetKafkaMessagesParams) ([]kafkamanager.KafkaRecord, error) {
	return []kafkamanager.KafkaRecord{{Topic: params.Topic, Payload: "hello"}}, nil
}

func (m *mockBackend) ProduceKafkaRecord(params kafkamanager.ProduceKafkaRecordParams) (*kafkamanager.ProduceRecordResult, error) {
	m.lastProducedPayload = params.Payload
	return &kafkamanager.ProduceRecordResult{Topic: params.Topic, Partition: 0, Offset: 100}, nil
}

func (m *mockBackend) CreateKafkaTopic(params kafkamanager.CreateTopicParams) error {
	return nil
}

func (m *mockBackend) UpdateKafkaTopicPartitions(topic string, newTotal int) error {
	return nil
}

func (m *mockBackend) UpdateKafkaTopicConfigs(topic string, configs map[string]string) error {
	return nil
}

func (m *mockBackend) PublishNats(subject string, replyTo string, headers map[string][]string, payload string) error {
	m.lastNatsSubject = subject
	m.lastNatsPayload = payload
	return nil
}

func (m *mockBackend) RequestNats(subject string, headers map[string][]string, payload string, timeoutMs int) (any, error) {
	m.lastNatsSubject = subject
	m.lastNatsPayload = payload
	return map[string]any{"reply": "pong"}, nil
}

func (m *mockBackend) ListNatsStreams() ([]natsmanager.JSStreamInfo, error) {
	return []natsmanager.JSStreamInfo{{Name: "ORDERS"}}, nil
}

func (m *mockBackend) GetNatsStreamMessages(stream string, startSeq uint64, limit int, reverse bool) ([]natsmanager.JSStoredMsg, error) {
	return []natsmanager.JSStoredMsg{{Sequence: 1, Data: "order-1"}}, nil
}

func (m *mockBackend) CreateNatsStream(params natsmanager.StreamCreateParams) error {
	return nil
}

func (m *mockBackend) ListNatsKVBuckets() ([]natsmanager.KVBucketInfo, error) {
	return []natsmanager.KVBucketInfo{{Bucket: "configs"}}, nil
}

func (m *mockBackend) GetNatsKVEntry(bucket string, key string) (*natsmanager.KVEntryInfo, error) {
	return &natsmanager.KVEntryInfo{Bucket: bucket, Key: key, Value: "val"}, nil
}

func (m *mockBackend) PutNatsKVEntry(bucket string, key string, val string) (uint64, error) {
	m.lastKVBucket = bucket
	m.lastKVKey = key
	m.lastKVVal = val
	return 1, nil
}

func (m *mockBackend) ListSQSQueues(prefix string) ([]sqsmanager.SQSQueueSummary, error) {
	return m.queues, nil
}

func (m *mockBackend) GetSQSQueueDetails(queueURL string) (*sqsmanager.SQSQueueDetail, error) {
	return &sqsmanager.SQSQueueDetail{
		SQSQueueSummary: sqsmanager.SQSQueueSummary{QueueURL: queueURL, QueueName: "my-queue"},
	}, nil
}

func (m *mockBackend) PollSQSMessages(params sqsmanager.PollSQSMessagesParams) ([]sqsmanager.SQSMessage, error) {
	return []sqsmanager.SQSMessage{{MessageID: "msg-1", Body: "payload"}}, nil
}

func (m *mockBackend) SendSQSMessage(params sqsmanager.SendSQSMessageParams) (*sqsmanager.SendSQSMessageResult, error) {
	m.lastSQSQueueURL = params.QueueURL
	m.lastSQSBody = params.Body
	return &sqsmanager.SendSQSMessageResult{MessageID: "msg-1"}, nil
}

func (m *mockBackend) CreateSQSQueue(params sqsmanager.CreateQueueParams) (*sqsmanager.SQSQueueSummary, error) {
	return &sqsmanager.SQSQueueSummary{QueueName: params.QueueName, QueueURL: "https://sqs.local/" + params.QueueName}, nil
}

func (m *mockBackend) UpdateSQSQueueAttributes(queueURL string, attributes map[string]string) error {
	return nil
}

func (m *mockBackend) RedriveDLQ(params sqsmanager.RedriveDLQParams) (*sqsmanager.RedriveDLQResult, error) {
	return &sqsmanager.RedriveDLQResult{MessagesMoved: 5}, nil
}

func getFreePort(t *testing.T) int {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to find free port: %v", err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}

func TestServer_LifecycleAndTools(t *testing.T) {
	backend := &mockBackend{
		activeProto: "kafka",
		topics: []kafkamanager.TopicSummary{
			{Name: "orders", PartitionsCount: 3},
			{Name: "users", PartitionsCount: 1},
		},
	}

	server := NewServer(backend)
	port := getFreePort(t)

	// Test Start
	err := server.Start(port, false)
	if err != nil {
		t.Fatalf("failed to start server: %v", err)
	}

	status := server.GetStatus()
	if !status.Running {
		t.Fatal("expected server to be running")
	}
	if status.Port != port {
		t.Errorf("expected port %d, got %d", port, status.Port)
	}

	// Give the server a moment to start
	time.Sleep(50 * time.Millisecond)

	// Test 1: list_actions tool
	ctx := context.Background()
	res, err := server.handleListActions(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{"protocol": "active"},
		},
	})
	if err != nil {
		t.Fatalf("handleListActions failed: %v", err)
	}
	if res.IsError {
		t.Fatalf("handleListActions returned tool error: %+v", res)
	}

	// Test 2: get_action_schema tool
	schemaRes, err := server.handleGetActionSchema(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{"action": "kafka.get_topic_details"},
		},
	})
	if err != nil {
		t.Fatalf("handleGetActionSchema failed: %v", err)
	}
	if schemaRes.IsError {
		t.Fatalf("handleGetActionSchema returned tool error")
	}

	// Test 3: run_action tool
	runRes, err := server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.get_topic_details",
				"params": map[string]any{"topic": "orders"},
			},
		},
	})
	if err != nil {
		t.Fatalf("handleRunAction failed: %v", err)
	}
	if runRes.IsError {
		t.Fatalf("handleRunAction returned error")
	}

	// Test 4: run_action_sequence tool
	batchRes, err := server.handleRunActionSequence(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"steps": []any{
					map[string]any{"id": "s1", "action": "kafka.list_topics"},
					map[string]any{"id": "s2", "action": "kafka.get_topic_details", "params": map[string]any{"topic": "orders"}},
				},
				"stop_on_error": true,
			},
		},
	})
	if err != nil {
		t.Fatalf("handleRunActionSequence failed: %v", err)
	}
	if batchRes.IsError {
		t.Fatalf("handleRunActionSequence returned error")
	}

	// Test Stop
	if err := server.Stop(); err != nil {
		t.Fatalf("failed to stop server: %v", err)
	}

	statusAfter := server.GetStatus()
	if statusAfter.Running {
		t.Fatal("expected server to be stopped")
	}
}

func TestServer_ReadOnlyGuard(t *testing.T) {
	backend := &mockBackend{activeProto: "kafka"}
	server := NewServer(backend)
	port := getFreePort(t)

	err := server.Start(port, true) // Read-Only mode = true
	if err != nil {
		t.Fatalf("failed to start server: %v", err)
	}
	defer server.Stop()

	ctx := context.Background()

	// Attempting a mutating action (kafka.create_topic) should fail due to Read-Only guard
	res, _ := server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.create_topic",
				"params": map[string]any{"topic": "new-topic"},
			},
		},
	})

	if !res.IsError {
		t.Fatal("expected write action to be blocked in read-only mode")
	}
	textContent, ok := mcp.AsTextContent(res.Content[0])
	if !ok {
		t.Fatalf("expected text content")
	}
	if !json.Valid([]byte(textContent.Text)) && len(textContent.Text) == 0 {
		t.Fatal("expected error text message")
	}
	fmt.Printf("Read-only rejection verified: %s\n", textContent.Text)
}

func TestServer_KafkaProducePayloadExtraction(t *testing.T) {
	backend := &mockBackend{activeProto: "kafka"}
	server := NewServer(backend)
	port := getFreePort(t)

	err := server.Start(port, false)
	if err != nil {
		t.Fatalf("failed to start server: %v", err)
	}
	defer server.Stop()

	ctx := context.Background()

	// Case 1: Standard "payload" string
	backend.lastProducedPayload = ""
	res, err := server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.produce_record",
				"params": map[string]any{"topic": "test", "payload": "hello payload"},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("case 1 failed: %v, %+v", err, res)
	}
	if backend.lastProducedPayload != "hello payload" {
		t.Errorf("expected 'hello payload', got '%s'", backend.lastProducedPayload)
	}

	// Case 2: Using "message" alias key
	backend.lastProducedPayload = ""
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.produce_record",
				"params": map[string]any{"topic": "test", "message": "hello message"},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("case 2 failed: %v, %+v", err, res)
	}
	if backend.lastProducedPayload != "hello message" {
		t.Errorf("expected 'hello message', got '%s'", backend.lastProducedPayload)
	}

	// Case 3: Using "value" alias key
	backend.lastProducedPayload = ""
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.produce_record",
				"params": map[string]any{"topic": "test", "value": "hello value"},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("case 3 failed: %v, %+v", err, res)
	}
	if backend.lastProducedPayload != "hello value" {
		t.Errorf("expected 'hello value', got '%s'", backend.lastProducedPayload)
	}

	// Case 4: Passing JSON object directly in payload
	backend.lastProducedPayload = ""
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.produce_record",
				"params": map[string]any{
					"topic": "test",
					"payload": map[string]any{
						"event": "user_created",
						"id":    123,
					},
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("case 4 failed: %v, %+v", err, res)
	}
	if !strings.Contains(backend.lastProducedPayload, `"user_created"`) {
		t.Errorf("expected JSON object marshaled, got '%s'", backend.lastProducedPayload)
	}

	// Case 5: Action alias "kafka.publish_message"
	backend.lastProducedPayload = ""
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.publish_message",
				"params": map[string]any{"topic": "test", "payload": "via alias"},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("case 5 failed: %v, %+v", err, res)
	}
	if backend.lastProducedPayload != "via alias" {
		t.Errorf("expected 'via alias', got '%s'", backend.lastProducedPayload)
	}

	// Case 6: Arguments passed at top level (without "params" envelope)
	backend.lastProducedPayload = ""
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action":  "kafka.produce_record",
				"topic":   "test",
				"message": "top level message",
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("case 6 failed: %v, %+v", err, res)
	}
	if backend.lastProducedPayload != "top level message" {
		t.Errorf("expected 'top level message', got '%s'", backend.lastProducedPayload)
	}

	// Case 7: Empty payload should be rejected with an explicit error
	res, _ = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "kafka.produce_record",
				"params": map[string]any{"topic": "test"},
			},
		},
	})
	if !res.IsError {
		t.Fatal("expected empty payload to be rejected")
	}
}

func TestServer_NatsPayloadAndAliases(t *testing.T) {
	backend := &mockBackend{
		activeProto: "nats",
	}
	server := NewServer(backend)
	ctx := context.Background()

	// Case 1: nats.publish with "topic" and "message" aliases
	res, err := server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "nats.publish",
				"params": map[string]any{
					"topic":   "orders.created",
					"message": "order payload 1",
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("nats case 1 failed: %v, %+v", err, res)
	}
	if backend.lastNatsSubject != "orders.created" || backend.lastNatsPayload != "order payload 1" {
		t.Errorf("expected subject 'orders.created' and payload 'order payload 1', got '%s', '%s'", backend.lastNatsSubject, backend.lastNatsPayload)
	}

	// Case 2: nats.publish with JSON object payload
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "nats.publish",
				"params": map[string]any{
					"subject": "orders.created",
					"payload": map[string]any{"order_id": 999, "status": "approved"},
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("nats case 2 failed: %v, %+v", err, res)
	}
	if !strings.Contains(backend.lastNatsPayload, `"approved"`) {
		t.Errorf("expected serialized JSON, got '%s'", backend.lastNatsPayload)
	}

	// Case 3: nats.publish rejecting empty payload
	res, _ = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "nats.publish",
				"params": map[string]any{"subject": "orders.created"},
			},
		},
	})
	if !res.IsError {
		t.Fatal("expected empty nats.publish payload to be rejected")
	}

	// Case 4: nats.put_kv_entry with "bucket_name", "key", and JSON object value
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "nats.put_kv_entry",
				"params": map[string]any{
					"bucket_name": "app-settings",
					"key":         "theme",
					"value":       map[string]any{"mode": "dark", "fontSize": 14},
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("nats case 4 failed: %v, %+v", err, res)
	}
	if backend.lastKVBucket != "app-settings" || backend.lastKVKey != "theme" {
		t.Errorf("expected bucket 'app-settings', key 'theme', got '%s', '%s'", backend.lastKVBucket, backend.lastKVKey)
	}
	if !strings.Contains(backend.lastKVVal, `"dark"`) {
		t.Errorf("expected serialized JSON for KV value, got '%s'", backend.lastKVVal)
	}

	// Case 5: nats.put_kv_entry rejecting empty value
	res, _ = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "nats.put_kv_entry",
				"params": map[string]any{
					"bucket": "app-settings",
					"key":    "theme",
				},
			},
		},
	})
	if !res.IsError {
		t.Fatal("expected empty nats.put_kv_entry value to be rejected")
	}

	// Case 6: Action alias "nats.send_message"
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "nats.send_message",
				"params": map[string]any{
					"subject": "telemetry.ping",
					"data":    "ping-pong",
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("nats case 6 failed: %v, %+v", err, res)
	}
	if backend.lastNatsSubject != "telemetry.ping" || backend.lastNatsPayload != "ping-pong" {
		t.Errorf("expected 'telemetry.ping' and 'ping-pong', got '%s', '%s'", backend.lastNatsSubject, backend.lastNatsPayload)
	}
}

func TestServer_SQSPayloadAndAliases(t *testing.T) {
	backend := &mockBackend{
		activeProto: "sqs",
		queues: []sqsmanager.SQSQueueSummary{
			{
				QueueName: "order-queue",
				QueueURL:  "https://sqs.us-east-1.amazonaws.com/123456789012/order-queue",
			},
		},
	}
	server := NewServer(backend)
	ctx := context.Background()

	// Case 1: sqs.send_message with short queue name and "message" payload alias
	res, err := server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "sqs.send_message",
				"params": map[string]any{
					"queue":   "order-queue",
					"message": "hello sqs message",
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("sqs case 1 failed: %v, %+v", err, res)
	}
	expectedURL := "https://sqs.us-east-1.amazonaws.com/123456789012/order-queue"
	if backend.lastSQSQueueURL != expectedURL {
		t.Errorf("expected resolved queue URL '%s', got '%s'", expectedURL, backend.lastSQSQueueURL)
	}
	if backend.lastSQSBody != "hello sqs message" {
		t.Errorf("expected body 'hello sqs message', got '%s'", backend.lastSQSBody)
	}

	// Case 2: sqs.send_message with structured JSON object
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "sqs.send_message",
				"params": map[string]any{
					"queue_url": expectedURL,
					"body": map[string]any{
						"customerId": "cust-42",
						"amount":     129.99,
					},
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("sqs case 2 failed: %v, %+v", err, res)
	}
	if !strings.Contains(backend.lastSQSBody, `"cust-42"`) {
		t.Errorf("expected JSON marshaled body, got '%s'", backend.lastSQSBody)
	}

	// Case 3: sqs.send_message rejecting empty body
	res, _ = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "sqs.send_message",
				"params": map[string]any{
					"queue_url": expectedURL,
				},
			},
		},
	})
	if !res.IsError {
		t.Fatal("expected empty sqs body to be rejected")
	}

	// Case 4: Action alias "sqs.publish"
	res, err = server.handleRunAction(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: map[string]any{
				"action": "sqs.publish",
				"params": map[string]any{
					"queue_url": expectedURL,
					"payload":   "via sqs alias",
				},
			},
		},
	})
	if err != nil || res.IsError {
		t.Fatalf("sqs case 4 failed: %v, %+v", err, res)
	}
	if backend.lastSQSBody != "via sqs alias" {
		t.Errorf("expected 'via sqs alias', got '%s'", backend.lastSQSBody)
	}
}
