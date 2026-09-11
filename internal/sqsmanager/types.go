package sqsmanager

// SQSClusterStatus captures the connection status and telemetry of the connected SQS endpoint
type SQSClusterStatus struct {
	Connected        bool    `json:"connected"`
	Connecting       bool    `json:"connecting"`
	Protocol         string  `json:"protocol"` // "sqs"
	LastError        string  `json:"lastError,omitempty"`
	CurrentProfileID string  `json:"currentProfileId,omitempty"`
	Endpoint         string  `json:"endpoint"`
	Region           string  `json:"region"`
	AccountID        string  `json:"accountId,omitempty"`
	QueuesCount      int     `json:"queuesCount"`
	RTTMs            float64 `json:"rttMs"`
	IsLocal          bool    `json:"isLocal"`
}

// SQSQueueSummary represents high-level metrics for an SQS queue in the queues list
type SQSQueueSummary struct {
	QueueURL                      string `json:"queueUrl"`
	QueueName                     string `json:"queueName"`
	IsFIFO                        bool   `json:"isFifo"`
	ApproximateNumberOfMessages   int64  `json:"approximateNumberOfMessages"`
	ApproximateNumberOfNotVisible int64  `json:"approximateNumberOfNotVisible"`
	ApproximateNumberOfDelayed    int64  `json:"approximateNumberOfDelayed"`
	VisibilityTimeoutSeconds      int    `json:"visibilityTimeoutSeconds"`
	MessageRetentionSeconds       int    `json:"messageRetentionSeconds"`
	DelaySeconds                  int    `json:"delaySeconds"`
	CreatedTimestamp              int64  `json:"createdTimestamp"`
	LastModifiedTimestamp         int64  `json:"lastModifiedTimestamp"`
	QueueARN                      string `json:"queueArn"`
	IsDeadLetterQueue             bool   `json:"isDeadLetterQueue"`
	HasRedrivePolicy              bool   `json:"hasRedrivePolicy"`
	DeadLetterTargetARN           string `json:"deadLetterTargetArn,omitempty"`
	MaxReceiveCount               int    `json:"maxReceiveCount,omitempty"`
	ServerSideEncryption          string `json:"serverSideEncryption,omitempty"` // "SSE-SQS", "SSE-KMS", or "None"
}

// SQSQueueDetail contains comprehensive attributes, policies, and tags for a selected queue
type SQSQueueDetail struct {
	SQSQueueSummary
	Policy                        string            `json:"policy,omitempty"`
	RedrivePolicy                 string            `json:"redrivePolicy,omitempty"`
	RedriveAllowPolicy            string            `json:"redriveAllowPolicy,omitempty"`
	Tags                          map[string]string `json:"tags,omitempty"`
	DeadLetterSourceQueues        []string          `json:"deadLetterSourceQueues,omitempty"`
	MaximumMessageSize            int               `json:"maximumMessageSize"`
	ReceiveMessageWaitTimeSeconds int               `json:"receiveMessageWaitTimeSeconds"`
	DeduplicationScope            string            `json:"deduplicationScope,omitempty"`
	FifoThroughputLimit           string            `json:"fifoThroughputLimit,omitempty"`
	ContentBasedDeduplication     bool              `json:"contentBasedDeduplication"`
	KmsMasterKeyID                string            `json:"kmsMasterKeyId,omitempty"`
	KmsDataKeyReusePeriodSeconds  int               `json:"kmsDataKeyReusePeriodSeconds,omitempty"`
	SqsManagedSseEnabled          bool              `json:"sqsManagedSseEnabled"`
}

// CreateQueueParams represents the configuration options when creating an SQS queue
type CreateQueueParams struct {
	QueueName                     string            `json:"queueName"`
	IsFIFO                        bool              `json:"isFifo"`
	VisibilityTimeout             int32             `json:"visibilityTimeout"`
	MessageRetentionPeriod        int32             `json:"messageRetentionPeriod"`
	DelaySeconds                  int32             `json:"delaySeconds"`
	MaximumMessageSize            int32             `json:"maximumMessageSize"`
	ReceiveMessageWaitTimeSeconds int32             `json:"receiveMessageWaitTimeSeconds"`
	ContentBasedDeduplication     bool              `json:"contentBasedDeduplication"`
	DeduplicationScope            string            `json:"deduplicationScope,omitempty"`
	FifoThroughputLimit           string            `json:"fifoThroughputLimit,omitempty"`
	EnableDLQ                     bool              `json:"enableDlq"`
	DeadLetterTargetARN           string            `json:"deadLetterTargetArn,omitempty"`
	MaxReceiveCount               int               `json:"maxReceiveCount,omitempty"`
	ServerSideEncryption          string            `json:"serverSideEncryption,omitempty"` // "None", "SSE-SQS", "SSE-KMS"
	KmsMasterKeyID                string            `json:"kmsMasterKeyId,omitempty"`
	Tags                          map[string]string `json:"tags,omitempty"`
}

// RedrivePolicyConfig represents the JSON payload of an SQS RedrivePolicy
type RedrivePolicyConfig struct {
	DeadLetterTargetArn string `json:"deadLetterTargetArn"`
	MaxReceiveCount     int    `json:"maxReceiveCount"`
}

// SQSMessageAttribute represents a typed message attribute
type SQSMessageAttribute struct {
	DataType    string `json:"dataType"` // "String", "Number", "Binary"
	StringValue string `json:"stringValue,omitempty"`
	BinaryValue string `json:"binaryValue,omitempty"` // Base64 encoded string
}

// SQSMessage represents an individual SQS message payload and metadata
type SQSMessage struct {
	MessageID              string                         `json:"messageId"`
	ReceiptHandle          string                         `json:"receiptHandle"`
	MD5OfBody              string                         `json:"md5OfBody"`
	Body                   string                         `json:"body"`
	QueueURL               string                         `json:"queueUrl"`
	QueueName              string                         `json:"queueName"`
	SentTimestamp          int64                          `json:"sentTimestamp"`
	FirstReceiveTimestamp  int64                          `json:"firstReceiveTimestamp"`
	ReceiveCount           int                            `json:"receiveCount"`
	MessageGroupID         string                         `json:"messageGroupId,omitempty"`
	MessageDeduplicationID string                         `json:"messageDeduplicationId,omitempty"`
	SequenceNumber         string                         `json:"sequenceNumber,omitempty"`
	Attributes             map[string]string              `json:"attributes,omitempty"`
	MessageAttributes      map[string]SQSMessageAttribute `json:"messageAttributes,omitempty"`
}

// SendSQSMessageParams represents options for sending an SQS message
type SendSQSMessageParams struct {
	QueueURL               string                         `json:"queueUrl"`
	Body                   string                         `json:"body"`
	DelaySeconds           int32                          `json:"delaySeconds"`
	MessageGroupID         string                         `json:"messageGroupId,omitempty"`
	MessageDeduplicationID string                         `json:"messageDeduplicationId,omitempty"`
	MessageAttributes      map[string]SQSMessageAttribute `json:"messageAttributes,omitempty"`
}

// SendSQSMessageResult represents the response from sending an SQS message
type SendSQSMessageResult struct {
	MessageID      string `json:"messageId"`
	MD5OfBody      string `json:"md5OfBody"`
	SequenceNumber string `json:"sequenceNumber,omitempty"`
}

// PollSQSMessagesParams represents options for receiving SQS messages
type PollSQSMessagesParams struct {
	QueueURL          string `json:"queueUrl"`
	Mode              string `json:"mode"`              // "peek" (visibility=0, non-destructive) or "consumer"
	MaxMessages       int32  `json:"maxMessages"`       // 1 to 10
	WaitTimeSeconds   int32  `json:"waitTimeSeconds"`   // 0 to 20s (long polling)
	VisibilityTimeout int32  `json:"visibilityTimeout"` // seconds (used in consumer mode)
	AutoDelete        bool   `json:"autoDelete"`        // delete message upon receipt in consumer mode
}

// RedriveDLQParams represents configuration for redriving messages from a DLQ
type RedriveDLQParams struct {
	SourceQueueURL string `json:"sourceQueueUrl"` // DLQ URL
	TargetQueueURL string `json:"targetQueueUrl"` // Destination Queue URL
	MaxMessages    int    `json:"maxMessages"`    // Maximum messages to move (0 = all available)
}

// RedriveDLQResult represents summary of redriven messages
type RedriveDLQResult struct {
	MessagesMoved int    `json:"messagesMoved"`
	ErrorsCount   int    `json:"errorsCount"`
	StatusMessage string `json:"statusMessage"`
}
