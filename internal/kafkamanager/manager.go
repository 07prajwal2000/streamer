package kafkamanager

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"streamer/internal/storage"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type KafkaManager struct {
	ctx        context.Context
	mu         sync.RWMutex
	client     *kgo.Client
	admin      *kadm.Client
	profile    *storage.ConnectionProfile
	status     KafkaClusterStatus
	stopPingCh chan struct{}
	tailMu     sync.Mutex
	tailCancel context.CancelFunc
}

func NewKafkaManager() *KafkaManager {
	return &KafkaManager{
		status: KafkaClusterStatus{
			Connected: false,
			Protocol:  "kafka",
		},
	}
}

func (m *KafkaManager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

func (m *KafkaManager) getAdminClient() (*kadm.Client, error) {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return nil, fmt.Errorf("not connected to a Kafka cluster")
	}
	return admin, nil
}

func (m *KafkaManager) getConsumerClient(extraOpts ...kgo.Opt) (*kgo.Client, error) {
	m.mu.RLock()
	p := m.profile
	m.mu.RUnlock()

	if p == nil {
		return nil, fmt.Errorf("not connected to a Kafka cluster")
	}

	opts, err := m.buildClientOptions(p)
	if err != nil {
		return nil, err
	}

	opts = append(opts, extraOpts...)
	return kgo.NewClient(opts...)
}

func parseBrokers(urlStr string) []string {
	var brokers []string
	for _, part := range strings.Split(urlStr, ",") {
		b := strings.TrimSpace(part)
		if strings.Contains(b, "://") {
			parts := strings.SplitN(b, "://", 2)
			b = parts[1]
		}
		if b != "" {
			brokers = append(brokers, b)
		}
	}
	return brokers
}

func (m *KafkaManager) buildClientOptions(p *storage.ConnectionProfile) ([]kgo.Opt, error) {
	brokers := parseBrokers(p.URL)
	if len(brokers) == 0 {
		return nil, fmt.Errorf("no valid broker addresses provided in URL: %q", p.URL)
	}

	opts := []kgo.Opt{
		kgo.SeedBrokers(brokers...),
		kgo.RequestTimeoutOverhead(10 * time.Second),
	}

	if p.ClientName != "" {
		opts = append(opts, kgo.ClientID(p.ClientName))
	} else {
		opts = append(opts, kgo.ClientID("Streamer"))
	}

	// Configure TLS
	needsTLS := p.AuthType == "tls" || p.TLSCAFile != "" || p.TLSCertFile != "" || p.TLSInsecure
	if needsTLS {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: p.TLSInsecure,
		}
		if p.TLSSNI != "" {
			tlsConfig.ServerName = p.TLSSNI
		}
		if p.TLSCAFile != "" {
			caCert, err := os.ReadFile(p.TLSCAFile)
			if err != nil {
				return nil, fmt.Errorf("failed to read CA file: %w", err)
			}
			caCertPool := x509.NewCertPool()
			if !caCertPool.AppendCertsFromPEM(caCert) {
				return nil, fmt.Errorf("failed to parse CA certificate from %s", p.TLSCAFile)
			}
			tlsConfig.RootCAs = caCertPool
		}
		if p.TLSCertFile != "" && p.TLSKeyFile != "" {
			cert, err := tls.LoadX509KeyPair(p.TLSCertFile, p.TLSKeyFile)
			if err != nil {
				return nil, fmt.Errorf("failed to load client certificate and key: %w", err)
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}
		opts = append(opts, kgo.DialTLSConfig(tlsConfig))
	}

	// Configure SASL Authentication
	switch strings.ToLower(p.AuthType) {
	case "userpass", "plain", "sasl_plain":
		opts = append(opts, kgo.SASL(plain.Auth{
			User: p.Username,
			Pass: p.Password,
		}.AsMechanism()))
	case "scram256", "scram-sha-256", "sasl_scram256":
		opts = append(opts, kgo.SASL(scram.Auth{
			User: p.Username,
			Pass: p.Password,
		}.AsSha256Mechanism()))
	case "scram512", "scram-sha-512", "sasl_scram512":
		opts = append(opts, kgo.SASL(scram.Auth{
			User: p.Username,
			Pass: p.Password,
		}.AsSha512Mechanism()))
	}

	return opts, nil
}

func (m *KafkaManager) emitStatus() {
	if m.ctx != nil {
		m.mu.RLock()
		status := m.status
		m.mu.RUnlock()
		runtime.EventsEmit(m.ctx, "kafka:status", status)
	}
}

// TestConnection verifies connectivity, broker reachability, and cluster metadata
func (m *KafkaManager) TestConnection(p storage.ConnectionProfile) (*KafkaClusterStatus, error) {
	opts, err := m.buildClientOptions(&p)
	if err != nil {
		return nil, err
	}

	client, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Kafka client: %w", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	start := time.Now()
	if err := client.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping failed (cluster unreachable): %w", err)
	}
	rtt := float64(time.Since(start).Microseconds()) / 1000.0

	admin := kadm.NewClient(client)
	meta, err := admin.Metadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch cluster metadata: %w", err)
	}

	brokers := make([]BrokerInfo, 0, len(meta.Brokers))
	for _, b := range meta.Brokers {
		var rack string
		if b.Rack != nil {
			rack = *b.Rack
		}
		brokers = append(brokers, BrokerInfo{
			NodeID:       b.NodeID,
			Host:         b.Host,
			Port:         b.Port,
			Rack:         rack,
			IsController: b.NodeID == meta.Controller,
		})
	}
	sort.Slice(brokers, func(i, j int) bool {
		return brokers[i].NodeID < brokers[j].NodeID
	})

	totalPartitions := 0
	for _, t := range meta.Topics {
		totalPartitions += len(t.Partitions)
	}

	status := &KafkaClusterStatus{
		Connected:        true,
		Protocol:         "kafka",
		CurrentProfileID: p.ID,
		ClusterID:        meta.Cluster,
		ControllerID:     meta.Controller,
		Brokers:          brokers,
		BrokersCount:     len(brokers),
		TopicsCount:      len(meta.Topics),
		PartitionsCount:  totalPartitions,
		RTTMs:            rtt,
	}

	return status, nil
}

// Connect starts an active Kafka connection and background telemetry ping loop
func (m *KafkaManager) Connect(p storage.ConnectionProfile) (*KafkaClusterStatus, error) {
	m.Disconnect()

	m.mu.Lock()
	m.status = KafkaClusterStatus{
		Connecting:       true,
		Protocol:         "kafka",
		CurrentProfileID: p.ID,
	}
	m.mu.Unlock()
	m.emitStatus()

	opts, err := m.buildClientOptions(&p)
	if err != nil {
		m.mu.Lock()
		m.status = KafkaClusterStatus{
			Connected:        false,
			Protocol:         "kafka",
			LastError:        err.Error(),
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, err
	}

	client, err := kgo.NewClient(opts...)
	if err != nil {
		m.mu.Lock()
		m.status = KafkaClusterStatus{
			Connected:        false,
			Protocol:         "kafka",
			LastError:        err.Error(),
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, fmt.Errorf("failed to create Kafka client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	start := time.Now()
	if err := client.Ping(ctx); err != nil {
		client.Close()
		errMsg := fmt.Sprintf("failed to connect to Kafka brokers: %v", err)
		m.mu.Lock()
		m.status = KafkaClusterStatus{
			Connected:        false,
			Protocol:         "kafka",
			LastError:        errMsg,
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, fmt.Errorf("%s", errMsg)
	}
	rtt := float64(time.Since(start).Microseconds()) / 1000.0

	admin := kadm.NewClient(client)
	meta, err := admin.Metadata(ctx)
	if err != nil {
		client.Close()
		errMsg := fmt.Sprintf("failed to retrieve cluster metadata: %v", err)
		m.mu.Lock()
		m.status = KafkaClusterStatus{
			Connected:        false,
			Protocol:         "kafka",
			LastError:        errMsg,
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, fmt.Errorf("%s", errMsg)
	}

	brokers := make([]BrokerInfo, 0, len(meta.Brokers))
	for _, b := range meta.Brokers {
		var rack string
		if b.Rack != nil {
			rack = *b.Rack
		}
		brokers = append(brokers, BrokerInfo{
			NodeID:       b.NodeID,
			Host:         b.Host,
			Port:         b.Port,
			Rack:         rack,
			IsController: b.NodeID == meta.Controller,
		})
	}
	sort.Slice(brokers, func(i, j int) bool {
		return brokers[i].NodeID < brokers[j].NodeID
	})

	totalPartitions := 0
	for _, t := range meta.Topics {
		totalPartitions += len(t.Partitions)
	}

	profileCopy := p
	stopCh := make(chan struct{})

	m.mu.Lock()
	m.client = client
	m.admin = admin
	m.profile = &profileCopy
	m.stopPingCh = stopCh
	m.status = KafkaClusterStatus{
		Connected:        true,
		Connecting:       false,
		Protocol:         "kafka",
		CurrentProfileID: p.ID,
		ClusterID:        meta.Cluster,
		ControllerID:     meta.Controller,
		Brokers:          brokers,
		BrokersCount:     len(brokers),
		TopicsCount:      len(meta.Topics),
		PartitionsCount:  totalPartitions,
		RTTMs:            rtt,
	}
	m.mu.Unlock()

	m.emitStatus()
	go m.pingLoop(stopCh)

	return &m.status, nil
}

func (m *KafkaManager) pingLoop(stopCh chan struct{}) {
	ticker := time.NewTicker(4 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			m.mu.RLock()
			cl := m.client
			m.mu.RUnlock()
			if cl == nil {
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			start := time.Now()
			err := cl.Ping(ctx)
			cancel()

			m.mu.Lock()
			if err == nil {
				m.status.RTTMs = float64(time.Since(start).Microseconds()) / 1000.0
			} else {
				m.status.RTTMs = 0
			}
			m.mu.Unlock()
			m.emitStatus()
		}
	}
}

// Disconnect gracefully shuts down client connections and background workers
func (m *KafkaManager) Disconnect() {
	m.tailMu.Lock()
	if m.tailCancel != nil {
		m.tailCancel()
		m.tailCancel = nil
	}
	m.tailMu.Unlock()

	m.mu.Lock()
	if m.stopPingCh != nil {
		close(m.stopPingCh)
		m.stopPingCh = nil
	}
	if m.client != nil {
		m.client.Close()
		m.client = nil
		m.admin = nil
	}
	m.profile = nil
	m.status = KafkaClusterStatus{
		Connected: false,
		Protocol:  "kafka",
	}
	m.mu.Unlock()
	m.emitStatus()
}

// GetStatus returns the current live cluster status
func (m *KafkaManager) GetStatus() KafkaClusterStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

// GetBrokers returns the latest broker list from cluster metadata
func (m *KafkaManager) GetBrokers(ctx context.Context) ([]BrokerInfo, error) {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return nil, fmt.Errorf("not connected to a Kafka cluster")
	}

	meta, err := admin.Metadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch broker metadata: %w", err)
	}

	brokers := make([]BrokerInfo, 0, len(meta.Brokers))
	for _, b := range meta.Brokers {
		var rack string
		if b.Rack != nil {
			rack = *b.Rack
		}
		brokers = append(brokers, BrokerInfo{
			NodeID:       b.NodeID,
			Host:         b.Host,
			Port:         b.Port,
			Rack:         rack,
			IsController: b.NodeID == meta.Controller,
		})
	}
	sort.Slice(brokers, func(i, j int) bool {
		return brokers[i].NodeID < brokers[j].NodeID
	})

	return brokers, nil
}

// GetBrokerConfigs returns the configuration parameters of a specific broker node
func (m *KafkaManager) GetBrokerConfigs(ctx context.Context, nodeID int32) ([]BrokerConfigEntry, error) {
	m.mu.RLock()
	admin := m.admin
	m.mu.RUnlock()

	if admin == nil {
		return nil, fmt.Errorf("not connected to a Kafka cluster")
	}

	resConfigs, err := admin.DescribeBrokerConfigs(ctx, nodeID)
	if err != nil {
		return nil, fmt.Errorf("failed to describe broker configs for node %d: %w", nodeID, err)
	}

	var entries []BrokerConfigEntry
	for _, res := range resConfigs {
		if res.Err != nil {
			return nil, fmt.Errorf("broker config error: %w", res.Err)
		}
		for _, cfg := range res.Configs {
			val := cfg.MaybeValue()
			entries = append(entries, BrokerConfigEntry{
				Name:        cfg.Key,
				Value:       val,
				Source:      cfg.Source.String(),
				IsSensitive: cfg.Sensitive,
				IsReadOnly:  cfg.Source.String() == "STATIC_BROKER_CONFIG",
			})
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name < entries[j].Name
	})

	return entries, nil
}
