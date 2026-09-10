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
	
	    static createFrom(source: any = {}) {
	        return new ServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.connecting = source["connecting"];
	        this.reconnecting = source["reconnecting"];
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

export namespace storage {
	
	export class ConnectionProfile {
	    id: string;
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
	    clientName: string;
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
	        this.clientName = source["clientName"];
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

