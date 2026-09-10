package main

import (
	"context"
	"fmt"

	"streamer/internal/natsmanager"
	"streamer/internal/storage"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx         context.Context
	storage     *storage.Storage
	natsManager *natsmanager.NatsManager
}

// NewApp creates a new App application struct
func NewApp() *App {
	store, err := storage.NewStorage()
	if err != nil {
		fmt.Printf("Warning: Failed to initialize SQLite storage: %v\n", err)
	}

	mgr := natsmanager.NewNatsManager()

	return &App{
		storage:     store,
		natsManager: mgr,
	}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.natsManager.SetContext(ctx)
}

// GetSavedConnections returns all saved profiles from SQLite
func (a *App) GetSavedConnections() ([]storage.ConnectionProfile, error) {
	if a.storage == nil {
		return []storage.ConnectionProfile{}, fmt.Errorf("storage not initialized")
	}
	return a.storage.GetAllConnections()
}

// SaveConnection creates or updates a connection profile
func (a *App) SaveConnection(p storage.ConnectionProfile) error {
	if a.storage == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.storage.SaveConnection(p)
}

// DeleteConnection removes a connection profile
func (a *App) DeleteConnection(id string) error {
	if a.storage == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.storage.DeleteConnection(id)
}

// TestConnection verifies NATS connectivity without disconnecting active connection
func (a *App) TestConnection(p storage.ConnectionProfile) (*natsmanager.ServerStatus, error) {
	return a.natsManager.TestConnection(p)
}

// Connect establishes active connection to a NATS profile and auto-saves credentials to SQLite
func (a *App) Connect(p storage.ConnectionProfile) (*natsmanager.ServerStatus, error) {
	status, err := a.natsManager.Connect(p)
	if err == nil && a.storage != nil {
		// Auto-save the latest credentials into SQLite
		_ = a.storage.SaveConnection(p)
		_ = a.storage.UpdateLastConnected(p.ID)
	}
	return status, err
}

// Disconnect closes the active connection
func (a *App) Disconnect() {
	a.natsManager.Disconnect()
}

// GetConnectionStatus returns current active connection status
func (a *App) GetConnectionStatus() natsmanager.ServerStatus {
	return a.natsManager.GetStatus()
}

// SelectFile opens a native file dialog for selecting creds/certs
func (a *App) SelectFile(title string, filterName string, filterPatterns string) (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
		Filters: []runtime.FileFilter{
			{
				DisplayName: filterName,
				Pattern:     filterPatterns,
			},
		},
	})
}

// -------------------------------------------------------------
// Pub/Sub API Bindings
// -------------------------------------------------------------

// Subscribe starts listening to a subject (with optional queue group)
func (a *App) Subscribe(id string, subject string, queueGroup string) (*natsmanager.SubscriptionInfo, error) {
	return a.natsManager.Subscribe(id, subject, queueGroup)
}

// Unsubscribe stops listening to a subject
func (a *App) Unsubscribe(id string) error {
	return a.natsManager.Unsubscribe(id)
}

// GetActiveSubscriptions returns all active subscriptions
func (a *App) GetActiveSubscriptions() []natsmanager.SubscriptionInfo {
	return a.natsManager.GetSubscriptions()
}

// PublishMessage sends a message with optional reply-to subject and headers
func (a *App) PublishMessage(subject string, replyTo string, headers map[string][]string, payload string) error {
	return a.natsManager.Publish(subject, replyTo, headers, []byte(payload))
}

// RequestMessage sends a request message and waits synchronously for a response
func (a *App) RequestMessage(subject string, headers map[string][]string, payload string, timeoutMs int) (*natsmanager.PubSubMessage, error) {
	return a.natsManager.Request(subject, headers, []byte(payload), timeoutMs)
}

// -------------------------------------------------------------
// Settings API Bindings
// -------------------------------------------------------------

func (a *App) GetSetting(key string, defaultValue string) string {
	if a.storage == nil {
		return defaultValue
	}
	return a.storage.GetSetting(key, defaultValue)
}

func (a *App) SetSetting(key string, value string) error {
	if a.storage == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.storage.SetSetting(key, value)
}

// -------------------------------------------------------------
// JetStream API Bindings
// -------------------------------------------------------------

func (a *App) ListStreams() ([]natsmanager.JSStreamInfo, error) {
	return a.natsManager.ListStreams(a.ctx)
}

func (a *App) CreateStream(p natsmanager.StreamCreateParams) error {
	return a.natsManager.CreateStream(a.ctx, p)
}

func (a *App) UpdateStream(p natsmanager.StreamCreateParams) error {
	return a.natsManager.UpdateStream(a.ctx, p)
}

func (a *App) DeleteStream(name string) error {
	return a.natsManager.DeleteStream(a.ctx, name)
}

func (a *App) PurgeStream(name string, subject string, seq uint64) error {
	return a.natsManager.PurgeStream(a.ctx, name, subject, seq)
}

func (a *App) GetStreamMsg(streamName string, seq uint64) (*natsmanager.JSStoredMsg, error) {
	return a.natsManager.GetStreamMsg(a.ctx, streamName, seq)
}

func (a *App) GetStreamMsgsBatch(streamName string, startSeq uint64, limit int, reverse bool) ([]natsmanager.JSStoredMsg, error) {
	return a.natsManager.GetStreamMsgsBatch(a.ctx, streamName, startSeq, limit, reverse)
}

func (a *App) DeleteStreamMsg(streamName string, seq uint64) error {
	return a.natsManager.DeleteStreamMsg(a.ctx, streamName, seq)
}

func (a *App) ListConsumers(streamName string) ([]natsmanager.JSConsumerInfo, error) {
	return a.natsManager.ListConsumers(a.ctx, streamName)
}

func (a *App) CreateConsumer(p natsmanager.ConsumerCreateParams) error {
	return a.natsManager.CreateConsumer(a.ctx, p)
}

func (a *App) DeleteConsumer(streamName string, consumerName string) error {
	return a.natsManager.DeleteConsumer(a.ctx, streamName, consumerName)
}

// -------------------------------------------------------------
// Key-Value (KV) Store API Bindings
// -------------------------------------------------------------

func (a *App) ListKVBuckets() ([]natsmanager.KVBucketInfo, error) {
	return a.natsManager.ListKVBuckets(a.ctx)
}

func (a *App) GetKVBucket(bucket string) (*natsmanager.KVBucketInfo, error) {
	return a.natsManager.GetKVBucket(a.ctx, bucket)
}

func (a *App) CreateKVBucket(p natsmanager.KVBucketCreateParams) error {
	return a.natsManager.CreateKVBucket(a.ctx, p)
}

func (a *App) UpdateKVBucket(p natsmanager.KVBucketCreateParams) error {
	return a.natsManager.UpdateKVBucket(a.ctx, p)
}

func (a *App) DeleteKVBucket(bucket string) error {
	return a.natsManager.DeleteKVBucket(a.ctx, bucket)
}

func (a *App) PurgeKVDeletes(bucket string) error {
	return a.natsManager.PurgeKVDeletes(a.ctx, bucket)
}

func (a *App) ListKVEntries(bucket string) ([]natsmanager.KVEntryInfo, error) {
	return a.natsManager.ListKVEntries(a.ctx, bucket)
}

func (a *App) GetKVEntry(bucket string, key string) (*natsmanager.KVEntryInfo, error) {
	return a.natsManager.GetKVEntry(a.ctx, bucket, key)
}

func (a *App) PutKVEntry(bucket string, key string, val string) (uint64, error) {
	return a.natsManager.PutKVEntry(a.ctx, bucket, key, val)
}

func (a *App) DeleteKVEntry(bucket string, key string) error {
	return a.natsManager.DeleteKVEntry(a.ctx, bucket, key)
}

func (a *App) PurgeKVEntry(bucket string, key string) error {
	return a.natsManager.PurgeKVEntry(a.ctx, bucket, key)
}

func (a *App) GetKVHistory(bucket string, key string) ([]natsmanager.KVEntryInfo, error) {
	return a.natsManager.GetKVHistory(a.ctx, bucket, key)
}

