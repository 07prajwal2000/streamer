package sqsmanager

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"streamer/internal/storage"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type SqsManager struct {
	ctx        context.Context
	mu         sync.RWMutex
	client     *sqs.Client
	profile    *storage.ConnectionProfile
	status     SQSClusterStatus
	stopPingCh chan struct{}
	pollCancel context.CancelFunc
	pollMu     sync.Mutex
}

func NewSqsManager() *SqsManager {
	return &SqsManager{
		status: SQSClusterStatus{
			Connected: false,
			Protocol:  "sqs",
		},
	}
}

func (m *SqsManager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

func (m *SqsManager) GetClient() (*sqs.Client, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.client == nil {
		return nil, fmt.Errorf("not connected to SQS")
	}
	return m.client, nil
}

func (m *SqsManager) GetProfile() *storage.ConnectionProfile {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.profile
}

func (m *SqsManager) buildClient(p *storage.ConnectionProfile) (*sqs.Client, string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	region := strings.TrimSpace(p.AWSRegion)
	if region == "" {
		region = "us-east-1"
	}

	var configOptions []func(*config.LoadOptions) error
	configOptions = append(configOptions, config.WithRegion(region))

	// Configure HTTP client for TLS insecure if requested
	if p.TLSInsecure {
		tr := &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
		configOptions = append(configOptions, config.WithHTTPClient(&http.Client{
			Transport: tr,
			Timeout:   30 * time.Second,
		}))
	}

	authType := strings.ToLower(strings.TrimSpace(p.AuthType))
	switch authType {
	case "static", "userpass":
		accessKey := strings.TrimSpace(p.Username)
		secretKey := strings.TrimSpace(p.Password)
		sessionToken := strings.TrimSpace(p.Token)
		if accessKey == "" || secretKey == "" {
			return nil, "", fmt.Errorf("AWS Access Key ID and Secret Access Key are required for static auth")
		}
		configOptions = append(configOptions, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKey, secretKey, sessionToken),
		))

	case "profile":
		profileName := strings.TrimSpace(p.AWSProfile)
		if profileName != "" {
			configOptions = append(configOptions, config.WithSharedConfigProfile(profileName))
		}

	case "default_chain":
		// Default AWS credential chain (env vars, IAM role, SSO, etc.)

	case "none", "dummy", "":
		// Default / Dummy credentials (useful for LocalStack, ElasticMQ, Docker)
		accessKey := strings.TrimSpace(p.Username)
		if accessKey == "" {
			accessKey = "test"
		}
		secretKey := strings.TrimSpace(p.Password)
		if secretKey == "" {
			secretKey = "test"
		}
		sessionToken := strings.TrimSpace(p.Token)
		configOptions = append(configOptions, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKey, secretKey, sessionToken),
		))

	default:
		return nil, "", fmt.Errorf("unsupported SQS auth type: %s", p.AuthType)
	}

	cfg, err := config.LoadDefaultConfig(ctx, configOptions...)
	if err != nil {
		return nil, "", fmt.Errorf("failed to load AWS configuration: %w", err)
	}

	rawEndpoint := strings.TrimSpace(p.URL)
	client := sqs.NewFromConfig(cfg, func(o *sqs.Options) {
		if rawEndpoint != "" {
			o.BaseEndpoint = aws.String(rawEndpoint)
		}
	})

	endpointDisplay := rawEndpoint
	if endpointDisplay == "" {
		endpointDisplay = fmt.Sprintf("AWS Cloud (%s)", region)
	}

	return client, endpointDisplay, nil
}

// ResolveQueueURL ensures the returned QueueURL routes properly through the custom endpoint
// when connecting to local variants (LocalStack, ElasticMQ) that might return internal Docker hostnames.
func (m *SqsManager) ResolveQueueURL(rawQueueURL string) string {
	m.mu.RLock()
	p := m.profile
	m.mu.RUnlock()

	if p == nil || strings.TrimSpace(p.URL) == "" {
		return rawQueueURL
	}

	baseEndpoint := strings.TrimSpace(p.URL)
	baseParsed, err := url.Parse(baseEndpoint)
	if err != nil {
		return rawQueueURL
	}

	queueParsed, err := url.Parse(rawQueueURL)
	if err != nil {
		return rawQueueURL
	}

	// Override scheme and host with the user's configured base endpoint
	queueParsed.Scheme = baseParsed.Scheme
	queueParsed.Host = baseParsed.Host
	return queueParsed.String()
}

// TestConnection verifies connectivity, validates credentials/region, and measures RTT latency
func (m *SqsManager) TestConnection(p storage.ConnectionProfile) (*SQSClusterStatus, error) {
	client, endpointDisplay, err := m.buildClient(&p)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	region := strings.TrimSpace(p.AWSRegion)
	if region == "" {
		region = "us-east-1"
	}

	start := time.Now()
	out, err := client.ListQueues(ctx, &sqs.ListQueuesInput{
		MaxResults: aws.Int32(10),
	})
	if err != nil {
		return nil, fmt.Errorf("SQS connection test failed: %w", err)
	}
	rtt := float64(time.Since(start).Microseconds()) / 1000.0

	isLocal := strings.TrimSpace(p.URL) != ""

	return &SQSClusterStatus{
		Connected:        true,
		Connecting:       false,
		Protocol:         "sqs",
		CurrentProfileID: p.ID,
		Endpoint:         endpointDisplay,
		Region:           region,
		QueuesCount:      len(out.QueueUrls),
		RTTMs:            rtt,
		IsLocal:          isLocal,
	}, nil
}

// Connect establishes active SQS connection and starts background telemetry
func (m *SqsManager) Connect(p storage.ConnectionProfile) (*SQSClusterStatus, error) {
	m.Disconnect()

	m.mu.Lock()
	m.status = SQSClusterStatus{
		Connecting:       true,
		Protocol:         "sqs",
		CurrentProfileID: p.ID,
	}
	m.mu.Unlock()
	m.emitStatus()

	client, endpointDisplay, err := m.buildClient(&p)
	if err != nil {
		m.mu.Lock()
		m.status = SQSClusterStatus{
			Connected:        false,
			Connecting:       false,
			Protocol:         "sqs",
			LastError:        err.Error(),
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	start := time.Now()
	out, err := client.ListQueues(ctx, &sqs.ListQueuesInput{
		MaxResults: aws.Int32(50),
	})
	if err != nil {
		m.mu.Lock()
		m.status = SQSClusterStatus{
			Connected:        false,
			Connecting:       false,
			Protocol:         "sqs",
			LastError:        err.Error(),
			CurrentProfileID: p.ID,
		}
		m.mu.Unlock()
		m.emitStatus()
		return nil, fmt.Errorf("failed to connect to SQS: %w", err)
	}
	rtt := float64(time.Since(start).Microseconds()) / 1000.0

	region := strings.TrimSpace(p.AWSRegion)
	if region == "" {
		region = "us-east-1"
	}
	isLocal := strings.TrimSpace(p.URL) != ""

	stopCh := make(chan struct{})

	m.mu.Lock()
	m.client = client
	m.profile = &p
	m.stopPingCh = stopCh
	m.status = SQSClusterStatus{
		Connected:        true,
		Connecting:       false,
		Protocol:         "sqs",
		CurrentProfileID: p.ID,
		Endpoint:         endpointDisplay,
		Region:           region,
		QueuesCount:      len(out.QueueUrls),
		RTTMs:            rtt,
		IsLocal:          isLocal,
	}
	m.mu.Unlock()

	m.emitStatus()
	go m.startTelemetryLoop(stopCh)

	return &m.status, nil
}

// Disconnect closes active connection and cleans up background loops
func (m *SqsManager) Disconnect() {
	m.StopSQSLivePoll()

	m.mu.Lock()
	if m.stopPingCh != nil {
		close(m.stopPingCh)
		m.stopPingCh = nil
	}
	m.client = nil
	m.profile = nil
	m.status = SQSClusterStatus{
		Connected:  false,
		Connecting: false,
		Protocol:   "sqs",
	}
	m.mu.Unlock()
	m.emitStatus()
}

func (m *SqsManager) GetStatus() SQSClusterStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *SqsManager) emitStatus() {
	if m.ctx != nil {
		m.mu.RLock()
		status := m.status
		m.mu.RUnlock()
		runtime.EventsEmit(m.ctx, "sqs:status", status)
	}
}

// startTelemetryLoop periodically measures RTT and verifies queue availability
func (m *SqsManager) startTelemetryLoop(stopCh chan struct{}) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			m.mu.RLock()
			client := m.client
			m.mu.RUnlock()

			if client == nil {
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			start := time.Now()
			out, err := client.ListQueues(ctx, &sqs.ListQueuesInput{
				MaxResults: aws.Int32(10),
			})
			cancel()

			m.mu.Lock()
			if err != nil {
				m.status.LastError = err.Error()
			} else {
				m.status.LastError = ""
				m.status.RTTMs = float64(time.Since(start).Microseconds()) / 1000.0
				m.status.QueuesCount = len(out.QueueUrls)
			}
			m.mu.Unlock()
			m.emitStatus()
		}
	}
}
