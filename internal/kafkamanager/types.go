package kafkamanager

// BrokerInfo represents a single broker/node in the Kafka cluster
type BrokerInfo struct {
	NodeID       int32  `json:"nodeId"`
	Host         string `json:"host"`
	Port         int32  `json:"port"`
	Rack         string `json:"rack,omitempty"`
	IsController bool   `json:"isController"`
}

// BrokerConfigEntry represents a configuration parameter on a broker or topic
type BrokerConfigEntry struct {
	Name        string `json:"name"`
	Value       string `json:"value"`
	Source      string `json:"source"`
	IsSensitive bool   `json:"isSensitive"`
	IsReadOnly  bool   `json:"isReadOnly"`
}

// KafkaClusterStatus captures the live state and telemetry of the connected cluster
type KafkaClusterStatus struct {
	Connected        bool         `json:"connected"`
	Connecting       bool         `json:"connecting"`
	Protocol         string       `json:"protocol"` // "kafka"
	LastError        string       `json:"lastError,omitempty"`
	CurrentProfileID string       `json:"currentProfileId,omitempty"`
	ClusterID        string       `json:"clusterId,omitempty"`
	ControllerID     int32        `json:"controllerId"`
	Brokers          []BrokerInfo `json:"brokers"`
	BrokersCount     int          `json:"brokersCount"`
	TopicsCount      int          `json:"topicsCount"`
	PartitionsCount  int          `json:"partitionsCount"`
	KafkaVersion     string       `json:"kafkaVersion,omitempty"`
	RTTMs            float64      `json:"rttMs"`
}

// TopicSummary represents high-level metrics for a Kafka topic in the topic list
type TopicSummary struct {
	Name                 string `json:"name"`
	IsInternal           bool   `json:"isInternal"`
	PartitionsCount      int    `json:"partitionsCount"`
	ReplicationFactor    int    `json:"replicationFactor"`
	CleanupPolicy        string `json:"cleanupPolicy"`
	RetentionMs          string `json:"retentionMs"`
	RetentionBytes       string `json:"retentionBytes"`
	UnderReplicatedCount int    `json:"underReplicatedCount"`
	TotalMessages        int64  `json:"totalMessages"`
}

// PartitionInfo contains deep health and offset details for a specific partition
type PartitionInfo struct {
	Partition          int32   `json:"partition"`
	Leader             int32   `json:"leader"`
	LeaderEpoch        int32   `json:"leaderEpoch"`
	Replicas           []int32 `json:"replicas"`
	ISR                []int32 `json:"isr"`
	OfflineReplicas    []int32 `json:"offlineReplicas"`
	IsUnderReplicated  bool    `json:"isUnderReplicated"`
	IsPreferredLeader  bool    `json:"isPreferredLeader"`
	StartOffset        int64   `json:"startOffset"`
	EndOffset          int64   `json:"endOffset"`
	MessageCount       int64   `json:"messageCount"`
}

// TopicDetailInfo contains comprehensive data for a topic including partition list and configs
type TopicDetailInfo struct {
	Name                 string              `json:"name"`
	IsInternal           bool                `json:"isInternal"`
	PartitionsCount      int                 `json:"partitionsCount"`
	ReplicationFactor    int                 `json:"replicationFactor"`
	TotalMessages        int64               `json:"totalMessages"`
	UnderReplicatedCount int                 `json:"underReplicatedCount"`
	Partitions           []PartitionInfo     `json:"partitions"`
	Configs              []BrokerConfigEntry `json:"configs"`
}

// CreateTopicParams specifies the arguments for creating a new Kafka topic
type CreateTopicParams struct {
	Topic             string            `json:"topic"`
	Partitions        int32             `json:"partitions"`
	ReplicationFactor int16             `json:"replicationFactor"`
	CleanupPolicy     string            `json:"cleanupPolicy,omitempty"`
	RetentionMs       int64             `json:"retentionMs,omitempty"`
	RetentionBytes    int64             `json:"retentionBytes,omitempty"`
	MinInSyncReplicas int32             `json:"minInSyncReplicas,omitempty"`
	CustomConfigs     map[string]string `json:"customConfigs,omitempty"`
}

// ConsumerGroupSummary represents high-level info for a consumer group in the list
type ConsumerGroupSummary struct {
	Group        string `json:"group"`
	State        string `json:"state"`        // "Stable", "Empty", "Dead", "PreparingRebalance", "CompletingRebalance"
	ProtocolType string `json:"protocolType"` // "consumer", "connect", etc.
	Protocol     string `json:"protocol"`     // assignor: "range", "roundrobin", "sticky", etc.
	Coordinator  int32  `json:"coordinator"`
	MembersCount int    `json:"membersCount"`
	TopicsCount  int    `json:"topicsCount"`
	TotalLag     int64  `json:"totalLag"`
}

// ConsumerGroupMemberInfo represents a member connected to a consumer group
type ConsumerGroupMemberInfo struct {
	MemberID           string             `json:"memberId"`
	ClientID           string             `json:"clientId"`
	ClientHost         string             `json:"clientHost"`
	AssignedPartitions map[string][]int32 `json:"assignedPartitions"` // topic -> partition IDs
}

// ConsumerGroupPartitionLag represents lag and offset metrics for a topic-partition in a group
type ConsumerGroupPartitionLag struct {
	Topic         string `json:"topic"`
	Partition     int32  `json:"partition"`
	MemberID      string `json:"memberId,omitempty"`
	ClientID      string `json:"clientId,omitempty"`
	ClientHost    string `json:"clientHost,omitempty"`
	CurrentOffset int64  `json:"currentOffset"`
	EndOffset     int64  `json:"endOffset"`
	Lag           int64  `json:"lag"`
}

// ConsumerGroupDetailInfo represents deep details of a consumer group
type ConsumerGroupDetailInfo struct {
	Group        string                      `json:"group"`
	State        string                      `json:"state"`
	ProtocolType string                      `json:"protocolType"`
	Protocol     string                      `json:"protocol"`
	Coordinator  int32                       `json:"coordinator"`
	TotalLag     int64                       `json:"totalLag"`
	Members      []ConsumerGroupMemberInfo   `json:"members"`
	Partitions   []ConsumerGroupPartitionLag `json:"partitions"`
}

// ResetOffsetsParams specifies options for resetting consumer group offsets
type ResetOffsetsParams struct {
	Group      string  `json:"group"`
	Topic      string  `json:"topic,omitempty"`      // optional: specific topic (empty for all)
	Partitions []int32 `json:"partitions,omitempty"` // optional: specific partitions
	Strategy   string  `json:"strategy"`             // "earliest", "latest", "timestamp", "offset"
	Timestamp  int64   `json:"timestamp,omitempty"`  // unix ms for "timestamp" strategy
	Offset     int64   `json:"offset,omitempty"`     // explicit offset for "offset" strategy
}

// KafkaRecord represents a consumed Kafka message record
type KafkaRecord struct {
	Topic     string            `json:"topic"`
	Partition int32             `json:"partition"`
	Offset    int64             `json:"offset"`
	Timestamp int64             `json:"timestamp"` // epoch ms
	Key       string            `json:"key,omitempty"`
	Payload   string            `json:"payload"`
	Headers   map[string]string `json:"headers,omitempty"`
}

// GetKafkaMessagesParams specifies parameters for querying messages from a topic
type GetKafkaMessagesParams struct {
	Topic      string  `json:"topic"`
	Partitions []int32 `json:"partitions,omitempty"` // empty for all partitions
	Strategy   string  `json:"strategy"`             // "latest", "earliest", "offset", "timestamp"
	Offset     int64   `json:"offset,omitempty"`     // starting offset if strategy == "offset"
	Timestamp  int64   `json:"timestamp,omitempty"`  // starting epoch ms if strategy == "timestamp"
	Limit      int     `json:"limit"`                // max records (e.g. 50, 100, 500)
}

// ProduceKafkaRecordParams specifies options for publishing a Kafka record
type ProduceKafkaRecordParams struct {
	Topic       string            `json:"topic"`
	Key         string            `json:"key,omitempty"`
	Payload     string            `json:"payload"`
	Partition   int32             `json:"partition"` // -1 for auto
	Headers     map[string]string `json:"headers,omitempty"`
	Compression string            `json:"compression,omitempty"` // "none", "gzip", "snappy", "lz4", "zstd"
	IsTombstone bool              `json:"isTombstone,omitempty"`
}

// ProduceRecordResult returns the result of publishing a message
type ProduceRecordResult struct {
	Topic     string `json:"topic"`
	Partition int32  `json:"partition"`
	Offset    int64  `json:"offset"`
	Timestamp int64  `json:"timestamp"` // epoch ms
}


