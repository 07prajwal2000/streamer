package main

import (
	"context"
	"fmt"
	"strconv"

	"streamer/internal/kafkamanager"
	"streamer/internal/mcpserver"
	"streamer/internal/natsmanager"
	"streamer/internal/sqsmanager"
	"streamer/internal/storage"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	storage      *storage.Storage
	natsManager  *natsmanager.NatsManager
	kafkaManager *kafkamanager.KafkaManager
	sqsManager   *sqsmanager.SqsManager
	mcpServer    *mcpserver.Server
	activeProto  string
}

// NewApp creates a new App application struct
func NewApp() *App {
	store, err := storage.NewStorage()
	if err != nil {
		fmt.Printf("Warning: Failed to initialize SQLite storage: %v\n", err)
	}

	mgr := natsmanager.NewNatsManager()
	kmgr := kafkamanager.NewKafkaManager()
	sqsmgr := sqsmanager.NewSqsManager()

	app := &App{
		storage:      store,
		natsManager:  mgr,
		kafkaManager: kmgr,
		sqsManager:   sqsmgr,
	}

	app.mcpServer = mcpserver.NewServer(&mcpBackend{app: app})
	return app
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.natsManager.SetContext(ctx)
	a.kafkaManager.SetContext(ctx)
	a.sqsManager.SetContext(ctx)

	// Auto-start MCP server if enabled in settings
	if a.GetSetting("mcp_auto_start", "false") == "true" {
		portStr := a.GetSetting("mcp_port", "8765")
		port, err := strconv.Atoi(portStr)
		if err != nil || port <= 0 {
			port = 8765
		}
		readOnly := a.GetSetting("mcp_read_only", "false") == "true"
		_ = a.StartMCPServer(port, readOnly)
	}
}

// shutdown is called when the app window closes.
func (a *App) shutdown(ctx context.Context) {
	if a.mcpServer != nil {
		_ = a.mcpServer.Stop()
	}
}

// GetSavedConnections returns all saved profiles from SQLite
func (a *App) GetSavedConnections() ([]storage.ConnectionProfile, error) {
	if a.storage == nil {
		return []storage.ConnectionProfile{}, fmt.Errorf("storage not initialized")
	}
	return a.storage.GetAllConnections()
}

// SaveConnection creates or updates a connection profile
func (a *App) SaveConnection(p storage.ConnectionProfile) error {
	if a.storage == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.storage.SaveConnection(p)
}

// DeleteConnection removes a connection profile
func (a *App) DeleteConnection(id string) error {
	if a.storage == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.storage.DeleteConnection(id)
}

// TestConnection verifies connectivity without disconnecting active connection
func (a *App) TestConnection(p storage.ConnectionProfile) (*natsmanager.ServerStatus, error) {
	if p.Protocol == "kafka" {
		ks, err := a.kafkaManager.TestConnection(p)
		if err != nil {
			return nil, err
		}
		return &natsmanager.ServerStatus{
			Connected:        ks.Connected,
			Protocol:         "kafka",
			CurrentProfileID: ks.CurrentProfileID,
			ClusterID:        ks.ClusterID,
			ControllerID:     ks.ControllerID,
			BrokersCount:     ks.BrokersCount,
			TopicsCount:      ks.TopicsCount,
			PartitionsCount:  ks.PartitionsCount,
			RTTMs:            ks.RTTMs,
			ServerVersion:    "Kafka / Redpanda",
		}, nil
	} else if p.Protocol == "sqs" {
		sqsStatus, err := a.sqsManager.TestConnection(p)
		if err != nil {
			return nil, err
		}
		return &natsmanager.ServerStatus{
			Connected:        sqsStatus.Connected,
			Protocol:         "sqs",
			CurrentProfileID: sqsStatus.CurrentProfileID,
			ClusterID:        sqsStatus.Endpoint,
			ServerVersion:    sqsStatus.Region,
			TopicsCount:      sqsStatus.QueuesCount,
			RTTMs:            sqsStatus.RTTMs,
		}, nil
	}
	return a.natsManager.TestConnection(p)
}

// Connect establishes active connection to a profile and auto-saves credentials to SQLite
func (a *App) Connect(p storage.ConnectionProfile) (*natsmanager.ServerStatus, error) {
	if p.Protocol == "kafka" {
		a.natsManager.Disconnect()
		a.sqsManager.Disconnect()
		ks, err := a.kafkaManager.Connect(p)
		if err == nil && a.storage != nil {
			a.activeProto = "kafka"
			_ = a.storage.SaveConnection(p)
			_ = a.storage.UpdateLastConnected(p.ID)
		}
		if err != nil {
			return nil, err
		}
		status := &natsmanager.ServerStatus{
			Connected:        ks.Connected,
			Connecting:       ks.Connecting,
			Protocol:         "kafka",
			CurrentProfileID: ks.CurrentProfileID,
			ClusterID:        ks.ClusterID,
			ControllerID:     ks.ControllerID,
			BrokersCount:     ks.BrokersCount,
			TopicsCount:      ks.TopicsCount,
			PartitionsCount:  ks.PartitionsCount,
			RTTMs:            ks.RTTMs,
			ServerVersion:    "Kafka / Redpanda",
		}
		return status, nil
	} else if p.Protocol == "sqs" {
		a.natsManager.Disconnect()
		a.kafkaManager.Disconnect()
		sqsStatus, err := a.sqsManager.Connect(p)
		if err == nil && a.storage != nil {
			a.activeProto = "sqs"
			_ = a.storage.SaveConnection(p)
			_ = a.storage.UpdateLastConnected(p.ID)
		}
		if err != nil {
			return nil, err
		}
		status := &natsmanager.ServerStatus{
			Connected:        sqsStatus.Connected,
			Connecting:       sqsStatus.Connecting,
			Protocol:         "sqs",
			CurrentProfileID: sqsStatus.CurrentProfileID,
			ClusterID:        sqsStatus.Endpoint,
			ServerVersion:    sqsStatus.Region,
			TopicsCount:      sqsStatus.QueuesCount,
			RTTMs:            sqsStatus.RTTMs,
		}
		return status, nil
	}

	a.kafkaManager.Disconnect()
	a.sqsManager.Disconnect()
	status, err := a.natsManager.Connect(p)
	if err == nil && a.storage != nil {
		a.activeProto = "nats"
		_ = a.storage.SaveConnection(p)
		_ = a.storage.UpdateLastConnected(p.ID)
	}
	return status, err
}

// Disconnect closes the active connection
func (a *App) Disconnect() {
	a.natsManager.Disconnect()
	a.kafkaManager.Disconnect()
	a.sqsManager.Disconnect()
	a.activeProto = ""
}

// GetConnectionStatus returns current active connection status
func (a *App) GetConnectionStatus() natsmanager.ServerStatus {
	if a.activeProto == "kafka" {
		ks := a.kafkaManager.GetStatus()
		return natsmanager.ServerStatus{
			Connected:        ks.Connected,
			Connecting:       ks.Connecting,
			Protocol:         "kafka",
			LastError:        ks.LastError,
			CurrentProfileID: ks.CurrentProfileID,
			ClusterID:        ks.ClusterID,
			ControllerID:     ks.ControllerID,
			BrokersCount:     ks.BrokersCount,
			TopicsCount:      ks.TopicsCount,
			PartitionsCount:  ks.PartitionsCount,
			RTTMs:            ks.RTTMs,
			ServerVersion:    "Kafka / Redpanda",
		}
	} else if a.activeProto == "sqs" {
		sqsStatus := a.sqsManager.GetStatus()
		return natsmanager.ServerStatus{
			Connected:        sqsStatus.Connected,
			Connecting:       sqsStatus.Connecting,
			Protocol:         "sqs",
			LastError:        sqsStatus.LastError,
			CurrentProfileID: sqsStatus.CurrentProfileID,
			ClusterID:        sqsStatus.Endpoint,
			ServerVersion:    sqsStatus.Region,
			TopicsCount:      sqsStatus.QueuesCount,
			RTTMs:            sqsStatus.RTTMs,
		}
	}
	return a.natsManager.GetStatus()
}

// GetSQSStatus returns dedicated SQS telemetry
func (a *App) GetSQSStatus() sqsmanager.SQSClusterStatus {
	return a.sqsManager.GetStatus()
}

// SelectFile opens a native file dialog for selecting creds/certs
func (a *App) SelectFile(title string, filterName string, filterPatterns string) (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
		Filters: []runtime.FileFilter{
			{
				DisplayName: filterName,
				Pattern:     filterPatterns,
			},
		},
	})
}

// -------------------------------------------------------------
// Pub/Sub API Bindings
// -------------------------------------------------------------

// Subscribe starts listening to a subject (with optional queue group)
func (a *App) Subscribe(id string, subject string, queueGroup string) (*natsmanager.SubscriptionInfo, error) {
	return a.natsManager.Subscribe(id, subject, queueGroup)
}

// Unsubscribe stops listening to a subject
func (a *App) Unsubscribe(id string) error {
	return a.natsManager.Unsubscribe(id)
}

// GetActiveSubscriptions returns all active subscriptions
func (a *App) GetActiveSubscriptions() []natsmanager.SubscriptionInfo {
	return a.natsManager.GetSubscriptions()
}

// PublishMessage sends a message with optional reply-to subject and headers
func (a *App) PublishMessage(subject string, replyTo string, headers map[string][]string, payload string) error {
	return a.natsManager.Publish(subject, replyTo, headers, []byte(payload))
}

// RequestMessage sends a request message and waits synchronously for a response
func (a *App) RequestMessage(subject string, headers map[string][]string, payload string, timeoutMs int) (*natsmanager.PubSubMessage, error) {
	return a.natsManager.Request(subject, headers, []byte(payload), timeoutMs)
}

// -------------------------------------------------------------
// Settings API Bindings
// -------------------------------------------------------------

func (a *App) GetSetting(key string, defaultValue string) string {
	if a.storage == nil {
		return defaultValue
	}
	return a.storage.GetSetting(key, defaultValue)
}

func (a *App) SetSetting(key string, value string) error {
	if a.storage == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.storage.SetSetting(key, value)
}

// -------------------------------------------------------------
// JetStream API Bindings
// -------------------------------------------------------------

func (a *App) ListStreams() ([]natsmanager.JSStreamInfo, error) {
	return a.natsManager.ListStreams(a.ctx)
}

func (a *App) CreateStream(p natsmanager.StreamCreateParams) error {
	return a.natsManager.CreateStream(a.ctx, p)
}

func (a *App) UpdateStream(p natsmanager.StreamCreateParams) error {
	return a.natsManager.UpdateStream(a.ctx, p)
}

func (a *App) DeleteStream(name string) error {
	return a.natsManager.DeleteStream(a.ctx, name)
}

func (a *App) PurgeStream(name string, subject string, seq uint64) error {
	return a.natsManager.PurgeStream(a.ctx, name, subject, seq)
}

func (a *App) GetStreamMsg(streamName string, seq uint64) (*natsmanager.JSStoredMsg, error) {
	return a.natsManager.GetStreamMsg(a.ctx, streamName, seq)
}

func (a *App) GetStreamMsgsBatch(streamName string, startSeq uint64, limit int, reverse bool) ([]natsmanager.JSStoredMsg, error) {
	return a.natsManager.GetStreamMsgsBatch(a.ctx, streamName, startSeq, limit, reverse)
}

func (a *App) DeleteStreamMsg(streamName string, seq uint64) error {
	return a.natsManager.DeleteStreamMsg(a.ctx, streamName, seq)
}

func (a *App) ListConsumers(streamName string) ([]natsmanager.JSConsumerInfo, error) {
	return a.natsManager.ListConsumers(a.ctx, streamName)
}

func (a *App) CreateConsumer(p natsmanager.ConsumerCreateParams) error {
	return a.natsManager.CreateConsumer(a.ctx, p)
}

func (a *App) DeleteConsumer(streamName string, consumerName string) error {
	return a.natsManager.DeleteConsumer(a.ctx, streamName, consumerName)
}

// -------------------------------------------------------------
// Key-Value (KV) Store API Bindings
// -------------------------------------------------------------

func (a *App) ListKVBuckets() ([]natsmanager.KVBucketInfo, error) {
	return a.natsManager.ListKVBuckets(a.ctx)
}

func (a *App) GetKVBucket(bucket string) (*natsmanager.KVBucketInfo, error) {
	return a.natsManager.GetKVBucket(a.ctx, bucket)
}

func (a *App) CreateKVBucket(p natsmanager.KVBucketCreateParams) error {
	return a.natsManager.CreateKVBucket(a.ctx, p)
}

func (a *App) UpdateKVBucket(p natsmanager.KVBucketCreateParams) error {
	return a.natsManager.UpdateKVBucket(a.ctx, p)
}

func (a *App) DeleteKVBucket(bucket string) error {
	return a.natsManager.DeleteKVBucket(a.ctx, bucket)
}

func (a *App) PurgeKVDeletes(bucket string) error {
	return a.natsManager.PurgeKVDeletes(a.ctx, bucket)
}

func (a *App) ListKVEntries(bucket string) ([]natsmanager.KVEntryInfo, error) {
	return a.natsManager.ListKVEntries(a.ctx, bucket)
}

func (a *App) GetKVEntry(bucket string, key string) (*natsmanager.KVEntryInfo, error) {
	return a.natsManager.GetKVEntry(a.ctx, bucket, key)
}

func (a *App) PutKVEntry(bucket string, key string, val string) (uint64, error) {
	return a.natsManager.PutKVEntry(a.ctx, bucket, key, val)
}

func (a *App) DeleteKVEntry(bucket string, key string) error {
	return a.natsManager.DeleteKVEntry(a.ctx, bucket, key)
}

func (a *App) PurgeKVEntry(bucket string, key string) error {
	return a.natsManager.PurgeKVEntry(a.ctx, bucket, key)
}

func (a *App) GetKVHistory(bucket string, key string) ([]natsmanager.KVEntryInfo, error) {
	return a.natsManager.GetKVHistory(a.ctx, bucket, key)
}

// -------------------------------------------------------------
// Kafka API Bindings
// -------------------------------------------------------------

func (a *App) GetKafkaClusterStatus() kafkamanager.KafkaClusterStatus {
	return a.kafkaManager.GetStatus()
}

func (a *App) GetKafkaBrokers() ([]kafkamanager.BrokerInfo, error) {
	return a.kafkaManager.GetBrokers(a.ctx)
}

func (a *App) GetKafkaBrokerConfigs(nodeID int32) ([]kafkamanager.BrokerConfigEntry, error) {
	return a.kafkaManager.GetBrokerConfigs(a.ctx, nodeID)
}

func (a *App) ListKafkaTopics(includeInternal bool) ([]kafkamanager.TopicSummary, error) {
	return a.kafkaManager.ListTopics(a.ctx, includeInternal)
}

func (a *App) GetKafkaTopicDetails(topic string) (*kafkamanager.TopicDetailInfo, error) {
	return a.kafkaManager.GetTopicDetails(a.ctx, topic)
}

func (a *App) CreateKafkaTopic(params kafkamanager.CreateTopicParams) error {
	return a.kafkaManager.CreateTopic(a.ctx, params)
}

func (a *App) DeleteKafkaTopic(topic string) error {
	return a.kafkaManager.DeleteTopic(a.ctx, topic)
}

func (a *App) UpdateKafkaTopicPartitions(topic string, newTotal int) error {
	return a.kafkaManager.UpdateTopicPartitions(a.ctx, topic, newTotal)
}

func (a *App) UpdateKafkaTopicConfigs(topic string, configs map[string]string) error {
	return a.kafkaManager.UpdateTopicConfigs(a.ctx, topic, configs)
}

func (a *App) PurgeKafkaTopic(topic string) error {
	return a.kafkaManager.PurgeTopicMessages(a.ctx, topic)
}

func (a *App) PurgeKafkaPartition(topic string, partition int32) error {
	return a.kafkaManager.PurgePartitionMessages(a.ctx, topic, partition)
}

func (a *App) DeleteKafkaRecordsUpTo(topic string, partition int32, offset int64) error {
	return a.kafkaManager.DeleteRecordsUpTo(a.ctx, topic, partition, offset)
}

func (a *App) ListKafkaConsumerGroups() ([]kafkamanager.ConsumerGroupSummary, error) {
	return a.kafkaManager.ListConsumerGroups(a.ctx)
}

func (a *App) GetKafkaConsumerGroupDetails(group string) (*kafkamanager.ConsumerGroupDetailInfo, error) {
	return a.kafkaManager.GetConsumerGroupDetails(a.ctx, group)
}

func (a *App) ResetKafkaConsumerGroupOffsets(params kafkamanager.ResetOffsetsParams) error {
	return a.kafkaManager.ResetConsumerGroupOffsets(a.ctx, params)
}

func (a *App) DeleteKafkaConsumerGroup(group string) error {
	return a.kafkaManager.DeleteConsumerGroup(a.ctx, group)
}

func (a *App) GetKafkaMessages(params kafkamanager.GetKafkaMessagesParams) ([]kafkamanager.KafkaRecord, error) {
	return a.kafkaManager.GetKafkaMessages(a.ctx, params)
}

func (a *App) StartKafkaLiveTail(topic string, partitions []int32) error {
	return a.kafkaManager.StartKafkaLiveTail(topic, partitions)
}

func (a *App) StopKafkaLiveTail() {
	a.kafkaManager.StopKafkaLiveTail()
}

func (a *App) ProduceKafkaRecord(params kafkamanager.ProduceKafkaRecordParams) (*kafkamanager.ProduceRecordResult, error) {
	return a.kafkaManager.ProduceKafkaRecord(a.ctx, params)
}

// --- Amazon SQS Bindings ---

func (a *App) ListSQSQueues(prefix string) ([]sqsmanager.SQSQueueSummary, error) {
	return a.sqsManager.ListQueues(a.ctx, prefix)
}

func (a *App) GetSQSQueueDetails(queueURL string) (*sqsmanager.SQSQueueDetail, error) {
	return a.sqsManager.GetQueueDetails(a.ctx, queueURL)
}

func (a *App) CreateSQSQueue(params sqsmanager.CreateQueueParams) (*sqsmanager.SQSQueueSummary, error) {
	return a.sqsManager.CreateQueue(a.ctx, params)
}

func (a *App) DeleteSQSQueue(queueURL string) error {
	return a.sqsManager.DeleteQueue(a.ctx, queueURL)
}

func (a *App) PurgeSQSQueue(queueURL string) error {
	return a.sqsManager.PurgeQueue(a.ctx, queueURL)
}

func (a *App) UpdateSQSQueueAttributes(queueURL string, attributes map[string]string) error {
	return a.sqsManager.UpdateQueueAttributes(a.ctx, queueURL, attributes)
}

func (a *App) UpdateSQSQueueTags(queueURL string, tags map[string]string, removeKeys []string) error {
	return a.sqsManager.UpdateQueueTags(a.ctx, queueURL, tags, removeKeys)
}

func (a *App) SendSQSMessage(params sqsmanager.SendSQSMessageParams) (*sqsmanager.SendSQSMessageResult, error) {
	return a.sqsManager.SendMessage(a.ctx, params)
}

func (a *App) PollSQSMessages(params sqsmanager.PollSQSMessagesParams) ([]sqsmanager.SQSMessage, error) {
	return a.sqsManager.PollMessages(a.ctx, params)
}

func (a *App) StartSQSLivePoll(params sqsmanager.PollSQSMessagesParams) error {
	return a.sqsManager.StartSQSLivePoll(params)
}

func (a *App) StopSQSLivePoll() error {
	return a.sqsManager.StopSQSLivePoll()
}

func (a *App) DeleteSQSMessage(queueURL string, receiptHandle string) error {
	return a.sqsManager.DeleteMessage(a.ctx, queueURL, receiptHandle)
}

func (a *App) ChangeSQSMessageVisibility(queueURL string, receiptHandle string, visibilityTimeout int32) error {
	return a.sqsManager.ChangeMessageVisibility(a.ctx, queueURL, receiptHandle, visibilityTimeout)
}

func (a *App) RedriveDLQ(params sqsmanager.RedriveDLQParams) (*sqsmanager.RedriveDLQResult, error) {
	return a.sqsManager.RedriveDLQ(a.ctx, params)
}

// -------------------------------------------------------------
// Model Context Protocol (MCP) Server Bindings
// -------------------------------------------------------------

// StartMCPServer starts the embedded MCP SSE server on the specified port
func (a *App) StartMCPServer(port int, readOnly bool) error {
	if a.mcpServer == nil {
		return fmt.Errorf("MCP server not initialized")
	}
	return a.mcpServer.Start(port, readOnly)
}

// StopMCPServer gracefully stops the running MCP server
func (a *App) StopMCPServer() error {
	if a.mcpServer == nil {
		return nil
	}
	return a.mcpServer.Stop()
}

// GetMCPServerStatus returns the current status and metrics of the MCP server
func (a *App) GetMCPServerStatus() mcpserver.ServerStatus {
	if a.mcpServer == nil {
		return mcpserver.ServerStatus{Running: false, Port: 8765, URL: "http://127.0.0.1:8765/sse"}
	}
	return a.mcpServer.GetStatus()
}

// -------------------------------------------------------------
// mcpBackend Adapter: implements mcpserver.StreamerBackend
// -------------------------------------------------------------

type mcpBackend struct {
	app *App
}

func (m *mcpBackend) GetActiveProtocol() string {
	return m.app.activeProto
}

func (m *mcpBackend) GetConnectionStatus() (any, error) {
	return m.app.GetConnectionStatus(), nil
}

func (m *mcpBackend) ListSavedConnections() (any, error) {
	return m.app.GetSavedConnections()
}

func (m *mcpBackend) ConnectProfile(id string) error {
	if m.app.storage == nil {
		return fmt.Errorf("storage not initialized")
	}
	p, err := m.app.storage.GetConnection(id)
	if err != nil {
		return fmt.Errorf("connection profile '%s' not found: %w", id, err)
	}
	_, err = m.app.Connect(*p)
	return err
}

func (m *mcpBackend) ListKafkaTopics(includeInternal bool) ([]kafkamanager.TopicSummary, error) {
	return m.app.ListKafkaTopics(includeInternal)
}

func (m *mcpBackend) GetKafkaTopicDetails(topic string) (*kafkamanager.TopicDetailInfo, error) {
	return m.app.GetKafkaTopicDetails(topic)
}

func (m *mcpBackend) GetKafkaBrokers() ([]kafkamanager.BrokerInfo, error) {
	return m.app.GetKafkaBrokers()
}

func (m *mcpBackend) ListKafkaConsumerGroups() ([]kafkamanager.ConsumerGroupSummary, error) {
	return m.app.ListKafkaConsumerGroups()
}

func (m *mcpBackend) GetKafkaConsumerGroupDetails(group string) (*kafkamanager.ConsumerGroupDetailInfo, error) {
	return m.app.GetKafkaConsumerGroupDetails(group)
}

func (m *mcpBackend) GetKafkaMessages(params kafkamanager.GetKafkaMessagesParams) ([]kafkamanager.KafkaRecord, error) {
	return m.app.GetKafkaMessages(params)
}

func (m *mcpBackend) ProduceKafkaRecord(params kafkamanager.ProduceKafkaRecordParams) (*kafkamanager.ProduceRecordResult, error) {
	return m.app.ProduceKafkaRecord(params)
}

func (m *mcpBackend) CreateKafkaTopic(params kafkamanager.CreateTopicParams) error {
	return m.app.CreateKafkaTopic(params)
}

func (m *mcpBackend) UpdateKafkaTopicPartitions(topic string, newTotal int) error {
	return m.app.UpdateKafkaTopicPartitions(topic, newTotal)
}

func (m *mcpBackend) UpdateKafkaTopicConfigs(topic string, configs map[string]string) error {
	return m.app.UpdateKafkaTopicConfigs(topic, configs)
}

func (m *mcpBackend) PublishNats(subject string, replyTo string, headers map[string][]string, payload string) error {
	return m.app.PublishMessage(subject, replyTo, headers, payload)
}

func (m *mcpBackend) RequestNats(subject string, headers map[string][]string, payload string, timeoutMs int) (any, error) {
	return m.app.RequestMessage(subject, headers, payload, timeoutMs)
}

func (m *mcpBackend) ListNatsStreams() ([]natsmanager.JSStreamInfo, error) {
	return m.app.ListStreams()
}

func (m *mcpBackend) GetNatsStreamMessages(stream string, startSeq uint64, limit int, reverse bool) ([]natsmanager.JSStoredMsg, error) {
	return m.app.GetStreamMsgsBatch(stream, startSeq, limit, reverse)
}

func (m *mcpBackend) CreateNatsStream(params natsmanager.StreamCreateParams) error {
	return m.app.CreateStream(params)
}

func (m *mcpBackend) ListNatsKVBuckets() ([]natsmanager.KVBucketInfo, error) {
	return m.app.ListKVBuckets()
}

func (m *mcpBackend) GetNatsKVEntry(bucket string, key string) (*natsmanager.KVEntryInfo, error) {
	return m.app.GetKVEntry(bucket, key)
}

func (m *mcpBackend) PutNatsKVEntry(bucket string, key string, val string) (uint64, error) {
	return m.app.PutKVEntry(bucket, key, val)
}

func (m *mcpBackend) ListSQSQueues(prefix string) ([]sqsmanager.SQSQueueSummary, error) {
	return m.app.ListSQSQueues(prefix)
}

func (m *mcpBackend) GetSQSQueueDetails(queueURL string) (*sqsmanager.SQSQueueDetail, error) {
	return m.app.GetSQSQueueDetails(queueURL)
}

func (m *mcpBackend) PollSQSMessages(params sqsmanager.PollSQSMessagesParams) ([]sqsmanager.SQSMessage, error) {
	return m.app.PollSQSMessages(params)
}

func (m *mcpBackend) SendSQSMessage(params sqsmanager.SendSQSMessageParams) (*sqsmanager.SendSQSMessageResult, error) {
	return m.app.SendSQSMessage(params)
}

func (m *mcpBackend) CreateSQSQueue(params sqsmanager.CreateQueueParams) (*sqsmanager.SQSQueueSummary, error) {
	return m.app.CreateSQSQueue(params)
}

func (m *mcpBackend) UpdateSQSQueueAttributes(queueURL string, attributes map[string]string) error {
	return m.app.UpdateSQSQueueAttributes(queueURL, attributes)
}

func (m *mcpBackend) RedriveDLQ(params sqsmanager.RedriveDLQParams) (*sqsmanager.RedriveDLQResult, error) {
	return m.app.RedriveDLQ(params)
}
