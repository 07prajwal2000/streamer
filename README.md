<h1 align="center">Streamer ⚡</h1>

<p align="center">
  <img src="build/appicon.png" alt="Streamer Icon" width="140" height="140" />
</p>

<p align="center">
  <b>A unified, high-performance desktop GUI suite for Apache Kafka, Redpanda, and NATS (JetStream & KV).</b>
  <br />
  Built with <b>Pure Go</b> (Zero CGO), <b>Wails v2</b>, <b>React 18</b>, <b>TypeScript</b>, and <b>Tailwind CSS</b>.
</p>

<p align="center">
  <a href="https://github.com/07prajwal2000/streamer">
    <img src="https://img.shields.io/github/stars/07prajwal2000/streamer?style=social" alt="GitHub stars" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform support" />
  <img src="https://img.shields.io/badge/Pure%20Go-Zero%20CGO-00ADD8?logo=go" alt="Pure Go Zero CGO" />
  <img src="https://img.shields.io/badge/Apache%20Kafka-v2.0+-231F20?logo=apachekafka" alt="Kafka Support" />
  <img src="https://img.shields.io/badge/Redpanda-Supported-EC1C24?logo=redpanda" alt="Redpanda Support" />
  <img src="https://img.shields.io/badge/NATS-v2.10+-00ADEF?logo=nats.io" alt="NATS Support" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

![Streamer Screenshot](./screenshots/connection.png)

## 🌟 Overview

**Streamer** is an intuitive, fast, developer-centric desktop management application for modern distributed streaming platforms. Designed from the ground up for high throughput and zero native C-library headaches, Streamer provides first-class support for both **Apache Kafka & Redpanda** and **NATS & JetStream** in a single desktop application.

Switch seamlessly between event streaming systems without leaving your workspace, inspect partition metrics, monitor consumer lag, tail live message streams, produce records with custom keys and headers, and manage cluster resources with ease.

---

## ✨ Key Features

### 🔌 Unified Connection Management
- **Multi-Protocol Support**: Connect to **Apache Kafka**, **Redpanda**, **WarpStream**, **AWS MSK**, or **NATS** clusters with automatic protocol detection and dedicated visual branding.
- **Enterprise Authentication**:
  - **Kafka / Redpanda**: PLAINTEXT, SASL/PLAIN, SASL SCRAM-256, SASL SCRAM-512, TLS/SSL, mTLS (Client Certificate & Key), and custom TLS SNI.
  - **NATS**: Anonymous, Username & Password, Token, NKey, and User Credentials (`.creds` file).
- **Persistent Profiles**: Connection configurations are stored locally in an embedded, pure-Go SQLite database (`modernc.org/sqlite`).
- **Live Diagnostics**: Real-time heartbeat, round-trip time (RTT latency in ms), active broker node count, and connection health status.

---

### 📦 Apache Kafka & Redpanda Suite

#### 1. Cluster & Broker Discovery
- **Cluster Overview**: Cluster ID, Active Controller Node ID, total broker count, and overall cluster health.
- **Brokers Table**: Inspect all brokers with Node ID, Host/IP, Port, Rack assignment, and live ping latency.
- **Dynamic Configs Inspector**: View and filter broker configuration parameters (both dynamic alterations and default cluster configs).

#### 2. Topic Operations & Partition Health
- **Topic Lifecycle**: Create topics with custom partition counts, replication factors, cleanup policies (`delete` vs. `compact`), and retention settings (`retention.ms`, `retention.bytes`).
- **Partition Alterations**: Increase topic partition counts on the fly without broker restarts.
- **Configuration Alterations**: View, edit, add, or reset topic configuration entries dynamically (`kadm.AlterTopicConfigs`).
- **Partition-by-Partition Health**: Detailed partition breakdown displaying Leader broker, Replicas, In-Sync Replicas (ISR), start offsets, and high watermarks. Visual indicators flag under-replicated partitions.
- **Topic Purging**: Permanently delete records across all partitions up to the high watermark via Kafka log truncation (`kadm.DeleteRecords`).

#### 3. Consumer Groups & Lag Monitoring
- **Group Explorer**: List all consumer groups with state (`Stable`, `Empty`, `Dead`, `PreparingRebalance`, `CompletingRebalance`), protocol assignor, coordinator broker, total lag, and member counts.
- **Partition Lag Breakdown**: Inspect consumer lag per topic-partition with current committed offset vs. end offset.
- **Active Member Mapping**: View connected client IDs, hosts, and partition assignment distributions.
- **Offset Reset Tooling**: Safely reset consumer group offsets across topics with 4 strategies:
  - **Earliest**: Rewind to beginning.
  - **Latest**: Fast-forward to end.
  - **By Timestamp**: Point-in-time rewind using datetime picker.
  - **Specific Offset**: Manual offset target.
- **Group Deletion**: Delete inactive/empty consumer groups.

#### 4. Messages Explorer, Live Tail & Producer
- **Multi-Strategy Record Querying**: Direct, unmanaged partition consumption (`kgo.ConsumePartitions`) that never interferes with consumer groups or commits offsets:
  - **Latest Messages**: Fetch latest $N$ records (25, 50, 100, 250, 500).
  - **From Beginning**: Read from low watermark offsets.
  - **By Timestamp**: Query records from a specific date and time.
  - **By Offset**: Seek directly to a numerical partition offset.
- **Real-Time Live Tail**: Stream incoming topic records live via WebSocket-backed Wails runtime events with start/stop toggle.
- **Search & Filtering**: Instant client-side filtering across Message Key, Payload content, and custom Record Headers.
- **Interactive Producer**: Publish messages with custom partition keys, explicit or automatic partition targeting, structured key-value headers, and JSON formatting.
- **Message Deletion & Log Truncation**:
  - **Delete Topic / Partition Messages**: Advance partition low-watermark offsets on the broker to permanently delete records.
  - **Purge Partition Up to Offset**: Purge all messages in a partition up to a selected record's offset.
  - **Tombstone Publisher**: Publish null-payload tombstone records to delete keys in log-compacted topics.
- **Deep Payload Inspector**:
  - **JSON Mode**: Syntax-highlighted and indented JSON tree.
  - **Plain Text Mode**: Monospace text viewer with optional word-wrap toggle.
  - **Hex Dump Mode**: Hexadecimal byte pairs with 16-byte row offsets and ASCII representation.

---

### 📡 NATS & JetStream Suite

#### 1. Core Pub/Sub Live Streamer
- **Multi-Subject Subscription**: Subscribe to multiple subjects with wildcard support (`foo.*`, `events.>`).
- **Interactive Publisher**: Publish messages with custom subject, payload, and structured NATS headers.
- **Message Inspection**: Auto-detects JSON with interactive collapsible tree views, syntax highlighting, and raw / hex-dump modes.
- **Resizable Layout**: Drag panel borders to resize subscriptions, message feeds, and publisher windows.

#### 2. Advanced JetStream Management
- **Full Stream Lifecycle**: Create, edit, inspect, seal, and purge JetStream streams.
- **Message Browsing by Default**:
  - **Message List Mode (Default)**: Batch browsing with customizable limits (50, 100, 200, 500), auto-polling live reload, and keyword filter.
  - **Single Sequence Stepper**: Jump directly to first, last, or any sequence number with prev/next controls.
- **Headers & Metadata**: Inspect raw NATS message headers, sequence IDs, timestamps, and delivery counts.
- **Consumer Management**: Inspect push and pull consumers, filter subjects, ack policies, replay policies, and pending message counts.
- **Single Sequence Deletion**: Remove specific message sequences via `DeleteStreamMsg`.

#### 3. Key-Value (KV) Bucket Explorer
- **Bucket Operations**: Create buckets with custom TTLs, max history (revisions per key), and storage backends (File vs. Memory).
- **Interactive Put Key Modal**: Dual edit and syntax-highlighted formatted tree tabs with one-click JSON prettifier and validation.
- **Revision History**: Inspect all historical values, sequence numbers, and timestamps of any key.
- **Watch & Search**: Fast real-time filtering across bucket keys.

---

## 🛠️ Architecture & Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Desktop Framework** | [Wails v2](https://wails.io/) | Lightweight native desktop shells with fast Go-to-TypeScript IPC |
| **Kafka Engine** | [`franz-go`](https://github.com/twmb/franz-go) | **100% Pure Go** Kafka client library (Zero CGO, no librdkafka dependencies) |
| **NATS Engine** | [`nats.go`](https://github.com/nats-io/nats.go) | Official high-performance pure-Go NATS and JetStream client |
| **Local Database** | [`modernc.org/sqlite`](https://gitlab.com/cznic/sqlite) | CGO-free pure Go SQLite driver for cross-platform persistence |
| **Frontend UI** | React 18, TypeScript, Tailwind CSS, Lucide Icons | Modern, responsive developer tool interface with dark mode styling |

> [!TIP]
> **Zero CGO Guarantee**: Streamer does not require GCC, MinGW, Clang, or native C build tools to compile. You can build binaries for any supported OS with standard `go build` and `wails build`.

---

## 🚀 Getting Started

### Prerequisites
- [Go](https://go.dev/dl/) 1.21+
- [Node.js](https://nodejs.org/) 18+ and `npm`
- [Wails CLI](https://wails.io/docs/gettingstarted/installation):
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### Development Mode
Start the live development environment with hot reloading:
```bash
wails dev
```

### Production Build

#### Local Build (Windows / Linux)
```bash
wails build
```
The compiled binary will be in `build/bin/streamer.exe` (Windows) or `build/bin/streamer` (Linux).

---

### 🍏 Building on macOS (Apple Silicon & Intel)

Due to Apple code-signing requirements, build Streamer locally on macOS:

1. **Install Dependencies**:
   ```bash
   xcode-select --install
   brew install go node
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```

2. **Clone & Build**:
   ```bash
   git clone https://github.com/07prajwal2000/streamer.git
   cd streamer/frontend && npm install && cd ..
   ```

3. **Build Target**:
   - **Apple Silicon (M1/M2/M3/M4)**:
     ```bash
     wails build -platform darwin/arm64
     ```
   - **Intel Macs**:
     ```bash
     wails build -platform darwin/amd64
     ```
   - **Universal Binary**:
     ```bash
     wails build -platform darwin/universal
     ```

4. **Run Application**:
   The packaged app bundle is located at `build/bin/streamer.app`. Drag it to your `/Applications` folder or run:
   ```bash
   open build/bin/streamer.app
   ```

---

## 👤 Author & Credits

Created by **[@07prajwal2000](https://github.com/07prajwal2000)**.

If you find Streamer useful, please consider giving it a ⭐️ on GitHub:
👉 [https://github.com/07prajwal2000/streamer](https://github.com/07prajwal2000/streamer)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
