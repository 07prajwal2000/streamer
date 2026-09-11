package mcpserver

import (
	"context"
	"time"

	"streamer/internal/kafkamanager"
	"streamer/internal/natsmanager"
	"streamer/internal/sqsmanager"
)

// ServerStatus describes the runtime status of the embedded MCP server
type ServerStatus struct {
	Running      bool       `json:"running"`
	Port         int        `json:"port"`
	URL          string     `json:"url"`
	ReadOnly     bool       `json:"readOnly"`
	StartedAt    *time.Time `json:"startedAt,omitempty"`
	ErrorMessage string     `json:"errorMessage,omitempty"`
}

// ActionParam describes a parameter accepted by an action
type ActionParam struct {
	Name        string `json:"name"`
	Type        string `json:"type"` // "string", "number", "integer", "boolean", "object", "array"
	Description string `json:"description"`
	Required    bool   `json:"required"`
	Default     any    `json:"default,omitempty"`
}

// ActionDefinition defines an internal action that can be executed via the meta-tools
type ActionDefinition struct {
	Action      string                                                        `json:"action"`
	Namespace   string                                                        `json:"namespace"` // "system", "kafka", "nats", "sqs"
	Description string                                                        `json:"description"`
	ReadOnly    bool                                                          `json:"read_only"`
	Parameters  []ActionParam                                                 `json:"parameters"`
	Handler     func(ctx context.Context, b StreamerBackend, params map[string]any) (any, error)
}

// SequenceStep defines a single execution step in a run_action_sequence call
type SequenceStep struct {
	ID     string         `json:"id"`
	Action string         `json:"action"`
	Params map[string]any `json:"params,omitempty"`
}

// StreamerBackend specifies the capabilities exposed by Streamer to the MCP server
type StreamerBackend interface {
	GetActiveProtocol() string
	GetConnectionStatus() (any, error)
	ListSavedConnections() (any, error)
	ConnectProfile(id string) error

	// Kafka
	ListKafkaTopics(includeInternal bool) ([]kafkamanager.TopicSummary, error)
	GetKafkaTopicDetails(topic string) (*kafkamanager.TopicDetailInfo, error)
	GetKafkaBrokers() ([]kafkamanager.BrokerInfo, error)
	ListKafkaConsumerGroups() ([]kafkamanager.ConsumerGroupSummary, error)
	GetKafkaConsumerGroupDetails(group string) (*kafkamanager.ConsumerGroupDetailInfo, error)
	GetKafkaMessages(params kafkamanager.GetKafkaMessagesParams) ([]kafkamanager.KafkaRecord, error)
	ProduceKafkaRecord(params kafkamanager.ProduceKafkaRecordParams) (*kafkamanager.ProduceRecordResult, error)
	CreateKafkaTopic(params kafkamanager.CreateTopicParams) error
	UpdateKafkaTopicPartitions(topic string, newTotal int) error
	UpdateKafkaTopicConfigs(topic string, configs map[string]string) error

	// NATS
	PublishNats(subject string, replyTo string, headers map[string][]string, payload string) error
	RequestNats(subject string, headers map[string][]string, payload string, timeoutMs int) (any, error)
	ListNatsStreams() ([]natsmanager.JSStreamInfo, error)
	GetNatsStreamMessages(stream string, startSeq uint64, limit int, reverse bool) ([]natsmanager.JSStoredMsg, error)
	CreateNatsStream(params natsmanager.StreamCreateParams) error
	ListNatsKVBuckets() ([]natsmanager.KVBucketInfo, error)
	GetNatsKVEntry(bucket string, key string) (*natsmanager.KVEntryInfo, error)
	PutNatsKVEntry(bucket string, key string, val string) (uint64, error)

	// SQS
	ListSQSQueues(prefix string) ([]sqsmanager.SQSQueueSummary, error)
	GetSQSQueueDetails(queueURL string) (*sqsmanager.SQSQueueDetail, error)
	PollSQSMessages(params sqsmanager.PollSQSMessagesParams) ([]sqsmanager.SQSMessage, error)
	SendSQSMessage(params sqsmanager.SendSQSMessageParams) (*sqsmanager.SendSQSMessageResult, error)
	CreateSQSQueue(params sqsmanager.CreateQueueParams) (*sqsmanager.SQSQueueSummary, error)
	UpdateSQSQueueAttributes(queueURL string, attributes map[string]string) error
	RedriveDLQ(params sqsmanager.RedriveDLQParams) (*sqsmanager.RedriveDLQResult, error)
}
