package natsmanager

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

// KVBucketInfo represents detailed metadata and status of a KV bucket
type KVBucketInfo struct {
	Bucket       string            `json:"bucket"`
	Description  string            `json:"description,omitempty"`
	Values       uint64            `json:"values"`
	History      int64             `json:"history"`
	TTL          int64             `json:"ttl"` // in seconds
	BackingStore string            `json:"backingStore"`
	Bytes        uint64            `json:"bytes"`
	IsCompressed bool              `json:"isCompressed"`
	Storage      string            `json:"storage"` // "file" or "memory"
	Replicas     int               `json:"replicas"`
	MaxValueSize int32             `json:"maxValueSize"`
	MaxBytes     int64             `json:"maxBytes"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// KVBucketCreateParams contains fields needed to create or update a KV bucket
type KVBucketCreateParams struct {
	Bucket       string            `json:"bucket"`
	Description  string            `json:"description,omitempty"`
	MaxValueSize int32             `json:"maxValueSize"`
	History      uint8             `json:"history"`
	TTLSec       int64             `json:"ttlSec"`
	MaxBytes     int64             `json:"maxBytes"`
	Storage      string            `json:"storage"` // "file" or "memory"
	Replicas     int               `json:"replicas"`
	Compression  bool              `json:"compression"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// KVEntryInfo represents a key-value entry with value payload, revision and operation
type KVEntryInfo struct {
	Bucket    string    `json:"bucket"`
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	IsBinary  bool      `json:"isBinary"`
	Revision  uint64    `json:"revision"`
	Created   time.Time `json:"created"`
	Delta     uint64    `json:"delta"`
	Operation string    `json:"operation"` // "PUT", "DEL", "PURGE"
	Size      int       `json:"size"`
}

// ListKVBuckets returns information for all Key-Value buckets
func (m *NatsManager) ListKVBuckets(ctx context.Context) ([]KVBucketInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	lister := js.KeyValueStores(ctxTimeout)
	var list []KVBucketInfo

	for status := range lister.Status() {
		cfg := status.Config()
		storageStr := "file"
		if cfg.Storage == jetstream.MemoryStorage {
			storageStr = "memory"
		}

		info := KVBucketInfo{
			Bucket:       status.Bucket(),
			Description:  cfg.Description,
			Values:       status.Values(),
			History:      status.History(),
			TTL:          int64(status.TTL().Seconds()),
			BackingStore: status.BackingStore(),
			Bytes:        status.Bytes(),
			IsCompressed: status.IsCompressed(),
			Storage:      storageStr,
			Replicas:     cfg.Replicas,
			MaxValueSize: cfg.MaxValueSize,
			MaxBytes:     cfg.MaxBytes,
			Metadata:     status.Metadata(),
		}
		list = append(list, info)
	}

	if err := lister.Error(); err != nil {
		return nil, fmt.Errorf("failed to list KV buckets: %w", err)
	}

	return list, nil
}

// GetKVBucket returns status and config for a specific bucket
func (m *NatsManager) GetKVBucket(ctx context.Context, bucket string) (*KVBucketInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("bucket not found: %w", err)
	}

	status, err := kv.Status(ctxTimeout)
	if err != nil {
		return nil, fmt.Errorf("failed to get bucket status: %w", err)
	}

	cfg := status.Config()
	storageStr := "file"
	if cfg.Storage == jetstream.MemoryStorage {
		storageStr = "memory"
	}

	return &KVBucketInfo{
		Bucket:       status.Bucket(),
		Description:  cfg.Description,
		Values:       status.Values(),
		History:      status.History(),
		TTL:          int64(status.TTL().Seconds()),
		BackingStore: status.BackingStore(),
		Bytes:        status.Bytes(),
		IsCompressed: status.IsCompressed(),
		Storage:      storageStr,
		Replicas:     cfg.Replicas,
		MaxValueSize: cfg.MaxValueSize,
		MaxBytes:     cfg.MaxBytes,
		Metadata:     status.Metadata(),
	}, nil
}

// CreateKVBucket creates a new Key-Value store
func (m *NatsManager) CreateKVBucket(ctx context.Context, p KVBucketCreateParams) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	storageType := jetstream.FileStorage
	if p.Storage == "memory" {
		storageType = jetstream.MemoryStorage
	}

	history := p.History
	if history <= 0 {
		history = 1
	} else if history > 64 {
		history = 64
	}

	replicas := p.Replicas
	if replicas <= 0 {
		replicas = 1
	}

	cfg := jetstream.KeyValueConfig{
		Bucket:       p.Bucket,
		Description:  p.Description,
		MaxValueSize: p.MaxValueSize,
		History:      history,
		TTL:          time.Duration(p.TTLSec) * time.Second,
		MaxBytes:     p.MaxBytes,
		Storage:      storageType,
		Replicas:     replicas,
		Compression:  p.Compression,
		Metadata:     p.Metadata,
	}

	_, err = js.CreateKeyValue(ctxTimeout, cfg)
	if err != nil {
		return fmt.Errorf("failed to create KV bucket '%s': %w", p.Bucket, err)
	}

	return nil
}

// UpdateKVBucket updates an existing Key-Value store
func (m *NatsManager) UpdateKVBucket(ctx context.Context, p KVBucketCreateParams) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	storageType := jetstream.FileStorage
	if p.Storage == "memory" {
		storageType = jetstream.MemoryStorage
	}

	history := p.History
	if history <= 0 {
		history = 1
	} else if history > 64 {
		history = 64
	}

	replicas := p.Replicas
	if replicas <= 0 {
		replicas = 1
	}

	cfg := jetstream.KeyValueConfig{
		Bucket:       p.Bucket,
		Description:  p.Description,
		MaxValueSize: p.MaxValueSize,
		History:      history,
		TTL:          time.Duration(p.TTLSec) * time.Second,
		MaxBytes:     p.MaxBytes,
		Storage:      storageType,
		Replicas:     replicas,
		Compression:  p.Compression,
		Metadata:     p.Metadata,
	}

	_, err = js.UpdateKeyValue(ctxTimeout, cfg)
	if err != nil {
		return fmt.Errorf("failed to update KV bucket '%s': %w", p.Bucket, err)
	}

	return nil
}

// DeleteKVBucket deletes a Key-Value bucket
func (m *NatsManager) DeleteKVBucket(ctx context.Context, bucket string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err = js.DeleteKeyValue(ctxTimeout, bucket)
	if err != nil {
		return fmt.Errorf("failed to delete KV bucket '%s': %w", bucket, err)
	}

	return nil
}

// PurgeKVDeletes removes all delete markers from the bucket
func (m *NatsManager) PurgeKVDeletes(ctx context.Context, bucket string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return fmt.Errorf("failed to bind to KV bucket: %w", err)
	}

	err = kv.PurgeDeletes(ctxTimeout)
	if err != nil {
		return fmt.Errorf("failed to purge delete markers: %w", err)
	}

	return nil
}

// ListKVEntries lists all keys and their latest state in the bucket
func (m *NatsManager) ListKVEntries(ctx context.Context, bucket string) ([]KVEntryInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to KV bucket: %w", err)
	}

	watcher, err := kv.WatchAll(ctxTimeout)
	if err != nil {
		return nil, fmt.Errorf("failed to watch KV bucket: %w", err)
	}
	defer watcher.Stop()

	var entries []KVEntryInfo
	// WatchAll sends current latest values, then a nil entry to signal end of initial values
	for entry := range watcher.Updates() {
		if entry == nil {
			break
		}

		opStr := "PUT"
		if entry.Operation() == jetstream.KeyValueDelete {
			opStr = "DEL"
		} else if entry.Operation() == jetstream.KeyValuePurge {
			opStr = "PURGE"
		}

		dataBytes := entry.Value()
		binFlag := isBinary(dataBytes)

		entries = append(entries, KVEntryInfo{
			Bucket:    entry.Bucket(),
			Key:       entry.Key(),
			Value:     string(dataBytes),
			IsBinary:  binFlag,
			Revision:  entry.Revision(),
			Created:   entry.Created(),
			Delta:     entry.Delta(),
			Operation: opStr,
			Size:      len(dataBytes),
		})
	}

	return entries, nil
}

// GetKVEntry fetches the latest value for a specific key
func (m *NatsManager) GetKVEntry(ctx context.Context, bucket string, key string) (*KVEntryInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to KV bucket: %w", err)
	}

	entry, err := kv.Get(ctxTimeout, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get key '%s': %w", key, err)
	}

	opStr := "PUT"
	if entry.Operation() == jetstream.KeyValueDelete {
		opStr = "DEL"
	} else if entry.Operation() == jetstream.KeyValuePurge {
		opStr = "PURGE"
	}

	dataBytes := entry.Value()
	binFlag := isBinary(dataBytes)

	return &KVEntryInfo{
		Bucket:    entry.Bucket(),
		Key:       entry.Key(),
		Value:     string(dataBytes),
		IsBinary:  binFlag,
		Revision:  entry.Revision(),
		Created:   entry.Created(),
		Delta:     entry.Delta(),
		Operation: opStr,
		Size:      len(dataBytes),
	}, nil
}

// PutKVEntry creates or updates a key value
func (m *NatsManager) PutKVEntry(ctx context.Context, bucket string, key string, val string) (uint64, error) {
	js, err := m.getJetStream()
	if err != nil {
		return 0, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return 0, fmt.Errorf("failed to bind to KV bucket: %w", err)
	}

	rev, err := kv.PutString(ctxTimeout, key, val)
	if err != nil {
		return 0, fmt.Errorf("failed to put key '%s': %w", key, err)
	}

	return rev, nil
}

// DeleteKVEntry marks a key as deleted (tombstone) preserving history
func (m *NatsManager) DeleteKVEntry(ctx context.Context, bucket string, key string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return fmt.Errorf("failed to bind to KV bucket: %w", err)
	}

	err = kv.Delete(ctxTimeout, key)
	if err != nil {
		return fmt.Errorf("failed to delete key '%s': %w", key, err)
	}

	return nil
}

// PurgeKVEntry marks key as purged and removes all previous history revisions
func (m *NatsManager) PurgeKVEntry(ctx context.Context, bucket string, key string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return fmt.Errorf("failed to bind to KV bucket: %w", err)
	}

	err = kv.Purge(ctxTimeout, key)
	if err != nil {
		return fmt.Errorf("failed to purge key '%s': %w", key, err)
	}

	return nil
}

// GetKVHistory returns all historical revisions for a key (up to max history)
func (m *NatsManager) GetKVHistory(ctx context.Context, bucket string, key string) ([]KVEntryInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	kv, err := js.KeyValue(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to KV bucket: %w", err)
	}

	entries, err := kv.History(ctxTimeout, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for key '%s': %w", key, err)
	}

	var res []KVEntryInfo
	// Return in reverse chronological order (newest revision first)
	for i := len(entries) - 1; i >= 0; i-- {
		e := entries[i]
		opStr := "PUT"
		if e.Operation() == jetstream.KeyValueDelete {
			opStr = "DEL"
		} else if e.Operation() == jetstream.KeyValuePurge {
			opStr = "PURGE"
		}

		dataBytes := e.Value()
		binFlag := isBinary(dataBytes)

		res = append(res, KVEntryInfo{
			Bucket:    e.Bucket(),
			Key:       e.Key(),
			Value:     string(dataBytes),
			IsBinary:  binFlag,
			Revision:  e.Revision(),
			Created:   e.Created(),
			Delta:     e.Delta(),
			Operation: opStr,
			Size:      len(dataBytes),
		})
	}

	return res, nil
}