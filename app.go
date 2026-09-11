package main

import (
	"context"
	"fmt"

	"streamer/internal/kafkamanager"
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

	return &App{
		storage:      store,
		natsManager:  mgr,
		kafkaManager: kmgr,
		sqsManager:   sqsmgr,
	}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.natsManager.SetContext(ctx)
	a.kafkaManager.SetContext(ctx)
	a.sqsManager.SetContext(ctx)
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
