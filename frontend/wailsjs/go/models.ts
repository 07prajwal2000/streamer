export namespace kafkamanager {
	
	export class BrokerConfigEntry {
	    name: string;
	    value: string;
	    source: string;
	    isSensitive: boolean;
	    isReadOnly: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BrokerConfigEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.source = source["source"];
	        this.isSensitive = source["isSensitive"];
	        this.isReadOnly = source["isReadOnly"];
	    }
	}
	export class BrokerInfo {
	    nodeId: number;
	    host: string;
	    port: number;
	    rack?: string;
	    isController: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BrokerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodeId = source["nodeId"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.rack = source["rack"];
	        this.isController = source["isController"];
	    }
	}
	export class ConsumerGroupPartitionLag {
	    topic: string;
	    partition: number;
	    memberId?: string;
	    clientId?: string;
	    clientHost?: string;
	    currentOffset: number;
	    endOffset: number;
	    lag: number;
	
	    static createFrom(source: any = {}) {
	        return new ConsumerGroupPartitionLag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.partition = source["partition"];
	        this.memberId = source["memberId"];
	        this.clientId = source["clientId"];
	        this.clientHost = source["clientHost"];
	        this.currentOffset = source["currentOffset"];
	        this.endOffset = source["endOffset"];
	        this.lag = source["lag"];
	    }
	}
	export class ConsumerGroupMemberInfo {
	    memberId: string;
	    clientId: string;
	    clientHost: string;
	    assignedPartitions: Record<string, Array<number>>;
	
	    static createFrom(source: any = {}) {
	        return new ConsumerGroupMemberInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.memberId = source["memberId"];
	        this.clientId = source["clientId"];
	        this.clientHost = source["clientHost"];
	        this.assignedPartitions = source["assignedPartitions"];
	    }
	}
	export class ConsumerGroupDetailInfo {
	    group: string;
	    state: string;
	    protocolType: string;
	    protocol: string;
	    coordinator: number;
	    totalLag: number;
	    members: ConsumerGroupMemberInfo[];
	    partitions: ConsumerGroupPartitionLag[];
	
	    static createFrom(source: any = {}) {
	        return new ConsumerGroupDetailInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.state = source["state"];
	        this.protocolType = source["protocolType"];
	        this.protocol = source["protocol"];
	        this.coordinator = source["coordinator"];
	        this.totalLag = source["totalLag"];
	        this.members = this.convertValues(source["members"], ConsumerGroupMemberInfo);
	        this.partitions = this.convertValues(source["partitions"], ConsumerGroupPartitionLag);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class ConsumerGroupSummary {
	    group: string;
	    state: string;
	    protocolType: string;
	    protocol: string;
	    coordinator: number;
	    membersCount: number;
	    topicsCount: number;
	    totalLag: number;
	
	    static createFrom(source: any = {}) {
	        return new ConsumerGroupSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.state = source["state"];
	        this.protocolType = source["protocolType"];
	        this.protocol = source["protocol"];
	        this.coordinator = source["coordinator"];
	        this.membersCount = source["membersCount"];
	        this.topicsCount = source["topicsCount"];
	        this.totalLag = source["totalLag"];
	    }
	}
	export class CreateTopicParams {
	    topic: string;
	    partitions: number;
	    replicationFactor: number;
	    cleanupPolicy?: string;
	    retentionMs?: number;
	    retentionBytes?: number;
	    minInSyncReplicas?: number;
	    customConfigs?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new CreateTopicParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.partitions = source["partitions"];
	        this.replicationFactor = source["replicationFactor"];
	        this.cleanupPolicy = source["cleanupPolicy"];
	        this.retentionMs = source["retentionMs"];
	        this.retentionBytes = source["retentionBytes"];
	        this.minInSyncReplicas = source["minInSyncReplicas"];
	        this.customConfigs = source["customConfigs"];
	    }
	}
	export class GetKafkaMessagesParams {
	    topic: string;
	    partitions?: number[];
	    strategy: string;
	    offset?: number;
	    timestamp?: number;
	    limit: number;
	
	    static createFrom(source: any = {}) {
	        return new GetKafkaMessagesParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.partitions = source["partitions"];
	        this.strategy = source["strategy"];
	        this.offset = source["offset"];
	        this.timestamp = source["timestamp"];
	        this.limit = source["limit"];
	    }
	}
	export class KafkaClusterStatus {
	    connected: boolean;
	    connecting: boolean;
	    protocol: string;
	    lastError?: string;
	    currentProfileId?: string;
	    clusterId?: string;
	    controllerId: number;
	    brokers: BrokerInfo[];
	    brokersCount: number;
	    topicsCount: number;
	    partitionsCount: number;
	    kafkaVersion?: string;
	    rttMs: number;
	
	    static createFrom(source: any = {}) {
	        return new KafkaClusterStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.connecting = source["connecting"];
	        this.protocol = source["protocol"];
	        this.lastError = source["lastError"];
	        this.currentProfileId = source["currentProfileId"];
	        this.clusterId = source["clusterId"];
	        this.controllerId = source["controllerId"];
	        this.brokers = this.convertValues(source["brokers"], BrokerInfo);
	        this.brokersCount = source["brokersCount"];
	        this.topicsCount = source["topicsCount"];
	        this.partitionsCount = source["partitionsCount"];
	        this.kafkaVersion = source["kafkaVersion"];
	        this.rttMs = source["rttMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KafkaRecord {
	    topic: string;
	    partition: number;
	    offset: number;
	    timestamp: number;
	    key?: string;
	    payload: string;
	    headers?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new KafkaRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.partition = source["partition"];
	        this.offset = source["offset"];
	        this.timestamp = source["timestamp"];
	        this.key = source["key"];
	        this.payload = source["payload"];
	        this.headers = source["headers"];
	    }
	}
	export class PartitionInfo {
	    partition: number;
	    leader: number;
	    leaderEpoch: number;
	    replicas: number[];
	    isr: number[];
	    offlineReplicas: number[];
	    isUnderReplicated: boolean;
	    isPreferredLeader: boolean;
	    startOffset: number;
	    endOffset: number;
	    messageCount: number;
	
	    static createFrom(source: any = {}) {
	        return new PartitionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.partition = source["partition"];
	        this.leader = source["leader"];
	        this.leaderEpoch = source["leaderEpoch"];
	        this.replicas = source["replicas"];
	        this.isr = source["isr"];
	        this.offlineReplicas = source["offlineReplicas"];
	        this.isUnderReplicated = source["isUnderReplicated"];
	        this.isPreferredLeader = source["isPreferredLeader"];
	        this.startOffset = source["startOffset"];
	        this.endOffset = source["endOffset"];
	        this.messageCount = source["messageCount"];
	    }
	}
	export class ProduceKafkaRecordParams {
	    topic: string;
	    key?: string;
	    payload: string;
	    partition: number;
	    headers?: Record<string, string>;
	    compression?: string;
	    isTombstone?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ProduceKafkaRecordParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.key = source["key"];
	        this.payload = source["payload"];
	        this.partition = source["partition"];
	        this.headers = source["headers"];
	        this.compression = source["compression"];
	        this.isTombstone = source["isTombstone"];
	    }
	}
	export class ProduceRecordResult {
	    topic: string;
	    partition: number;
	    offset: number;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new ProduceRecordResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.partition = source["partition"];
	        this.offset = source["offset"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class ResetOffsetsParams {
	    group: string;
	    topic?: string;
	    partitions?: number[];
	    strategy: string;
	    timestamp?: number;
	    offset?: number;
	
	    static createFrom(source: any = {}) {
	        return new ResetOffsetsParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.topic = source["topic"];
	        this.partitions = source["partitions"];
	        this.strategy = source["strategy"];
	        this.timestamp = source["timestamp"];
	        this.offset = source["offset"];
	    }
	}
	export class TopicDetailInfo {
	    name: string;
	    isInternal: boolean;
	    partitionsCount: number;
	    replicationFactor: number;
	    totalMessages: number;
	    underReplicatedCount: number;
	    partitions: PartitionInfo[];
	    configs: BrokerConfigEntry[];
	
	    static createFrom(source: any = {}) {
	        return new TopicDetailInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isInternal = source["isInternal"];
	        this.partitionsCount = source["partitionsCount"];
	        this.replicationFactor = source["replicationFactor"];
	        this.totalMessages = source["totalMessages"];
	        this.underReplicatedCount = source["underReplicatedCount"];
	        this.partitions = this.convertValues(source["partitions"], PartitionInfo);
	        this.configs = this.convertValues(source["configs"], BrokerConfigEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TopicSummary {
	    name: string;
	    isInternal: boolean;
	    partitionsCount: number;
	    replicationFactor: number;
	    cleanupPolicy: string;
	    retentionMs: string;
	    retentionBytes: string;
	    underReplicatedCount: number;
	    totalMessages: number;
	
	    static createFrom(source: any = {}) {
	        return new TopicSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isInternal = source["isInternal"];
	        this.partitionsCount = source["partitionsCount"];
	        this.replicationFactor = source["replicationFactor"];
	        this.cleanupPolicy = source["cleanupPolicy"];
	        this.retentionMs = source["retentionMs"];
	        this.retentionBytes = source["retentionBytes"];
	        this.underReplicatedCount = source["underReplicatedCount"];
	        this.totalMessages = source["totalMessages"];
	    }
	}

}

export namespace mcpserver {
	
	export class ServerStatus {
	    running: boolean;
	    port: number;
	    url: string;
	    readOnly: boolean;
	    // Go type: time
	    startedAt?: any;
	    errorMessage?: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.port = source["port"];
	        this.url = source["url"];
	        this.readOnly = source["readOnly"];
	        this.startedAt = this.convertValues(source["startedAt"], null);
	        this.errorMessage = source["errorMessage"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace natsmanager {
	
	export class ConsumerCreateParams {
	    stream: string;
	    name: string;
	    durable?: string;
	    description?: string;
	    deliverPolicy: string;
	    optStartSeq?: number;
	    ackPolicy: string;
	    ackWaitSec: number;
	    maxDeliver: number;
	    filterSubject?: string;
	    filterSubjects?: string[];
	    replayPolicy: string;
	
	    static createFrom(source: any = {}) {
	        return new ConsumerCreateParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stream = source["stream"];
	        this.name = source["name"];
	        this.durable = source["durable"];
	        this.description = source["description"];
	        this.deliverPolicy = source["deliverPolicy"];
	        this.optStartSeq = source["optStartSeq"];
	        this.ackPolicy = source["ackPolicy"];
	        this.ackWaitSec = source["ackWaitSec"];
	        this.maxDeliver = source["maxDeliver"];
	        this.filterSubject = source["filterSubject"];
	        this.filterSubjects = source["filterSubjects"];
	        this.replayPolicy = source["replayPolicy"];
	    }
	}
	export class JSConsumerInfo {
	    stream: string;
	    name: string;
	    durable?: string;
	    description?: string;
	    deliverPolicy: string;
	    ackPolicy: string;
	    ackWaitSec: number;
	    maxDeliver: number;
	    filterSubject?: string;
	    filterSubjects?: string[];
	    replayPolicy: string;
	    numAckPending: number;
	    numRedelivered: number;
	    numWaiting: number;
	    numPending: number;
	    deliveredSeq: number;
	    ackFloorSeq: number;
	    paused: boolean;
	
	    static createFrom(source: any = {}) {
	        return new JSConsumerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stream = source["stream"];
	        this.name = source["name"];
	        this.durable = source["durable"];
	        this.description = source["description"];
	        this.deliverPolicy = source["deliverPolicy"];
	        this.ackPolicy = source["ackPolicy"];
	        this.ackWaitSec = source["ackWaitSec"];
	        this.maxDeliver = source["maxDeliver"];
	        this.filterSubject = source["filterSubject"];
	        this.filterSubjects = source["filterSubjects"];
	        this.replayPolicy = source["replayPolicy"];
	        this.numAckPending = source["numAckPending"];
	        this.numRedelivered = source["numRedelivered"];
	        this.numWaiting = source["numWaiting"];
	        this.numPending = source["numPending"];
	        this.deliveredSeq = source["deliveredSeq"];
	        this.ackFloorSeq = source["ackFloorSeq"];
	        this.paused = source["paused"];
	    }
	}
	export class JSStoredMsg {
	    sequence: number;
	    subject: string;
	    reply?: string;
	    headers?: Record<string, Array<string>>;
	    data: string;
	    isBinary: boolean;
	    size: number;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new JSStoredMsg(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sequence = source["sequence"];
	        this.subject = source["subject"];
	        this.reply = source["reply"];
	        this.headers = source["headers"];
	        this.data = source["data"];
	        this.isBinary = source["isBinary"];
	        this.size = source["size"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class JSStreamInfo {
	    name: string;
	    description?: string;
	    subjects: string[];
	    storage: string;
	    retention: string;
	    discard: string;
	    maxMsgs: number;
	    maxBytes: number;
	    maxAgeSec: number;
	    maxMsgSize: number;
	    replicas: number;
	    msgs: number;
	    bytes: number;
	    firstSeq: number;
	    lastSeq: number;
	    // Go type: time
	    firstTime: any;
	    // Go type: time
	    lastTime: any;
	    consumerCount: number;
	    allowMsgSchedules: boolean;
	    denyPurge: boolean;
	    denyDelete: boolean;
	
	    static createFrom(source: any = {}) {
	        return new JSStreamInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.subjects = source["subjects"];
	        this.storage = source["storage"];
	        this.retention = source["retention"];
	        this.discard = source["discard"];
	        this.maxMsgs = source["maxMsgs"];
	        this.maxBytes = source["maxBytes"];
	        this.maxAgeSec = source["maxAgeSec"];
	        this.maxMsgSize = source["maxMsgSize"];
	        this.replicas = source["replicas"];
	        this.msgs = source["msgs"];
	        this.bytes = source["bytes"];
	        this.firstSeq = source["firstSeq"];
	        this.lastSeq = source["lastSeq"];
	        this.firstTime = this.convertValues(source["firstTime"], null);
	        this.lastTime = this.convertValues(source["lastTime"], null);
	        this.consumerCount = source["consumerCount"];
	        this.allowMsgSchedules = source["allowMsgSchedules"];
	        this.denyPurge = source["denyPurge"];
	        this.denyDelete = source["denyDelete"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KVBucketCreateParams {
	    bucket: string;
	    description?: string;
	    maxValueSize: number;
	    history: number;
	    ttlSec: number;
	    maxBytes: number;
	    storage: string;
	    replicas: number;
	    compression: boolean;
	    metadata?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new KVBucketCreateParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.description = source["description"];
	        this.maxValueSize = source["maxValueSize"];
	        this.history = source["history"];
	        this.ttlSec = source["ttlSec"];
	        this.maxBytes = source["maxBytes"];
	        this.storage = source["storage"];
	        this.replicas = source["replicas"];
	        this.compression = source["compression"];
	        this.metadata = source["metadata"];
	    }
	}
	export class KVBucketInfo {
	    bucket: string;
	    description?: string;
	    values: number;
	    history: number;
	    ttl: number;
	    backingStore: string;
	    bytes: number;
	    isCompressed: boolean;
	    storage: string;
	    replicas: number;
	    maxValueSize: number;
	    maxBytes: number;
	    metadata?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new KVBucketInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.description = source["description"];
	        this.values = source["values"];
	        this.history = source["history"];
	        this.ttl = source["ttl"];
	        this.backingStore = source["backingStore"];
	        this.bytes = source["bytes"];
	        this.isCompressed = source["isCompressed"];
	        this.storage = source["storage"];
	        this.replicas = source["replicas"];
	        this.maxValueSize = source["maxValueSize"];
	        this.maxBytes = source["maxBytes"];
	        this.metadata = source["metadata"];
	    }
	}
	export class KVEntryInfo {
	    bucket: string;
	    key: string;
	    value: string;
	    isBinary: boolean;
	    revision: number;
	    // Go type: time
	    created: any;
	    delta: number;
	    operation: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new KVEntryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.value = source["value"];
	        this.isBinary = source["isBinary"];
	        this.revision = source["revision"];
	        this.created = this.convertValues(source["created"], null);
	        this.delta = source["delta"];
	        this.operation = source["operation"];
	        this.size = source["size"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PubSubMessage {
	    id: string;
	    subId: string;
	    subject: string;
	    reply?: string;
	    headers?: Record<string, Array<string>>;
	    data: string;
	    isBinary: boolean;
	    size: number;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new PubSubMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.subId = source["subId"];
	        this.subject = source["subject"];
	        this.reply = source["reply"];
	        this.headers = source["headers"];
	        this.data = source["data"];
	        this.isBinary = source["isBinary"];
	        this.size = source["size"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class ServerStatus {
	    connected: boolean;
	    connecting: boolean;
	    reconnecting: boolean;
	    protocol: string;
	    lastError?: string;
	    currentProfileId?: string;
	    serverId?: string;
	    serverName?: string;
	    serverVersion?: string;
	    clusterName?: string;
	    clientIP?: string;
	    maxPayload?: number;
	    jetStream: boolean;
	    headersSupported: boolean;
	    tlsRequired: boolean;
	    rttMs: number;
	    connectedUrl?: string;
	    discoveredUrls?: string[];
	    clusterId?: string;
	    controllerId?: number;
	    brokersCount?: number;
	    topicsCount?: number;
	    partitionsCount?: number;
	
	    static createFrom(source: any = {}) {
	        return new ServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.connecting = source["connecting"];
	        this.reconnecting = source["reconnecting"];
	        this.protocol = source["protocol"];
	        this.lastError = source["lastError"];
	        this.currentProfileId = source["currentProfileId"];
	        this.serverId = source["serverId"];
	        this.serverName = source["serverName"];
	        this.serverVersion = source["serverVersion"];
	        this.clusterName = source["clusterName"];
	        this.clientIP = source["clientIP"];
	        this.maxPayload = source["maxPayload"];
	        this.jetStream = source["jetStream"];
	        this.headersSupported = source["headersSupported"];
	        this.tlsRequired = source["tlsRequired"];
	        this.rttMs = source["rttMs"];
	        this.connectedUrl = source["connectedUrl"];
	        this.discoveredUrls = source["discoveredUrls"];
	        this.clusterId = source["clusterId"];
	        this.controllerId = source["controllerId"];
	        this.brokersCount = source["brokersCount"];
	        this.topicsCount = source["topicsCount"];
	        this.partitionsCount = source["partitionsCount"];
	    }
	}
	export class StreamCreateParams {
	    name: string;
	    description?: string;
	    subjects: string[];
	    storage: string;
	    retention: string;
	    discard: string;
	    maxMsgs: number;
	    maxBytes: number;
	    maxAgeSec: number;
	    maxMsgSize: number;
	    replicas: number;
	    allowMsgSchedules: boolean;
	    denyPurge: boolean;
	    denyDelete: boolean;
	
	    static createFrom(source: any = {}) {
	        return new StreamCreateParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.subjects = source["subjects"];
	        this.storage = source["storage"];
	        this.retention = source["retention"];
	        this.discard = source["discard"];
	        this.maxMsgs = source["maxMsgs"];
	        this.maxBytes = source["maxBytes"];
	        this.maxAgeSec = source["maxAgeSec"];
	        this.maxMsgSize = source["maxMsgSize"];
	        this.replicas = source["replicas"];
	        this.allowMsgSchedules = source["allowMsgSchedules"];
	        this.denyPurge = source["denyPurge"];
	        this.denyDelete = source["denyDelete"];
	    }
	}
	export class SubscriptionInfo {
	    id: string;
	    subject: string;
	    queueGroup?: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new SubscriptionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.subject = source["subject"];
	        this.queueGroup = source["queueGroup"];
	        this.count = source["count"];
	    }
	}

}

export namespace rabbitmqmanager {
	
	export class ConsumeRMQMessagesParams {
	    vhost: string;
	    queueName: string;
	    prefetchCount: number;
	    autoAck: boolean;
	    exclusive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConsumeRMQMessagesParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vhost = source["vhost"];
	        this.queueName = source["queueName"];
	        this.prefetchCount = source["prefetchCount"];
	        this.autoAck = source["autoAck"];
	        this.exclusive = source["exclusive"];
	    }
	}
	export class CreateBindingParams {
	    vhost: string;
	    source: string;
	    destination: string;
	    destinationType: string;
	    routingKey: string;
	    arguments?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new CreateBindingParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vhost = source["vhost"];
	        this.source = source["source"];
	        this.destination = source["destination"];
	        this.destinationType = source["destinationType"];
	        this.routingKey = source["routingKey"];
	        this.arguments = source["arguments"];
	    }
	}
	export class CreateExchangeParams {
	    name: string;
	    vhost: string;
	    type: string;
	    durable: boolean;
	    autoDelete: boolean;
	    internal: boolean;
	    customArguments?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new CreateExchangeParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.vhost = source["vhost"];
	        this.type = source["type"];
	        this.durable = source["durable"];
	        this.autoDelete = source["autoDelete"];
	        this.internal = source["internal"];
	        this.customArguments = source["customArguments"];
	    }
	}
	export class CreateQueueParams {
	    name: string;
	    vhost: string;
	    type: string;
	    durable: boolean;
	    autoDelete: boolean;
	    exclusive: boolean;
	    messageTtl?: number;
	    autoExpire?: number;
	    maxLength?: number;
	    maxLengthBytes?: number;
	    maxPriority?: number;
	    deadLetterExchange?: string;
	    deadLetterRoutingKey?: string;
	    overflow?: string;
	    deliveryLimit?: number;
	    customArguments?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new CreateQueueParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.vhost = source["vhost"];
	        this.type = source["type"];
	        this.durable = source["durable"];
	        this.autoDelete = source["autoDelete"];
	        this.exclusive = source["exclusive"];
	        this.messageTtl = source["messageTtl"];
	        this.autoExpire = source["autoExpire"];
	        this.maxLength = source["maxLength"];
	        this.maxLengthBytes = source["maxLengthBytes"];
	        this.maxPriority = source["maxPriority"];
	        this.deadLetterExchange = source["deadLetterExchange"];
	        this.deadLetterRoutingKey = source["deadLetterRoutingKey"];
	        this.overflow = source["overflow"];
	        this.deliveryLimit = source["deliveryLimit"];
	        this.customArguments = source["customArguments"];
	    }
	}
	export class PeekRMQMessagesParams {
	    vhost: string;
	    queueName: string;
	    count: number;
	    ackMode: string;
	    encoding: string;
	
	    static createFrom(source: any = {}) {
	        return new PeekRMQMessagesParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vhost = source["vhost"];
	        this.queueName = source["queueName"];
	        this.count = source["count"];
	        this.ackMode = source["ackMode"];
	        this.encoding = source["encoding"];
	    }
	}
	export class PublishRMQMessageParams {
	    vhost: string;
	    exchange: string;
	    routingKey: string;
	    payload: string;
	    contentType: string;
	    deliveryMode: number;
	    priority: number;
	    correlationId?: string;
	    replyTo?: string;
	    expiration?: string;
	    messageId?: string;
	    type?: string;
	    headers?: Record<string, any>;
	    mandatory: boolean;
	    waitForConfirm: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PublishRMQMessageParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vhost = source["vhost"];
	        this.exchange = source["exchange"];
	        this.routingKey = source["routingKey"];
	        this.payload = source["payload"];
	        this.contentType = source["contentType"];
	        this.deliveryMode = source["deliveryMode"];
	        this.priority = source["priority"];
	        this.correlationId = source["correlationId"];
	        this.replyTo = source["replyTo"];
	        this.expiration = source["expiration"];
	        this.messageId = source["messageId"];
	        this.type = source["type"];
	        this.headers = source["headers"];
	        this.mandatory = source["mandatory"];
	        this.waitForConfirm = source["waitForConfirm"];
	    }
	}
	export class PublishRMQMessageResult {
	    success: boolean;
	    confirmed: boolean;
	    returned: boolean;
	    returnReason?: string;
	    messageId?: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new PublishRMQMessageResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.confirmed = source["confirmed"];
	        this.returned = source["returned"];
	        this.returnReason = source["returnReason"];
	        this.messageId = source["messageId"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class RMQBindingInfo {
	    source: string;
	    vhost: string;
	    destination: string;
	    destinationType: string;
	    routingKey: string;
	    arguments?: Record<string, any>;
	    propertiesKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new RMQBindingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.vhost = source["vhost"];
	        this.destination = source["destination"];
	        this.destinationType = source["destinationType"];
	        this.routingKey = source["routingKey"];
	        this.arguments = source["arguments"];
	        this.propertiesKey = source["propertiesKey"];
	    }
	}
	export class RMQMessageRates {
	    publishRate: number;
	    deliverRate: number;
	    ackRate: number;
	
	    static createFrom(source: any = {}) {
	        return new RMQMessageRates(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.publishRate = source["publishRate"];
	        this.deliverRate = source["deliverRate"];
	        this.ackRate = source["ackRate"];
	    }
	}
	export class RMQClusterStatus {
	    connected: boolean;
	    connecting: boolean;
	    protocol: string;
	    lastError?: string;
	    currentProfileId?: string;
	    endpoint: string;
	    managementUrl?: string;
	    managementAvailable: boolean;
	    vhost: string;
	    clusterName?: string;
	    rabbitmqVersion?: string;
	    erlangVersion?: string;
	    queuesCount: number;
	    exchangesCount: number;
	    connectionsCount: number;
	    channelsCount: number;
	    consumersCount: number;
	    rttMs: number;
	    diskFreeAlarm: boolean;
	    memoryAlarm: boolean;
	    messageRates?: RMQMessageRates;
	
	    static createFrom(source: any = {}) {
	        return new RMQClusterStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.connecting = source["connecting"];
	        this.protocol = source["protocol"];
	        this.lastError = source["lastError"];
	        this.currentProfileId = source["currentProfileId"];
	        this.endpoint = source["endpoint"];
	        this.managementUrl = source["managementUrl"];
	        this.managementAvailable = source["managementAvailable"];
	        this.vhost = source["vhost"];
	        this.clusterName = source["clusterName"];
	        this.rabbitmqVersion = source["rabbitmqVersion"];
	        this.erlangVersion = source["erlangVersion"];
	        this.queuesCount = source["queuesCount"];
	        this.exchangesCount = source["exchangesCount"];
	        this.connectionsCount = source["connectionsCount"];
	        this.channelsCount = source["channelsCount"];
	        this.consumersCount = source["consumersCount"];
	        this.rttMs = source["rttMs"];
	        this.diskFreeAlarm = source["diskFreeAlarm"];
	        this.memoryAlarm = source["memoryAlarm"];
	        this.messageRates = this.convertValues(source["messageRates"], RMQMessageRates);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RMQConsumerInfo {
	    consumerTag: string;
	    channelPid: string;
	    prefetch: number;
	    ackRequired: boolean;
	    exclusive: boolean;
	    active: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RMQConsumerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.consumerTag = source["consumerTag"];
	        this.channelPid = source["channelPid"];
	        this.prefetch = source["prefetch"];
	        this.ackRequired = source["ackRequired"];
	        this.exclusive = source["exclusive"];
	        this.active = source["active"];
	    }
	}
	export class RMQExchangeDetail {
	    name: string;
	    vhost: string;
	    type: string;
	    durable: boolean;
	    autoDelete: boolean;
	    internal: boolean;
	    arguments?: Record<string, any>;
	    messageRates: RMQMessageRates;
	    bindingsSource: RMQBindingInfo[];
	    bindingsDestination: RMQBindingInfo[];
	
	    static createFrom(source: any = {}) {
	        return new RMQExchangeDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.vhost = source["vhost"];
	        this.type = source["type"];
	        this.durable = source["durable"];
	        this.autoDelete = source["autoDelete"];
	        this.internal = source["internal"];
	        this.arguments = source["arguments"];
	        this.messageRates = this.convertValues(source["messageRates"], RMQMessageRates);
	        this.bindingsSource = this.convertValues(source["bindingsSource"], RMQBindingInfo);
	        this.bindingsDestination = this.convertValues(source["bindingsDestination"], RMQBindingInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RMQExchangeSummary {
	    name: string;
	    vhost: string;
	    type: string;
	    durable: boolean;
	    autoDelete: boolean;
	    internal: boolean;
	    arguments?: Record<string, any>;
	    messageRates: RMQMessageRates;
	
	    static createFrom(source: any = {}) {
	        return new RMQExchangeSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.vhost = source["vhost"];
	        this.type = source["type"];
	        this.durable = source["durable"];
	        this.autoDelete = source["autoDelete"];
	        this.internal = source["internal"];
	        this.arguments = source["arguments"];
	        this.messageRates = this.convertValues(source["messageRates"], RMQMessageRates);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RMQMessage {
	    payload: string;
	    payloadBytes: number;
	    payloadEncoding: string;
	    exchange: string;
	    routingKey: string;
	    deliveryTag: number;
	    redelivered: boolean;
	    messageCount: number;
	    contentType: string;
	    contentEncoding: string;
	    deliveryMode: number;
	    priority: number;
	    correlationId?: string;
	    replyTo?: string;
	    expiration?: string;
	    messageId?: string;
	    timestamp: number;
	    type?: string;
	    userId?: string;
	    appId?: string;
	    headers?: Record<string, any>;
	    queueName?: string;
	
	    static createFrom(source: any = {}) {
	        return new RMQMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.payload = source["payload"];
	        this.payloadBytes = source["payloadBytes"];
	        this.payloadEncoding = source["payloadEncoding"];
	        this.exchange = source["exchange"];
	        this.routingKey = source["routingKey"];
	        this.deliveryTag = source["deliveryTag"];
	        this.redelivered = source["redelivered"];
	        this.messageCount = source["messageCount"];
	        this.contentType = source["contentType"];
	        this.contentEncoding = source["contentEncoding"];
	        this.deliveryMode = source["deliveryMode"];
	        this.priority = source["priority"];
	        this.correlationId = source["correlationId"];
	        this.replyTo = source["replyTo"];
	        this.expiration = source["expiration"];
	        this.messageId = source["messageId"];
	        this.timestamp = source["timestamp"];
	        this.type = source["type"];
	        this.userId = source["userId"];
	        this.appId = source["appId"];
	        this.headers = source["headers"];
	        this.queueName = source["queueName"];
	    }
	}
	
	export class RMQNodeInfo {
	    name: string;
	    type: string;
	    running: boolean;
	    uptimeSeconds: number;
	    memUsed: number;
	    memLimit: number;
	    memAlarm: boolean;
	    diskFree: number;
	    diskFreeLimit: number;
	    diskFreeAlarm: boolean;
	    fdUsed: number;
	    fdTotal: number;
	    socketsUsed: number;
	    socketsTotal: number;
	    processorsCount: number;
	    erlangProcesses: number;
	
	    static createFrom(source: any = {}) {
	        return new RMQNodeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.running = source["running"];
	        this.uptimeSeconds = source["uptimeSeconds"];
	        this.memUsed = source["memUsed"];
	        this.memLimit = source["memLimit"];
	        this.memAlarm = source["memAlarm"];
	        this.diskFree = source["diskFree"];
	        this.diskFreeLimit = source["diskFreeLimit"];
	        this.diskFreeAlarm = source["diskFreeAlarm"];
	        this.fdUsed = source["fdUsed"];
	        this.fdTotal = source["fdTotal"];
	        this.socketsUsed = source["socketsUsed"];
	        this.socketsTotal = source["socketsTotal"];
	        this.processorsCount = source["processorsCount"];
	        this.erlangProcesses = source["erlangProcesses"];
	    }
	}
	export class RMQOverview {
	    clusterName: string;
	    rabbitmqVersion: string;
	    erlangVersion: string;
	    totalQueues: number;
	    totalExchanges: number;
	    totalConnections: number;
	    totalChannels: number;
	    totalConsumers: number;
	    totalMessages: number;
	    messagesReady: number;
	    messagesUnack: number;
	    messageRates: RMQMessageRates;
	    diskFreeAlarm: boolean;
	    memoryAlarm: boolean;
	    vhosts: string[];
	
	    static createFrom(source: any = {}) {
	        return new RMQOverview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clusterName = source["clusterName"];
	        this.rabbitmqVersion = source["rabbitmqVersion"];
	        this.erlangVersion = source["erlangVersion"];
	        this.totalQueues = source["totalQueues"];
	        this.totalExchanges = source["totalExchanges"];
	        this.totalConnections = source["totalConnections"];
	        this.totalChannels = source["totalChannels"];
	        this.totalConsumers = source["totalConsumers"];
	        this.totalMessages = source["totalMessages"];
	        this.messagesReady = source["messagesReady"];
	        this.messagesUnack = source["messagesUnack"];
	        this.messageRates = this.convertValues(source["messageRates"], RMQMessageRates);
	        this.diskFreeAlarm = source["diskFreeAlarm"];
	        this.memoryAlarm = source["memoryAlarm"];
	        this.vhosts = source["vhosts"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RMQQueueDetail {
	    name: string;
	    vhost: string;
	    type: string;
	    durable: boolean;
	    autoDelete: boolean;
	    exclusive: boolean;
	    state: string;
	    messages: number;
	    messagesReady: number;
	    messagesUnacknowledged: number;
	    consumers: number;
	    memory: number;
	    leaderNode?: string;
	    messageRates: RMQMessageRates;
	    arguments?: Record<string, any>;
	    hasDlx: boolean;
	    dlxTarget?: string;
	    dlxRoutingKey?: string;
	    consumersList: RMQConsumerInfo[];
	    bindings: RMQBindingInfo[];
	
	    static createFrom(source: any = {}) {
	        return new RMQQueueDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.vhost = source["vhost"];
	        this.type = source["type"];
	        this.durable = source["durable"];
	        this.autoDelete = source["autoDelete"];
	        this.exclusive = source["exclusive"];
	        this.state = source["state"];
	        this.messages = source["messages"];
	        this.messagesReady = source["messagesReady"];
	        this.messagesUnacknowledged = source["messagesUnacknowledged"];
	        this.consumers = source["consumers"];
	        this.memory = source["memory"];
	        this.leaderNode = source["leaderNode"];
	        this.messageRates = this.convertValues(source["messageRates"], RMQMessageRates);
	        this.arguments = source["arguments"];
	        this.hasDlx = source["hasDlx"];
	        this.dlxTarget = source["dlxTarget"];
	        this.dlxRoutingKey = source["dlxRoutingKey"];
	        this.consumersList = this.convertValues(source["consumersList"], RMQConsumerInfo);
	        this.bindings = this.convertValues(source["bindings"], RMQBindingInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RMQQueueSummary {
	    name: string;
	    vhost: string;
	    type: string;
	    durable: boolean;
	    autoDelete: boolean;
	    exclusive: boolean;
	    state: string;
	    messages: number;
	    messagesReady: number;
	    messagesUnacknowledged: number;
	    consumers: number;
	    memory: number;
	    leaderNode?: string;
	    messageRates: RMQMessageRates;
	    arguments?: Record<string, any>;
	    hasDlx: boolean;
	    dlxTarget?: string;
	    dlxRoutingKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new RMQQueueSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.vhost = source["vhost"];
	        this.type = source["type"];
	        this.durable = source["durable"];
	        this.autoDelete = source["autoDelete"];
	        this.exclusive = source["exclusive"];
	        this.state = source["state"];
	        this.messages = source["messages"];
	        this.messagesReady = source["messagesReady"];
	        this.messagesUnacknowledged = source["messagesUnacknowledged"];
	        this.consumers = source["consumers"];
	        this.memory = source["memory"];
	        this.leaderNode = source["leaderNode"];
	        this.messageRates = this.convertValues(source["messageRates"], RMQMessageRates);
	        this.arguments = source["arguments"];
	        this.hasDlx = source["hasDlx"];
	        this.dlxTarget = source["dlxTarget"];
	        this.dlxRoutingKey = source["dlxRoutingKey"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RMQVHostInfo {
	    name: string;
	    messages: number;
	    messagesReady: number;
	    messagesUnacknowledged: number;
	    tracing: boolean;
	    messageRates: RMQMessageRates;
	
	    static createFrom(source: any = {}) {
	        return new RMQVHostInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.messages = source["messages"];
	        this.messagesReady = source["messagesReady"];
	        this.messagesUnacknowledged = source["messagesUnacknowledged"];
	        this.tracing = source["tracing"];
	        this.messageRates = this.convertValues(source["messageRates"], RMQMessageRates);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RedriveDLQParams {
	    vhost: string;
	    sourceQueue: string;
	    targetExchange: string;
	    targetRoutingKey: string;
	    maxMessages: number;
	
	    static createFrom(source: any = {}) {
	        return new RedriveDLQParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vhost = source["vhost"];
	        this.sourceQueue = source["sourceQueue"];
	        this.targetExchange = source["targetExchange"];
	        this.targetRoutingKey = source["targetRoutingKey"];
	        this.maxMessages = source["maxMessages"];
	    }
	}
	export class RedriveDLQResult {
	    movedCount: number;
	    failedCount: number;
	    errors?: string[];
	
	    static createFrom(source: any = {}) {
	        return new RedriveDLQResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.movedCount = source["movedCount"];
	        this.failedCount = source["failedCount"];
	        this.errors = source["errors"];
	    }
	}

}

export namespace sqsmanager {
	
	export class CreateQueueParams {
	    queueName: string;
	    isFifo: boolean;
	    visibilityTimeout: number;
	    messageRetentionPeriod: number;
	    delaySeconds: number;
	    maximumMessageSize: number;
	    receiveMessageWaitTimeSeconds: number;
	    contentBasedDeduplication: boolean;
	    deduplicationScope?: string;
	    fifoThroughputLimit?: string;
	    enableDlq: boolean;
	    deadLetterTargetArn?: string;
	    maxReceiveCount?: number;
	    serverSideEncryption?: string;
	    kmsMasterKeyId?: string;
	    tags?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new CreateQueueParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queueName = source["queueName"];
	        this.isFifo = source["isFifo"];
	        this.visibilityTimeout = source["visibilityTimeout"];
	        this.messageRetentionPeriod = source["messageRetentionPeriod"];
	        this.delaySeconds = source["delaySeconds"];
	        this.maximumMessageSize = source["maximumMessageSize"];
	        this.receiveMessageWaitTimeSeconds = source["receiveMessageWaitTimeSeconds"];
	        this.contentBasedDeduplication = source["contentBasedDeduplication"];
	        this.deduplicationScope = source["deduplicationScope"];
	        this.fifoThroughputLimit = source["fifoThroughputLimit"];
	        this.enableDlq = source["enableDlq"];
	        this.deadLetterTargetArn = source["deadLetterTargetArn"];
	        this.maxReceiveCount = source["maxReceiveCount"];
	        this.serverSideEncryption = source["serverSideEncryption"];
	        this.kmsMasterKeyId = source["kmsMasterKeyId"];
	        this.tags = source["tags"];
	    }
	}
	export class PollSQSMessagesParams {
	    queueUrl: string;
	    mode: string;
	    maxMessages: number;
	    waitTimeSeconds: number;
	    visibilityTimeout: number;
	    autoDelete: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PollSQSMessagesParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queueUrl = source["queueUrl"];
	        this.mode = source["mode"];
	        this.maxMessages = source["maxMessages"];
	        this.waitTimeSeconds = source["waitTimeSeconds"];
	        this.visibilityTimeout = source["visibilityTimeout"];
	        this.autoDelete = source["autoDelete"];
	    }
	}
	export class RedriveDLQParams {
	    sourceQueueUrl: string;
	    targetQueueUrl: string;
	    maxMessages: number;
	
	    static createFrom(source: any = {}) {
	        return new RedriveDLQParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceQueueUrl = source["sourceQueueUrl"];
	        this.targetQueueUrl = source["targetQueueUrl"];
	        this.maxMessages = source["maxMessages"];
	    }
	}
	export class RedriveDLQResult {
	    messagesMoved: number;
	    errorsCount: number;
	    statusMessage: string;
	
	    static createFrom(source: any = {}) {
	        return new RedriveDLQResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messagesMoved = source["messagesMoved"];
	        this.errorsCount = source["errorsCount"];
	        this.statusMessage = source["statusMessage"];
	    }
	}
	export class SQSClusterStatus {
	    connected: boolean;
	    connecting: boolean;
	    protocol: string;
	    lastError?: string;
	    currentProfileId?: string;
	    endpoint: string;
	    region: string;
	    accountId?: string;
	    queuesCount: number;
	    rttMs: number;
	    isLocal: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SQSClusterStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.connecting = source["connecting"];
	        this.protocol = source["protocol"];
	        this.lastError = source["lastError"];
	        this.currentProfileId = source["currentProfileId"];
	        this.endpoint = source["endpoint"];
	        this.region = source["region"];
	        this.accountId = source["accountId"];
	        this.queuesCount = source["queuesCount"];
	        this.rttMs = source["rttMs"];
	        this.isLocal = source["isLocal"];
	    }
	}
	export class SQSMessageAttribute {
	    dataType: string;
	    stringValue?: string;
	    binaryValue?: string;
	
	    static createFrom(source: any = {}) {
	        return new SQSMessageAttribute(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dataType = source["dataType"];
	        this.stringValue = source["stringValue"];
	        this.binaryValue = source["binaryValue"];
	    }
	}
	export class SQSMessage {
	    messageId: string;
	    receiptHandle: string;
	    md5OfBody: string;
	    body: string;
	    queueUrl: string;
	    queueName: string;
	    sentTimestamp: number;
	    firstReceiveTimestamp: number;
	    receiveCount: number;
	    messageGroupId?: string;
	    messageDeduplicationId?: string;
	    sequenceNumber?: string;
	    attributes?: Record<string, string>;
	    messageAttributes?: Record<string, SQSMessageAttribute>;
	
	    static createFrom(source: any = {}) {
	        return new SQSMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messageId = source["messageId"];
	        this.receiptHandle = source["receiptHandle"];
	        this.md5OfBody = source["md5OfBody"];
	        this.body = source["body"];
	        this.queueUrl = source["queueUrl"];
	        this.queueName = source["queueName"];
	        this.sentTimestamp = source["sentTimestamp"];
	        this.firstReceiveTimestamp = source["firstReceiveTimestamp"];
	        this.receiveCount = source["receiveCount"];
	        this.messageGroupId = source["messageGroupId"];
	        this.messageDeduplicationId = source["messageDeduplicationId"];
	        this.sequenceNumber = source["sequenceNumber"];
	        this.attributes = source["attributes"];
	        this.messageAttributes = this.convertValues(source["messageAttributes"], SQSMessageAttribute, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SQSQueueDetail {
	    queueUrl: string;
	    queueName: string;
	    isFifo: boolean;
	    approximateNumberOfMessages: number;
	    approximateNumberOfNotVisible: number;
	    approximateNumberOfDelayed: number;
	    visibilityTimeoutSeconds: number;
	    messageRetentionSeconds: number;
	    delaySeconds: number;
	    createdTimestamp: number;
	    lastModifiedTimestamp: number;
	    queueArn: string;
	    isDeadLetterQueue: boolean;
	    hasRedrivePolicy: boolean;
	    deadLetterTargetArn?: string;
	    maxReceiveCount?: number;
	    serverSideEncryption?: string;
	    policy?: string;
	    redrivePolicy?: string;
	    redriveAllowPolicy?: string;
	    tags?: Record<string, string>;
	    deadLetterSourceQueues?: string[];
	    maximumMessageSize: number;
	    receiveMessageWaitTimeSeconds: number;
	    deduplicationScope?: string;
	    fifoThroughputLimit?: string;
	    contentBasedDeduplication: boolean;
	    kmsMasterKeyId?: string;
	    kmsDataKeyReusePeriodSeconds?: number;
	    sqsManagedSseEnabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SQSQueueDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queueUrl = source["queueUrl"];
	        this.queueName = source["queueName"];
	        this.isFifo = source["isFifo"];
	        this.approximateNumberOfMessages = source["approximateNumberOfMessages"];
	        this.approximateNumberOfNotVisible = source["approximateNumberOfNotVisible"];
	        this.approximateNumberOfDelayed = source["approximateNumberOfDelayed"];
	        this.visibilityTimeoutSeconds = source["visibilityTimeoutSeconds"];
	        this.messageRetentionSeconds = source["messageRetentionSeconds"];
	        this.delaySeconds = source["delaySeconds"];
	        this.createdTimestamp = source["createdTimestamp"];
	        this.lastModifiedTimestamp = source["lastModifiedTimestamp"];
	        this.queueArn = source["queueArn"];
	        this.isDeadLetterQueue = source["isDeadLetterQueue"];
	        this.hasRedrivePolicy = source["hasRedrivePolicy"];
	        this.deadLetterTargetArn = source["deadLetterTargetArn"];
	        this.maxReceiveCount = source["maxReceiveCount"];
	        this.serverSideEncryption = source["serverSideEncryption"];
	        this.policy = source["policy"];
	        this.redrivePolicy = source["redrivePolicy"];
	        this.redriveAllowPolicy = source["redriveAllowPolicy"];
	        this.tags = source["tags"];
	        this.deadLetterSourceQueues = source["deadLetterSourceQueues"];
	        this.maximumMessageSize = source["maximumMessageSize"];
	        this.receiveMessageWaitTimeSeconds = source["receiveMessageWaitTimeSeconds"];
	        this.deduplicationScope = source["deduplicationScope"];
	        this.fifoThroughputLimit = source["fifoThroughputLimit"];
	        this.contentBasedDeduplication = source["contentBasedDeduplication"];
	        this.kmsMasterKeyId = source["kmsMasterKeyId"];
	        this.kmsDataKeyReusePeriodSeconds = source["kmsDataKeyReusePeriodSeconds"];
	        this.sqsManagedSseEnabled = source["sqsManagedSseEnabled"];
	    }
	}
	export class SQSQueueSummary {
	    queueUrl: string;
	    queueName: string;
	    isFifo: boolean;
	    approximateNumberOfMessages: number;
	    approximateNumberOfNotVisible: number;
	    approximateNumberOfDelayed: number;
	    visibilityTimeoutSeconds: number;
	    messageRetentionSeconds: number;
	    delaySeconds: number;
	    createdTimestamp: number;
	    lastModifiedTimestamp: number;
	    queueArn: string;
	    isDeadLetterQueue: boolean;
	    hasRedrivePolicy: boolean;
	    deadLetterTargetArn?: string;
	    maxReceiveCount?: number;
	    serverSideEncryption?: string;
	
	    static createFrom(source: any = {}) {
	        return new SQSQueueSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queueUrl = source["queueUrl"];
	        this.queueName = source["queueName"];
	        this.isFifo = source["isFifo"];
	        this.approximateNumberOfMessages = source["approximateNumberOfMessages"];
	        this.approximateNumberOfNotVisible = source["approximateNumberOfNotVisible"];
	        this.approximateNumberOfDelayed = source["approximateNumberOfDelayed"];
	        this.visibilityTimeoutSeconds = source["visibilityTimeoutSeconds"];
	        this.messageRetentionSeconds = source["messageRetentionSeconds"];
	        this.delaySeconds = source["delaySeconds"];
	        this.createdTimestamp = source["createdTimestamp"];
	        this.lastModifiedTimestamp = source["lastModifiedTimestamp"];
	        this.queueArn = source["queueArn"];
	        this.isDeadLetterQueue = source["isDeadLetterQueue"];
	        this.hasRedrivePolicy = source["hasRedrivePolicy"];
	        this.deadLetterTargetArn = source["deadLetterTargetArn"];
	        this.maxReceiveCount = source["maxReceiveCount"];
	        this.serverSideEncryption = source["serverSideEncryption"];
	    }
	}
	export class SendSQSMessageParams {
	    queueUrl: string;
	    body: string;
	    delaySeconds: number;
	    messageGroupId?: string;
	    messageDeduplicationId?: string;
	    messageAttributes?: Record<string, SQSMessageAttribute>;
	
	    static createFrom(source: any = {}) {
	        return new SendSQSMessageParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queueUrl = source["queueUrl"];
	        this.body = source["body"];
	        this.delaySeconds = source["delaySeconds"];
	        this.messageGroupId = source["messageGroupId"];
	        this.messageDeduplicationId = source["messageDeduplicationId"];
	        this.messageAttributes = this.convertValues(source["messageAttributes"], SQSMessageAttribute, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SendSQSMessageResult {
	    messageId: string;
	    md5OfBody: string;
	    sequenceNumber?: string;
	
	    static createFrom(source: any = {}) {
	        return new SendSQSMessageResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messageId = source["messageId"];
	        this.md5OfBody = source["md5OfBody"];
	        this.sequenceNumber = source["sequenceNumber"];
	    }
	}

}

export namespace storage {
	
	export class ConnectionProfile {
	    id: string;
	    protocol: string;
	    name: string;
	    url: string;
	    authType: string;
	    username?: string;
	    password?: string;
	    token?: string;
	    nkeySeed?: string;
	    credsFilePath?: string;
	    tlsCAFile?: string;
	    tlsCertFile?: string;
	    tlsKeyFile?: string;
	    tlsInsecure: boolean;
	    tlsSNI?: string;
	    clientName: string;
	    awsRegion?: string;
	    awsProfile?: string;
	    managementUrl?: string;
	    vhost?: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	    // Go type: time
	    lastConnectedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.protocol = source["protocol"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.authType = source["authType"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.token = source["token"];
	        this.nkeySeed = source["nkeySeed"];
	        this.credsFilePath = source["credsFilePath"];
	        this.tlsCAFile = source["tlsCAFile"];
	        this.tlsCertFile = source["tlsCertFile"];
	        this.tlsKeyFile = source["tlsKeyFile"];
	        this.tlsInsecure = source["tlsInsecure"];
	        this.tlsSNI = source["tlsSNI"];
	        this.clientName = source["clientName"];
	        this.awsRegion = source["awsRegion"];
	        this.awsProfile = source["awsProfile"];
	        this.managementUrl = source["managementUrl"];
	        this.vhost = source["vhost"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	        this.lastConnectedAt = this.convertValues(source["lastConnectedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

