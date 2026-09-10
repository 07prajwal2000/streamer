package natsmanager

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"streamer/internal/storage"

	"github.com/nats-io/nats.go"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ServerStatus struct {
	Connected        bool     `json:"connected"`
	Connecting       bool     `json:"connecting"`
	Reconnecting     bool     `json:"reconnecting"`
	LastError        string   `json:"lastError,omitempty"`
	CurrentProfileID string   `json:"currentProfileId,omitempty"`
	ServerID         string   `json:"serverId,omitempty"`
	ServerName       string   `json:"serverName,omitempty"`
	ServerVersion    string   `json:"serverVersion,omitempty"`
	ClusterName      string   `json:"clusterName,omitempty"`
	ClientIP         string   `json:"clientIP,omitempty"`
	MaxPayload       int64    `json:"maxPayload,omitempty"`
	JetStream        bool     `json:"jetStream"`
	HeadersSupported bool     `json:"headersSupported"`
	TLSRequired      bool     `json:"tlsRequired"`
	RTTMs            float64  `json:"rttMs"`
	ConnectedURL     string   `json:"connectedUrl,omitempty"`
	DiscoveredURLs   []string `json:"discoveredUrls,omitempty"`
}

type PubSubMessage struct {
	ID        string              `json:"id"`
	SubID     string              `json:"subId"`
	Subject   string              `json:"subject"`
	Reply     string              `json:"reply,omitempty"`
	Headers   map[string][]string `json:"headers,omitempty"`
	Data      string              `json:"data"`       // Raw string or base64
	IsBinary  bool                `json:"isBinary"`
	Size      int                 `json:"size"`
	Timestamp int64               `json:"timestamp"`  // Unix millisecond timestamp
}

type SubscriptionInfo struct {
	ID         string `json:"id"`
	Subject    string `json:"subject"`
	QueueGroup string `json:"queueGroup,omitempty"`
	Count      int64  `json:"count"`
}

type NatsManager struct {
	ctx           context.Context
	mu            sync.RWMutex
	nc            *nats.Conn
	profile       *storage.ConnectionProfile
	status        ServerStatus
	stopRTTCh     chan struct{}
	subscriptions map[string]*nats.Subscription
	subMeta       map[string]*SubscriptionInfo
	msgCounter    int64
}

func NewNatsManager() *NatsManager {
	return &NatsManager{
		status:        ServerStatus{Connected: false},
		subscriptions: make(map[string]*nats.Subscription),
		subMeta:       make(map[string]*SubscriptionInfo),
	}
}

func (m *NatsManager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

func (m *NatsManager) buildOptions(p *storage.ConnectionProfile) ([]nats.Option, error) {
	opts := []nats.Option{
		nats.Name(p.ClientName),
		nats.Timeout(5 * time.Second),
		nats.PingInterval(10 * time.Second),
		nats.MaxPingsOutstanding(3),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			m.mu.Lock()
			m.status.Connected = false
			if err != nil {
				m.status.LastError = err.Error()
			}
			m.mu.Unlock()
			m.emitStatus()
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			m.mu.Lock()
			m.status.Connected = true
			m.status.Reconnecting = false
			m.status.LastError = ""
			m.mu.Unlock()
			m.emitStatus()
		}),
		nats.ClosedHandler(func(nc *nats.Conn) {
			m.mu.Lock()
			m.status.Connected = false
			m.status.Connecting = false
			m.status.Reconnecting = false
			m.mu.Unlock()
			m.emitStatus()
		}),
	}

	switch p.AuthType {
	case "userpass":
		if p.Username != "" {
			opts = append(opts, nats.UserInfo(p.Username, p.Password))
		}
	case "token":
		if p.Token != "" {
			opts = append(opts, nats.Token(p.Token))
		}
	case "nkey":
		if p.NKeySeed != "" {
			opt, err := nats.NkeyOptionFromSeed(p.NKeySeed)
			if err != nil {
				return nil, fmt.Errorf("invalid nkey seed: %w", err)
			}
			opts = append(opts, opt)
		}
	case "credentials":
		if p.CredsFilePath != "" {
			opts = append(opts, nats.UserCredentials(p.CredsFilePath))
		}
	}

	// TLS configuration
	if p.TLSCAFile != "" || p.TLSCertFile != "" || p.TLSInsecure {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: p.TLSInsecure,
		}

		if p.TLSCAFile != "" {
			caCert, err := os.ReadFile(p.TLSCAFile)
			if err != nil {
				return nil, fmt.Errorf("failed to read TLS CA file: %w", err)
			}
			caPool := x509.NewCertPool()
			caPool.AppendCertsFromPEM(caCert)
			tlsConfig.RootCAs = caPool
		}

		if p.TLSCertFile != "" && p.TLSKeyFile != "" {
			cert, err := tls.LoadX509KeyPair(p.TLSCertFile, p.TLSKeyFile)
			if err != nil {
				return nil, fmt.Errorf("failed to load TLS client cert/key: %w", err)
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}

		opts = append(opts, nats.Secure(tlsConfig))
	}

	return opts, nil
}

func (m *NatsManager) TestConnection(p storage.ConnectionProfile) (*ServerStatus, error) {
	m.mu.RLock()
	// If this profile is the one currently connected, test ping directly on the active connection!
	if m.nc != nil && m.nc.IsConnected() && m.profile != nil && m.profile.ID == p.ID {
		nc := m.nc
		m.mu.RUnlock()
		rtt, err := nc.RTT()
		if err != nil {
			return nil, fmt.Errorf("ping failed: %w", err)
		}
		m.mu.Lock()
		m.status.RTTMs = float64(rtt.Microseconds()) / 1000.0
		status := m.status
		m.mu.Unlock()
		return &status, nil
	}
	m.mu.RUnlock()

	// Isolated temporary test connection
	opts := []nats.Option{
		nats.Name("Streamer-Ping-Test"),
		nats.Timeout(4 * time.Second),
	}

	switch p.AuthType {
	case "userpass":
		if p.Username != "" {
			opts = append(opts, nats.UserInfo(p.Username, p.Password))
		}
	case "token":
		if p.Token != "" {
			opts = append(opts, nats.Token(p.Token))
		}
	case "nkey":
		if p.NKeySeed != "" {
			opt, err := nats.NkeyOptionFromSeed(p.NKeySeed)
			if err != nil {
				return nil, fmt.Errorf("invalid nkey seed: %w", err)
			}
			opts = append(opts, opt)
		}
	case "credentials":
		if p.CredsFilePath != "" {
			opts = append(opts, nats.UserCredentials(p.CredsFilePath))
		}
	}

	if p.TLSCAFile != "" || p.TLSCertFile != "" || p.TLSInsecure {
		tlsConfig := &tls.Config{InsecureSkipVerify: p.TLSInsecure}
		opts = append(opts, nats.Secure(tlsConfig))
	}

	nc, err := nats.Connect(p.URL, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}
	defer nc.Close()

	rtt, _ := nc.RTT()
	status := &ServerStatus{
		Connected:        true,
		ServerID:         nc.ConnectedServerId(),
		ServerVersion:    nc.ConnectedServerVersion(),
		RTTMs:            float64(rtt.Microseconds()) / 1000.0,
		ConnectedURL:     nc.ConnectedUrl(),
		HeadersSupported: nc.HeadersSupported(),
	}

	return status, nil
}

func (m *NatsManager) Connect(p storage.ConnectionProfile) (*ServerStatus, error) {
	m.mu.Lock()
	if m.nc != nil {
		m.cleanSubscriptionsLocked()
		m.nc.Close()
		m.nc = nil
	}
	if m.stopRTTCh != nil {
		close(m.stopRTTCh)
		m.stopRTTCh = nil
	}

	m.status = ServerStatus{
		Connecting:       true,
		CurrentProfileID: p.ID,
	}
	m.profile = &p
	m.mu.Unlock()
	m.emitStatus()

	opts, err := m.buildOptions(&p)
	if err != nil {
		m.setError(err.Error())
		return nil, err
	}

	nc, err := nats.Connect(p.URL, opts...)
	if err != nil {
		m.setError(err.Error())
		return nil, err
	}

	rtt, _ := nc.RTT()
	js, _ := nc.JetStream()

	m.mu.Lock()
	m.nc = nc
	m.stopRTTCh = make(chan struct{})
	m.status = ServerStatus{
		Connected:        true,
		Connecting:       false,
		CurrentProfileID: p.ID,
		ServerID:         nc.ConnectedServerId(),
		ServerVersion:    nc.ConnectedServerVersion(),
		ConnectedURL:     nc.ConnectedUrl(),
		DiscoveredURLs:   nc.DiscoveredServers(),
		HeadersSupported: nc.HeadersSupported(),
		JetStream:        js != nil,
		RTTMs:            float64(rtt.Microseconds()) / 1000.0,
	}
	m.mu.Unlock()
	m.emitStatus()

	// Launch periodic RTT ping poller
	go m.pollRTT(m.stopRTTCh)

	// Launch JetStream advisory listener and hot-reload sync
	if js != nil {
		go m.listenJetStreamAdvisories(nc, m.stopRTTCh)
		if m.ctx != nil {
			runtime.EventsEmit(m.ctx, "jetstream:update", "connected")
		}
	}

	return &m.status, nil
}

func (m *NatsManager) Disconnect() {
	m.mu.Lock()
	if m.stopRTTCh != nil {
		close(m.stopRTTCh)
		m.stopRTTCh = nil
	}
	m.cleanSubscriptionsLocked()
	if m.nc != nil {
		m.nc.Close()
		m.nc = nil
	}
	m.status = ServerStatus{Connected: false}
	m.profile = nil
	m.mu.Unlock()
	m.emitStatus()
}

func (m *NatsManager) GetStatus() ServerStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *NatsManager) GetConn() *nats.Conn {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.nc
}

func (m *NatsManager) setError(errStr string) {
	m.mu.Lock()
	m.status.Connected = false
	m.status.Connecting = false
	m.status.LastError = errStr
	m.mu.Unlock()
	m.emitStatus()
}

func (m *NatsManager) emitStatus() {
	if m.ctx != nil {
		runtime.EventsEmit(m.ctx, "nats:status", m.GetStatus())
	}
}

func (m *NatsManager) pollRTT(stopCh chan struct{}) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			m.mu.RLock()
			nc := m.nc
			m.mu.RUnlock()

			if nc == nil || !nc.IsConnected() {
				continue
			}

			rtt, err := nc.RTT()
			if err == nil {
				m.mu.Lock()
				m.status.RTTMs = float64(rtt.Microseconds()) / 1000.0
				m.mu.Unlock()
				m.emitStatus()
			}
		}
	}
}

func (m *NatsManager) listenJetStreamAdvisories(nc *nats.Conn, stopCh chan struct{}) {
	// Subscribe to all JetStream server advisories
	sub, err := nc.Subscribe("$JS.EVENT.ADVISORY.>", func(msg *nats.Msg) {
		if m.ctx != nil {
			runtime.EventsEmit(m.ctx, "jetstream:update", msg.Subject)
		}
	})

	if err == nil {
		defer sub.Unsubscribe()
	}

	<-stopCh
}

// -------------------------------------------------------------
// Pub / Sub Methods
// -------------------------------------------------------------

func (m *NatsManager) cleanSubscriptionsLocked() {
	for id, sub := range m.subscriptions {
		_ = sub.Unsubscribe()
		delete(m.subscriptions, id)
	}
	m.subMeta = make(map[string]*SubscriptionInfo)
}

func (m *NatsManager) Subscribe(id string, subject string, queueGroup string) (*SubscriptionInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.nc == nil || !m.nc.IsConnected() {
		return nil, fmt.Errorf("nats client is not connected")
	}

	handler := func(msg *nats.Msg) {
		m.handleIncomingMessage(id, msg)
	}

	var sub *nats.Subscription
	var err error
	if queueGroup != "" {
		sub, err = m.nc.QueueSubscribe(subject, queueGroup, handler)
	} else {
		sub, err = m.nc.Subscribe(subject, handler)
	}

	if err != nil {
		return nil, err
	}

	info := &SubscriptionInfo{
		ID:         id,
		Subject:    subject,
		QueueGroup: queueGroup,
		Count:      0,
	}

	m.subscriptions[id] = sub
	m.subMeta[id] = info

	return info, nil
}

func (m *NatsManager) Unsubscribe(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	sub, ok := m.subscriptions[id]
	if !ok {
		return nil
	}

	err := sub.Unsubscribe()
	delete(m.subscriptions, id)
	delete(m.subMeta, id)
	return err
}

func (m *NatsManager) GetSubscriptions() []SubscriptionInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	list := make([]SubscriptionInfo, 0, len(m.subMeta))
	for _, info := range m.subMeta {
		list = append(list, *info)
	}
	return list
}

func isBinary(data []byte) bool {
	for _, b := range data {
		if b == 0 {
			return true
		}
	}
	return false
}

func (m *NatsManager) handleIncomingMessage(subID string, msg *nats.Msg) {
	msgNum := atomic.AddInt64(&m.msgCounter, 1)

	m.mu.Lock()
	if info, ok := m.subMeta[subID]; ok {
		info.Count++
	}
	m.mu.Unlock()

	binaryFlag := isBinary(msg.Data)
	pubMsg := PubSubMessage{
		ID:        fmt.Sprintf("msg-%d", msgNum),
		SubID:     subID,
		Subject:   msg.Subject,
		Reply:     msg.Reply,
		Headers:   msg.Header,
		Data:      string(msg.Data),
		IsBinary:  binaryFlag,
		Size:      len(msg.Data),
		Timestamp: time.Now().UnixMilli(),
	}

	if m.ctx != nil {
		runtime.EventsEmit(m.ctx, "nats:message", pubMsg)
	}
}

func (m *NatsManager) Publish(subject string, replyTo string, headers map[string][]string, payload []byte) error {
	m.mu.RLock()
	nc := m.nc
	m.mu.RUnlock()

	if nc == nil || !nc.IsConnected() {
		return fmt.Errorf("nats client is not connected")
	}

	msg := &nats.Msg{
		Subject: subject,
		Reply:   replyTo,
		Data:    payload,
	}

	if len(headers) > 0 {
		msg.Header = nats.Header(headers)
	}

	return nc.PublishMsg(msg)
}

func (m *NatsManager) Request(subject string, headers map[string][]string, payload []byte, timeoutMs int) (*PubSubMessage, error) {
	m.mu.RLock()
	nc := m.nc
	m.mu.RUnlock()

	if nc == nil || !nc.IsConnected() {
		return nil, fmt.Errorf("nats client is not connected")
	}

	if timeoutMs <= 0 {
		timeoutMs = 3000
	}

	msg := &nats.Msg{
		Subject: subject,
		Data:    payload,
	}

	if len(headers) > 0 {
		msg.Header = nats.Header(headers)
	}

	reply, err := nc.RequestMsg(msg, time.Duration(timeoutMs)*time.Millisecond)
	if err != nil {
		return nil, err
	}

	msgNum := atomic.AddInt64(&m.msgCounter, 1)
	binaryFlag := isBinary(reply.Data)

	return &PubSubMessage{
		ID:        fmt.Sprintf("reply-%d", msgNum),
		Subject:   reply.Subject,
		Reply:     reply.Reply,
		Headers:   reply.Header,
		Data:      string(reply.Data),
		IsBinary:  binaryFlag,
		Size:      len(reply.Data),
		Timestamp: time.Now().UnixMilli(),
	}, nil
}
