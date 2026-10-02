package rabbitmqmanager

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"streamer/internal/storage"

	rabbithole "github.com/michaelklishin/rabbit-hole/v3"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type RabbitMQManager struct {
	ctx           context.Context
	mu            sync.RWMutex
	amqpConn      *amqp.Connection
	httpCli       *rabbithole.Client
	httpClient    *http.Client
	profile       *storage.ConnectionProfile
	status        RMQClusterStatus
	stopPingCh    chan struct{}
	streamMu      sync.Mutex
	streamCh      *amqp.Channel
	streamTag     string
	streamDone    chan struct{}
	activeVHost   string
	managementURL string
}

func NewRabbitMQManager() *RabbitMQManager {
	return &RabbitMQManager{
		status: RMQClusterStatus{
			Connected: false,
			Protocol:  "rabbitmq",
		},
		activeVHost: "/",
	}
}

func (m *RabbitMQManager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

func (m *RabbitMQManager) GetAMQPConnection() (*amqp.Connection, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.amqpConn == nil || m.amqpConn.IsClosed() {
		return nil, fmt.Errorf("not connected to RabbitMQ AMQP broker")
	}
	return m.amqpConn, nil
}

func (m *RabbitMQManager) GetHTTPClient() (*rabbithole.Client, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.httpCli == nil {
		return nil, fmt.Errorf("RabbitMQ Management API is not available or not configured")
	}
	return m.httpCli, nil
}

func (m *RabbitMQManager) GetProfile() *storage.ConnectionProfile {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.profile
}

func (m *RabbitMQManager) GetStatus() RMQClusterStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *RabbitMQManager) emitStatus() {
	if m.ctx != nil {
		m.mu.RLock()
		status := m.status
		m.mu.RUnlock()
		runtime.EventsEmit(m.ctx, "rabbitmq:status", status)
	}
}

// buildTLSConfig configures TLS based on connection profile
func (m *RabbitMQManager) buildTLSConfig(p *storage.ConnectionProfile) (*tls.Config, error) {
	tlsCfg := &tls.Config{
		InsecureSkipVerify: p.TLSInsecure,
	}

	if p.TLSSNI != "" {
		tlsCfg.ServerName = strings.TrimSpace(p.TLSSNI)
	}

	if p.TLSCAFile != "" {
		caCert, err := os.ReadFile(p.TLSCAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate file: %w", err)
		}
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}
		tlsCfg.RootCAs = caCertPool
	}

	if p.TLSCertFile != "" && p.TLSKeyFile != "" {
		cert, err := tls.LoadX509KeyPair(p.TLSCertFile, p.TLSKeyFile)
		if err != nil {
			return nil, fmt.Errorf("failed to load client key pair: %w", err)
		}
		tlsCfg.Certificates = []tls.Certificate{cert}
	}

	return tlsCfg, nil
}

// parseConnectionInfo extracts connection parameters with intelligent defaults
func (m *RabbitMQManager) parseConnectionInfo(p *storage.ConnectionProfile) (amqpURL string, mgtURL string, vhost string, user string, pass string, isTLS bool, err error) {
	rawURL := strings.TrimSpace(p.URL)
	if rawURL == "" {
		rawURL = "amqp://127.0.0.1:5672/"
	}

	// Normalize scheme if missing
	if !strings.HasPrefix(rawURL, "amqp://") && !strings.HasPrefix(rawURL, "amqps://") {
		if p.TLSCertFile != "" || p.TLSCAFile != "" {
			rawURL = "amqps://" + rawURL
		} else {
			rawURL = "amqp://" + rawURL
		}
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return "", "", "", "", "", false, fmt.Errorf("invalid RabbitMQ URL %q: %w", rawURL, err)
	}

	isTLS = u.Scheme == "amqps"

	// Extract credentials from URL or explicit profile fields
	if u.User != nil {
		user = u.User.Username()
		pass, _ = u.User.Password()
	}
	if p.Username != "" {
		user = strings.TrimSpace(p.Username)
	}
	if p.Password != "" {
		pass = strings.TrimSpace(p.Password)
	}
	if user == "" {
		user = "guest"
	}
	if pass == "" {
		pass = "guest"
	}

	// Extract Virtual Host
	vhost = "/"
	if p.VHost != "" {
		vhost = strings.TrimSpace(p.VHost)
	} else if u.Path != "" && u.Path != "/" {
		// e.g. /my-vhost or /%2F
		trimmed := strings.TrimPrefix(u.Path, "/")
		if unescaped, err := url.PathUnescape(trimmed); err == nil && unescaped != "" {
			vhost = unescaped
		} else if trimmed != "" {
			vhost = trimmed
		}
	}

	// Reconstruct clean AMQP URI with user/pass
	host := u.Hostname()
	port := u.Port()
	if port == "" {
		if isTLS {
			port = "5671"
		} else {
			port = "5672"
		}
	}

	encodedVHost := url.PathEscape(vhost)
	if vhost == "/" {
		encodedVHost = ""
	}
	amqpURL = fmt.Sprintf("%s://%s:%s@%s:%s/%s", u.Scheme, url.QueryEscape(user), url.QueryEscape(pass), host, port, encodedVHost)

	// Determine Management HTTP URL
	if strings.TrimSpace(p.ManagementURL) != "" {
		mgtURL = strings.TrimRight(strings.TrimSpace(p.ManagementURL), "/")
	} else {
		// Auto-derive: default management port is 15672 (or 15671 for HTTPS)
		mgtScheme := "http"
		mgtPort := "15672"
		if isTLS {
			mgtScheme = "https"
			mgtPort = "15671"
		}
		mgtURL = fmt.Sprintf("%s://%s:%s", mgtScheme, host, mgtPort)
	}

	return amqpURL, mgtURL, vhost, user, pass, isTLS, nil
}

// buildClients instantiates AMQP connection and RabbitMQ Management HTTP client
func (m *RabbitMQManager) buildClients(p *storage.ConnectionProfile) (*amqp.Connection, *rabbithole.Client, *http.Client, string, string, string, error) {
	amqpURL, mgtURL, vhost, user, pass, isTLS, err := m.parseConnectionInfo(p)
	if err != nil {
		return nil, nil, nil, "", "", "", err
	}

	tlsCfg, err := m.buildTLSConfig(p)
	if err != nil {
		return nil, nil, nil, "", "", "", err
	}

	// AMQP Dial configuration
	amqpCfg := amqp.Config{
		Heartbeat: 10 * time.Second,
		Locale:    "en_US",
		Properties: amqp.Table{
			"connection_name": "Streamer Desktop GUI",
			"product":         "Streamer",
			"version":         "1.0.0",
			"platform":        "Desktop",
		},
		Dial: func(network, addr string) (net.Conn, error) {
			return net.DialTimeout(network, addr, 8*time.Second)
		},
	}
	if isTLS || p.TLSInsecure || p.TLSCAFile != "" || p.TLSCertFile != "" {
		amqpCfg.TLSClientConfig = tlsCfg
	}

	// Establish AMQP Connection
	conn, err := amqp.DialConfig(amqpURL, amqpCfg)
	if err != nil {
		return nil, nil, nil, "", "", "", fmt.Errorf("failed to dial AMQP endpoint (%s): %w", amqpURL, err)
	}

	// Setup Management HTTP Client
	httpTransport := &http.Transport{
		TLSClientConfig:       tlsCfg,
		ResponseHeaderTimeout: 8 * time.Second,
	}
	rawHTTPClient := &http.Client{
		Transport: httpTransport,
		Timeout:   10 * time.Second,
	}

	mgtClient, err := rabbithole.NewClient(mgtURL, user, pass)
	if err == nil && mgtClient != nil {
		mgtClient.SetTransport(httpTransport)
	}

	return conn, mgtClient, rawHTTPClient, amqpURL, mgtURL, vhost, nil
}

// TestConnection verifies connectivity, checks management API, and measures RTT latency
func (m *RabbitMQManager) TestConnection(p storage.ConnectionProfile) (*RMQClusterStatus, error) {
	conn, mgtCli, _, amqpURL, mgtURL, vhost, err := m.buildClients(&p)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	start := time.Now()
	// Open a lightweight probe channel to measure AMQP RTT
	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("AMQP channel error: %w", err)
	}
	_ = ch.Close()
	rtt := float64(time.Since(start).Microseconds()) / 1000.0

	status := &RMQClusterStatus{
		Connected:           true,
		Protocol:            "rabbitmq",
		CurrentProfileID:    p.ID,
		Endpoint:            amqpURL,
		ManagementURL:       mgtURL,
		VHost:               vhost,
		RTTMs:               rtt,
		ManagementAvailable: false,
	}

	// Test Management HTTP API if client initialized
	if mgtCli != nil {
		overview, err := mgtCli.Overview()
		if err == nil && overview != nil {
			clusterName := overview.Node
			if cn, err := mgtCli.GetClusterName(); err == nil && cn != nil && cn.Name != "" {
				clusterName = cn.Name
			}
			status.ManagementAvailable = true
			status.RabbitMQVersion = overview.RabbitMQVersion
			status.ErlangVersion = overview.ErlangVersion
			status.ClusterName = clusterName
			status.QueuesCount = overview.ObjectTotals.Queues
			status.ExchangesCount = overview.ObjectTotals.Exchanges
			status.ConnectionsCount = overview.ObjectTotals.Connections
			status.ChannelsCount = overview.ObjectTotals.Channels
			status.ConsumersCount = overview.ObjectTotals.Consumers
			status.MessageRates = &RMQMessageRates{
				PublishRate: float64(overview.MessageStats.PublishDetails.Rate),
				DeliverRate: float64(overview.MessageStats.DeliverGetDetails.Rate),
				AckRate:     float64(overview.MessageStats.AckDetails.Rate),
			}
		}
	}

	return status, nil
}

// Connect establishes active RabbitMQ AMQP connection and starts background telemetry
func (m *RabbitMQManager) Connect(p storage.ConnectionProfile) (*RMQClusterStatus, error) {
	m.Disconnect()

	m.mu.Lock()
	m.status = RMQClusterStatus{
		Connecting:       true,
		Protocol:         "rabbitmq",
		CurrentProfileID: p.ID,
	}
	m.mu.Unlock()
	m.emitStatus()

	conn, mgtCli, rawHTTP, amqpURL, mgtURL, vhost, err := m.buildClients(&p)
	if err != nil {
		m.mu.Lock()
		m.status = RMQClusterStatus{
			Connected:        false,
			Connecting:       false,
			Protocol:         "rabbitmq",
			LastError:        err.Error(),
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, err
	}

	start := time.Now()
	probeCh, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		m.mu.Lock()
		m.status = RMQClusterStatus{
			Connected:        false,
			Connecting:       false,
			Protocol:         "rabbitmq",
			LastError:        err.Error(),
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	_ = probeCh.Close()
	rtt := float64(time.Since(start).Microseconds()) / 1000.0

	stopCh := make(chan struct{})

	m.mu.Lock()
	m.amqpConn = conn
	m.httpCli = mgtCli
	m.httpClient = rawHTTP
	m.profile = &p
	m.activeVHost = vhost
	m.managementURL = mgtURL
	m.stopPingCh = stopCh
	m.status = RMQClusterStatus{
		Connected:           true,
		Connecting:          false,
		Protocol:            "rabbitmq",
		CurrentProfileID:    p.ID,
		Endpoint:            amqpURL,
		ManagementURL:       mgtURL,
		VHost:               vhost,
		RTTMs:               rtt,
		ManagementAvailable: false,
	}
	m.mu.Unlock()

	// Initial telemetry sync
	m.refreshTelemetry()
	m.emitStatus()

	// Launch background telemetry and close listener
	go m.startTelemetryLoop(stopCh)
	go m.listenConnectionClose(conn)

	return &m.status, nil
}

// listenConnectionClose listens for broker-initiated disconnections
func (m *RabbitMQManager) listenConnectionClose(conn *amqp.Connection) {
	closeErrCh := conn.NotifyClose(make(chan *amqp.Error, 1))
	err, ok := <-closeErrCh
	if !ok || err == nil {
		return
	}

	m.mu.Lock()
	if m.amqpConn == conn {
		m.status.Connected = false
		m.status.LastError = fmt.Sprintf("RabbitMQ connection closed: %s (code %d)", err.Reason, err.Code)
		m.amqpConn = nil
	}
	m.mu.Unlock()
	m.emitStatus()
}

// Disconnect gracefully closes the active connection and terminates background jobs
func (m *RabbitMQManager) Disconnect() {
	m.StopLiveConsume()

	m.mu.Lock()
	if m.stopPingCh != nil {
		close(m.stopPingCh)
		m.stopPingCh = nil
	}
	if m.amqpConn != nil && !m.amqpConn.IsClosed() {
		_ = m.amqpConn.Close()
		m.amqpConn = nil
	}
	m.httpCli = nil
	m.httpClient = nil
	m.profile = nil
	m.status = RMQClusterStatus{
		Connected:  false,
		Connecting: false,
		Protocol:   "rabbitmq",
	}
	m.mu.Unlock()

	m.emitStatus()
}

// startTelemetryLoop periodically samples server metrics, queue counts, and ping latency
func (m *RabbitMQManager) startTelemetryLoop(stopCh chan struct{}) {
	ticker := time.NewTicker(4 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			m.refreshTelemetry()
			m.emitStatus()
		}
	}
}

// refreshTelemetry queries the Management API or AMQP probe to update live metrics
func (m *RabbitMQManager) refreshTelemetry() {
	m.mu.RLock()
	conn := m.amqpConn
	httpCli := m.httpCli
	m.mu.RUnlock()

	if conn == nil || conn.IsClosed() {
		return
	}

	// Fetch Management API overview and measure RTT if available
	if httpCli != nil {
		start := time.Now()
		overview, err := httpCli.Overview()
		if err == nil && overview != nil {
			rtt := float64(time.Since(start).Microseconds()) / 1000.0
			clusterName := overview.Node
			if cn, err := httpCli.GetClusterName(); err == nil && cn != nil && cn.Name != "" {
				clusterName = cn.Name
			}
			m.mu.Lock()
			m.status.RTTMs = rtt
			m.status.ManagementAvailable = true
			m.status.RabbitMQVersion = overview.RabbitMQVersion
			m.status.ErlangVersion = overview.ErlangVersion
			m.status.ClusterName = clusterName
			m.status.QueuesCount = overview.ObjectTotals.Queues
			m.status.ExchangesCount = overview.ObjectTotals.Exchanges
			m.status.ConnectionsCount = overview.ObjectTotals.Connections
			m.status.ChannelsCount = overview.ObjectTotals.Channels
			m.status.ConsumersCount = overview.ObjectTotals.Consumers
			m.status.MessageRates = &RMQMessageRates{
				PublishRate: float64(overview.MessageStats.PublishDetails.Rate),
				DeliverRate: float64(overview.MessageStats.DeliverGetDetails.Rate),
				AckRate:     float64(overview.MessageStats.AckDetails.Rate),
			}
			m.mu.Unlock()
		}

		// Check for node alarms
		nodes, err := httpCli.ListNodes()
		if err == nil {
			var diskAlarm, memAlarm bool
			for _, n := range nodes {
				if n.DiskFreeAlarm {
					diskAlarm = true
				}
				if n.MemAlarm {
					memAlarm = true
				}
			}
			m.mu.Lock()
			m.status.DiskFreeAlarm = diskAlarm
			m.status.MemoryAlarm = memAlarm
			m.mu.Unlock()
		}
	} else {
		// Pure AMQP mode: probe channel to measure latency
		start := time.Now()
		ch, err := conn.Channel()
		if err == nil {
			_ = ch.Close()
			rtt := float64(time.Since(start).Microseconds()) / 1000.0
			m.mu.Lock()
			m.status.RTTMs = rtt
			m.mu.Unlock()
		}
	}
}

// GetOverview returns detailed cluster statistics
func (m *RabbitMQManager) GetOverview(ctx context.Context) (*RMQOverview, error) {
	httpCli, err := m.GetHTTPClient()
	if err != nil {
		return nil, err
	}

	overview, err := httpCli.Overview()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch cluster overview: %w", err)
	}

	clusterName := overview.Node
	if cn, err := httpCli.GetClusterName(); err == nil && cn != nil && cn.Name != "" {
		clusterName = cn.Name
	}

	nodes, _ := httpCli.ListNodes()
	var diskAlarm, memAlarm bool
	for _, n := range nodes {
		if n.DiskFreeAlarm {
			diskAlarm = true
		}
		if n.MemAlarm {
			memAlarm = true
		}
	}

	vhosts, _ := httpCli.ListVhosts()
	var vhostNames []string
	for _, v := range vhosts {
		vhostNames = append(vhostNames, v.Name)
	}

	return &RMQOverview{
		ClusterName:      clusterName,
		RabbitMQVersion:  overview.RabbitMQVersion,
		ErlangVersion:    overview.ErlangVersion,
		TotalQueues:      overview.ObjectTotals.Queues,
		TotalExchanges:   overview.ObjectTotals.Exchanges,
		TotalConnections: overview.ObjectTotals.Connections,
		TotalChannels:    overview.ObjectTotals.Channels,
		TotalConsumers:   overview.ObjectTotals.Consumers,
		TotalMessages:    int64(overview.QueueTotals.Messages),
		MessagesReady:    int64(overview.QueueTotals.MessagesReady),
		MessagesUnack:    int64(overview.QueueTotals.MessagesUnacknowledged),
		DiskFreeAlarm:    diskAlarm,
		MemoryAlarm:      memAlarm,
		VHosts:           vhostNames,
		MessageRates: RMQMessageRates{
			PublishRate: float64(overview.MessageStats.PublishDetails.Rate),
			DeliverRate: float64(overview.MessageStats.DeliverGetDetails.Rate),
			AckRate:     float64(overview.MessageStats.AckDetails.Rate),
		},
	}, nil
}

// ListNodes retrieves node health and system resource statistics
func (m *RabbitMQManager) ListNodes(ctx context.Context) ([]RMQNodeInfo, error) {
	httpCli, err := m.GetHTTPClient()
	if err != nil {
		return nil, err
	}

	nodes, err := httpCli.ListNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to list RabbitMQ nodes: %w", err)
	}

	var results []RMQNodeInfo
	for _, n := range nodes {
		results = append(results, RMQNodeInfo{
			Name:            n.Name,
			Type:            n.NodeType,
			Running:         n.IsRunning,
			UptimeSeconds:   int64(n.Uptime / 1000),
			MemUsed:         uint64(n.MemUsed),
			MemLimit:        uint64(n.MemLimit),
			MemAlarm:        n.MemAlarm,
			DiskFree:        uint64(n.DiskFree),
			DiskFreeLimit:   uint64(n.DiskFreeLimit),
			DiskFreeAlarm:   n.DiskFreeAlarm,
			FDUsed:          n.FdUsed,
			FDTotal:         n.FdTotal,
			SocketsUsed:     0,
			SocketsTotal:    0,
			ProcessorsCount: int(n.Processors),
			ErlangProcesses: n.ProcUsed,
		})
	}

	return results, nil
}

// ListVHosts retrieves all configured virtual hosts
func (m *RabbitMQManager) ListVHosts(ctx context.Context) ([]RMQVHostInfo, error) {
	httpCli, err := m.GetHTTPClient()
	if err != nil {
		return nil, err
	}

	vhosts, err := httpCli.ListVhosts()
	if err != nil {
		return nil, fmt.Errorf("failed to list virtual hosts: %w", err)
	}

	var results []RMQVHostInfo
	for _, v := range vhosts {
		results = append(results, RMQVHostInfo{
			Name:                   v.Name,
			Messages:               int64(v.Messages),
			MessagesReady:          int64(v.MessagesReady),
			MessagesUnacknowledged: int64(v.MessagesUnacknowledged),
			Tracing:                v.Tracing,
			MessageRates: RMQMessageRates{
				PublishRate: float64(v.MessagesDetails.Rate),
				DeliverRate: float64(v.MessagesReadyDetails.Rate),
				AckRate:     float64(v.MessagesUnacknowledgedDetails.Rate),
			},
		})
	}

	return results, nil
}

// resolveVHost returns the target vhost or active vhost default
func (m *RabbitMQManager) resolveVHost(vhost string) string {
	v := strings.TrimSpace(vhost)
	if v == "" {
		m.mu.RLock()
		v = m.activeVHost
		m.mu.RUnlock()
	}
	if v == "" {
		v = "/"
	}
	return v
}

// Helper to parse int64 safely
func parseInt64(val interface{}) int64 {
	switch v := val.(type) {
	case int:
		return int64(v)
	case int64:
		return v
	case float64:
		return int64(v)
	case string:
		n, _ := strconv.ParseInt(v, 10, 64)
		return n
	default:
		return 0
	}
}
