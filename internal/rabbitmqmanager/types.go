package rabbitmqmanager

// RMQClusterStatus captures connection status and telemetry of the connected RabbitMQ endpoint
type RMQClusterStatus struct {
	Connected           bool             `json:"connected"`
	Connecting          bool             `json:"connecting"`
	Protocol            string           `json:"protocol"` // "rabbitmq"
	LastError           string           `json:"lastError,omitempty"`
	CurrentProfileID    string           `json:"currentProfileId,omitempty"`
	Endpoint            string           `json:"endpoint"`
	ManagementURL       string           `json:"managementUrl,omitempty"`
	ManagementAvailable bool             `json:"managementAvailable"`
	VHost               string           `json:"vhost"`
	ClusterName         string           `json:"clusterName,omitempty"`
	RabbitMQVersion     string           `json:"rabbitmqVersion,omitempty"`
	ErlangVersion       string           `json:"erlangVersion,omitempty"`
	QueuesCount         int              `json:"queuesCount"`
	ExchangesCount      int              `json:"exchangesCount"`
	ConnectionsCount    int              `json:"connectionsCount"`
	ChannelsCount       int              `json:"channelsCount"`
	ConsumersCount      int              `json:"consumersCount"`
	RTTMs               float64          `json:"rttMs"`
	DiskFreeAlarm       bool             `json:"diskFreeAlarm"`
	MemoryAlarm         bool             `json:"memoryAlarm"`
	MessageRates        *RMQMessageRates `json:"messageRates,omitempty"`
}

// RMQMessageRates captures cluster or queue level throughput metrics
type RMQMessageRates struct {
	PublishRate float64 `json:"publishRate"`
	DeliverRate float64 `json:"deliverRate"`
	AckRate     float64 `json:"ackRate"`
}

// RMQOverview represents detailed cluster overview metrics
type RMQOverview struct {
	ClusterName      string          `json:"clusterName"`
	RabbitMQVersion  string          `json:"rabbitmqVersion"`
	ErlangVersion    string          `json:"erlangVersion"`
	TotalQueues      int             `json:"totalQueues"`
	TotalExchanges   int             `json:"totalExchanges"`
	TotalConnections int             `json:"totalConnections"`
	TotalChannels    int             `json:"totalChannels"`
	TotalConsumers   int             `json:"totalConsumers"`
	TotalMessages    int64           `json:"totalMessages"`
	MessagesReady    int64           `json:"messagesReady"`
	MessagesUnack    int64           `json:"messagesUnack"`
	MessageRates     RMQMessageRates `json:"messageRates"`
	DiskFreeAlarm    bool            `json:"diskFreeAlarm"`
	MemoryAlarm      bool            `json:"memoryAlarm"`
	VHosts           []string        `json:"vhosts"`
}

// RMQNodeInfo represents a cluster node and its system resource statistics
type RMQNodeInfo struct {
	Name            string  `json:"name"`
	Type            string  `json:"type"`
	Running         bool    `json:"running"`
	UptimeSeconds   int64   `json:"uptimeSeconds"`
	MemUsed         uint64  `json:"memUsed"`
	MemLimit        uint64  `json:"memLimit"`
	MemAlarm        bool    `json:"memAlarm"`
	DiskFree        uint64  `json:"diskFree"`
	DiskFreeLimit   uint64  `json:"diskFreeLimit"`
	DiskFreeAlarm   bool    `json:"diskFreeAlarm"`
	FDUsed          int     `json:"fdUsed"`
	FDTotal         int     `json:"fdTotal"`
	SocketsUsed     int     `json:"socketsUsed"`
	SocketsTotal    int     `json:"socketsTotal"`
	ProcessorsCount int     `json:"processorsCount"`
	ErlangProcesses int     `json:"erlangProcesses"`
}

// RMQVHostInfo represents virtual host metadata
type RMQVHostInfo struct {
	Name                   string          `json:"name"`
	Messages               int64           `json:"messages"`
	MessagesReady          int64           `json:"messagesReady"`
	MessagesUnacknowledged int64           `json:"messagesUnacknowledged"`
	Tracing                bool            `json:"tracing"`
	MessageRates           RMQMessageRates `json:"messageRates"`
}

// RMQQueueSummary represents high-level metrics for a queue in the queues list
type RMQQueueSummary struct {
	Name                   string                 `json:"name"`
	VHost                  string                 `json:"vhost"`
	Type                   string                 `json:"type"` // "classic", "quorum", "stream"
	Durable                bool                   `json:"durable"`
	AutoDelete             bool                   `json:"autoDelete"`
	Exclusive              bool                   `json:"exclusive"`
	State                  string                 `json:"state"` // "running", "idle", etc.
	Messages               int64                  `json:"messages"`
	MessagesReady          int64                  `json:"messagesReady"`
	MessagesUnacknowledged int64                  `json:"messagesUnacknowledged"`
	Consumers              int                    `json:"consumers"`
	Memory                 int64                  `json:"memory"`
	LeaderNode             string                 `json:"leaderNode,omitempty"`
	MessageRates           RMQMessageRates        `json:"messageRates"`
	Arguments              map[string]interface{} `json:"arguments,omitempty"`
	HasDLX                 bool                   `json:"hasDlx"`
	DLXTarget              string                 `json:"dlxTarget,omitempty"`
	DLXRoutingKey          string                 `json:"dlxRoutingKey,omitempty"`
}

// RMQConsumerInfo represents an active consumer attached to a queue
type RMQConsumerInfo struct {
	ConsumerTag string `json:"consumerTag"`
	ChannelPid  string `json:"channelPid"`
	Prefetch    int    `json:"prefetch"`
	AckRequired bool   `json:"ackRequired"`
	Exclusive   bool   `json:"exclusive"`
	Active      bool   `json:"active"`
}

// RMQQueueDetail contains comprehensive attributes, consumers, and bindings for a queue
type RMQQueueDetail struct {
	RMQQueueSummary
	ConsumersList []RMQConsumerInfo `json:"consumersList"`
	Bindings      []RMQBindingInfo  `json:"bindings"`
}

// CreateQueueParams defines options when creating a RabbitMQ queue
type CreateQueueParams struct {
	Name                 string                 `json:"name"`
	VHost                string                 `json:"vhost"`
	Type                 string                 `json:"type"` // "classic", "quorum", "stream"
	Durable              bool                   `json:"durable"`
	AutoDelete           bool                   `json:"autoDelete"`
	Exclusive            bool                   `json:"exclusive"`
	MessageTTL           int64                  `json:"messageTtl,omitempty"`      // x-message-ttl (ms)
	AutoExpire           int64                  `json:"autoExpire,omitempty"`      // x-expires (ms)
	MaxLength            int64                  `json:"maxLength,omitempty"`       // x-max-length
	MaxLengthBytes       int64                  `json:"maxLengthBytes,omitempty"`  // x-max-length-bytes
	MaxPriority          int32                  `json:"maxPriority,omitempty"`     // x-max-priority
	DeadLetterExchange   string                 `json:"deadLetterExchange,omitempty"`   // x-dead-letter-exchange
	DeadLetterRoutingKey string                 `json:"deadLetterRoutingKey,omitempty"`// x-dead-letter-routing-key
	Overflow             string                 `json:"overflow,omitempty"`        // "drop-head", "reject-publish", "reject-publish-dlx"
	DeliveryLimit        int32                  `json:"deliveryLimit,omitempty"`   // x-delivery-limit (for quorum queues)
	CustomArguments      map[string]interface{} `json:"customArguments,omitempty"`
}

// RMQExchangeSummary represents high-level metrics for an exchange
type RMQExchangeSummary struct {
	Name         string                 `json:"name"`
	VHost        string                 `json:"vhost"`
	Type         string                 `json:"type"` // "direct", "fanout", "topic", "headers"
	Durable      bool                   `json:"durable"`
	AutoDelete   bool                   `json:"autoDelete"`
	Internal     bool                   `json:"internal"`
	Arguments    map[string]interface{} `json:"arguments,omitempty"`
	MessageRates RMQMessageRates        `json:"messageRates"`
}

// RMQExchangeDetail contains exchange summary and its associated bindings
type RMQExchangeDetail struct {
	RMQExchangeSummary
	BindingsSource      []RMQBindingInfo `json:"bindingsSource"`      // Bindings where exchange is source
	BindingsDestination []RMQBindingInfo `json:"bindingsDestination"` // Bindings where exchange is destination
}

// CreateExchangeParams defines options when creating a RabbitMQ exchange
type CreateExchangeParams struct {
	Name            string                 `json:"name"`
	VHost           string                 `json:"vhost"`
	Type            string                 `json:"type"` // "direct", "fanout", "topic", "headers"
	Durable         bool                   `json:"durable"`
	AutoDelete      bool                   `json:"autoDelete"`
	Internal        bool                   `json:"internal"`
	CustomArguments map[string]interface{} `json:"customArguments,omitempty"`
}

// RMQBindingInfo represents a binding between an exchange and a queue or exchange
type RMQBindingInfo struct {
	Source          string                 `json:"source"`
	VHost           string                 `json:"vhost"`
	Destination     string                 `json:"destination"`
	DestinationType string                 `json:"destinationType"` // "queue" or "exchange"
	RoutingKey      string                 `json:"routingKey"`
	Arguments       map[string]interface{} `json:"arguments,omitempty"`
	PropertiesKey   string                 `json:"propertiesKey,omitempty"`
}

// CreateBindingParams defines options when binding an exchange to a queue or exchange
type CreateBindingParams struct {
	VHost           string                 `json:"vhost"`
	Source          string                 `json:"source"`
	Destination     string                 `json:"destination"`
	DestinationType string                 `json:"destinationType"` // "queue" or "exchange"
	RoutingKey      string                 `json:"routingKey"`
	Arguments       map[string]interface{} `json:"arguments,omitempty"`
}

// RMQMessage represents an individual RabbitMQ message payload and metadata
type RMQMessage struct {
	Payload         string                 `json:"payload"`
	PayloadBytes    int                    `json:"payloadBytes"`
	PayloadEncoding string                 `json:"payloadEncoding"` // "string", "json", "base64"
	Exchange        string                 `json:"exchange"`
	RoutingKey      string                 `json:"routingKey"`
	DeliveryTag     uint64                 `json:"deliveryTag"`
	Redelivered     bool                   `json:"redelivered"`
	MessageCount    uint32                 `json:"messageCount"`
	ContentType     string                 `json:"contentType"`
	ContentEncoding string                 `json:"contentEncoding"`
	DeliveryMode    uint8                  `json:"deliveryMode"` // 1 = Non-Persistent, 2 = Persistent
	Priority        uint8                  `json:"priority"`
	CorrelationID   string                 `json:"correlationId,omitempty"`
	ReplyTo         string                 `json:"replyTo,omitempty"`
	Expiration      string                 `json:"expiration,omitempty"`
	MessageID       string                 `json:"messageId,omitempty"`
	Timestamp       int64                  `json:"timestamp"`
	Type            string                 `json:"type,omitempty"`
	UserID          string                 `json:"userId,omitempty"`
	AppID           string                 `json:"appId,omitempty"`
	Headers         map[string]interface{} `json:"headers,omitempty"`
	QueueName       string                 `json:"queueName,omitempty"`
}

// PublishRMQMessageParams represents parameters for publishing an AMQP message
type PublishRMQMessageParams struct {
	VHost           string                 `json:"vhost"`
	Exchange        string                 `json:"exchange"`
	RoutingKey      string                 `json:"routingKey"`
	Payload         string                 `json:"payload"`
	ContentType     string                 `json:"contentType"`
	DeliveryMode    uint8                  `json:"deliveryMode"` // 1 = Non-Persistent, 2 = Persistent
	Priority        uint8                  `json:"priority"`
	CorrelationID   string                 `json:"correlationId,omitempty"`
	ReplyTo         string                 `json:"replyTo,omitempty"`
	Expiration      string                 `json:"expiration,omitempty"`
	MessageID       string                 `json:"messageId,omitempty"`
	Type            string                 `json:"type,omitempty"`
	Headers         map[string]interface{} `json:"headers,omitempty"`
	Mandatory       bool                   `json:"mandatory"`
	WaitForConfirm  bool                   `json:"waitForConfirm"`
}

// PublishRMQMessageResult captures publishing acknowledgment
type PublishRMQMessageResult struct {
	Success      bool   `json:"success"`
	Confirmed    bool   `json:"confirmed"`
	Returned     bool   `json:"returned"`
	ReturnReason string `json:"returnReason,omitempty"`
	MessageID    string `json:"messageId,omitempty"`
	Timestamp    int64  `json:"timestamp"`
}

// PeekRMQMessagesParams represents parameters for non-destructive message inspection
type PeekRMQMessagesParams struct {
	VHost     string `json:"vhost"`
	QueueName string `json:"queueName"`
	Count     int    `json:"count"`
	AckMode   string `json:"ackMode"` // "ack_requeue_true", "ack_requeue_false", "reject_requeue_true"
	Encoding  string `json:"encoding"` // "auto", "base64"
}

// ConsumeRMQMessagesParams represents parameters for live consumer streaming
type ConsumeRMQMessagesParams struct {
	VHost         string `json:"vhost"`
	QueueName     string `json:"queueName"`
	PrefetchCount int    `json:"prefetchCount"` // Default 50-100 to prevent OOM
	AutoAck       bool   `json:"autoAck"`
	Exclusive     bool   `json:"exclusive"`
}

// RedriveDLQParams captures parameters to move messages from a DLQ back to a target exchange/queue
type RedriveDLQParams struct {
	VHost            string `json:"vhost"`
	SourceQueue      string `json:"sourceQueue"`      // The Dead Letter Queue name
	TargetExchange   string `json:"targetExchange"`   // Optional: override destination exchange (defaults to original from x-death)
	TargetRoutingKey string `json:"targetRoutingKey"` // Optional: override destination routing key (defaults to original from x-death)
	MaxMessages      int    `json:"maxMessages"`      // Batch limit
}

// RedriveDLQResult represents the outcome of moving dead-letter messages
type RedriveDLQResult struct {
	MovedCount  int      `json:"movedCount"`
	FailedCount int      `json:"failedCount"`
	Errors      []string `json:"errors,omitempty"`
}
