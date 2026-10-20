package natsmanager

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

// ObjectBucketInfo represents detailed metadata and status of an Object Store bucket
type ObjectBucketInfo struct {
	Bucket       string            `json:"bucket"`
	Description  string            `json:"description,omitempty"`
	Size         uint64            `json:"size"`
	Storage      string            `json:"storage"` // "file" or "memory"
	Replicas     int               `json:"replicas"`
	Sealed       bool              `json:"sealed"`
	TTL          int64             `json:"ttl"` // in seconds
	IsCompressed bool              `json:"isCompressed"`
	BackingStore string            `json:"backingStore"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// ObjectBucketCreateParams contains parameters needed to create an Object Store bucket
type ObjectBucketCreateParams struct {
	Bucket      string            `json:"bucket"`
	Description string            `json:"description,omitempty"`
	TTLSec      int64             `json:"ttlSec"`
	MaxBytes    int64             `json:"maxBytes"`
	Storage     string            `json:"storage"` // "file" or "memory"
	Replicas    int               `json:"replicas"`
	Compression bool              `json:"compression"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// ObjectEntryInfo represents metadata about an object stored inside a bucket
type ObjectEntryInfo struct {
	Bucket      string              `json:"bucket"`
	Name        string              `json:"name"`
	Description string              `json:"description,omitempty"`
	Size        uint64              `json:"size"`
	ModTime     time.Time           `json:"modTime"`
	Chunks      uint32              `json:"chunks"`
	Digest      string              `json:"digest,omitempty"`
	Deleted     bool                `json:"deleted"`
	NUID        string              `json:"nuid"`
	Metadata    map[string]string   `json:"metadata,omitempty"`
	Headers     map[string][]string `json:"headers,omitempty"`
	IsLink      bool                `json:"isLink"`
	LinkTarget  string              `json:"linkTarget,omitempty"`
}

// ListObjectBuckets returns information for all Object Store buckets
func (m *NatsManager) ListObjectBuckets(ctx context.Context) ([]ObjectBucketInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()

	lister := js.ObjectStores(ctxTimeout)
	var list []ObjectBucketInfo

	for status := range lister.Status() {
		storageStr := "file"
		if status.Storage() == jetstream.MemoryStorage {
			storageStr = "memory"
		}

		info := ObjectBucketInfo{
			Bucket:       status.Bucket(),
			Description:  status.Description(),
			Size:         status.Size(),
			Storage:      storageStr,
			Replicas:     status.Replicas(),
			Sealed:       status.Sealed(),
			TTL:          int64(status.TTL().Seconds()),
			IsCompressed: status.IsCompressed(),
			BackingStore: status.BackingStore(),
			Metadata:     status.Metadata(),
		}
		list = append(list, info)
	}

	if err := lister.Error(); err != nil {
		return nil, fmt.Errorf("failed to list object buckets: %w", err)
	}

	return list, nil
}

// GetObjectBucket returns status for a specific Object Store bucket
func (m *NatsManager) GetObjectBucket(ctx context.Context, bucket string) (*ObjectBucketInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	obs, err := js.ObjectStore(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	status, err := obs.Status(ctxTimeout)
	if err != nil {
		return nil, fmt.Errorf("failed to get status for bucket '%s': %w", bucket, err)
	}

	storageStr := "file"
	if status.Storage() == jetstream.MemoryStorage {
		storageStr = "memory"
	}

	info := &ObjectBucketInfo{
		Bucket:       status.Bucket(),
		Description:  status.Description(),
		Size:         status.Size(),
		Storage:      storageStr,
		Replicas:     status.Replicas(),
		Sealed:       status.Sealed(),
		TTL:          int64(status.TTL().Seconds()),
		IsCompressed: status.IsCompressed(),
		BackingStore: status.BackingStore(),
		Metadata:     status.Metadata(),
	}
	return info, nil
}

// CreateObjectBucket creates a new Object Store bucket
func (m *NatsManager) CreateObjectBucket(ctx context.Context, p ObjectBucketCreateParams) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	storageType := jetstream.FileStorage
	if p.Storage == "memory" {
		storageType = jetstream.MemoryStorage
	}

	replicas := p.Replicas
	if replicas <= 0 {
		replicas = 1
	}

	cfg := jetstream.ObjectStoreConfig{
		Bucket:      p.Bucket,
		Description: p.Description,
		TTL:         time.Duration(p.TTLSec) * time.Second,
		MaxBytes:    p.MaxBytes,
		Storage:     storageType,
		Replicas:    replicas,
		Compression: p.Compression,
		Metadata:    p.Metadata,
	}

	_, err = js.CreateObjectStore(ctxTimeout, cfg)
	if err != nil {
		return fmt.Errorf("failed to create object store '%s': %w", p.Bucket, err)
	}

	return nil
}

// DeleteObjectBucket removes an Object Store bucket and purges its messages
func (m *NatsManager) DeleteObjectBucket(ctx context.Context, bucket string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := js.DeleteObjectStore(ctxTimeout, bucket); err != nil {
		return fmt.Errorf("failed to delete object store '%s': %w", bucket, err)
	}

	return nil
}

// SealObjectBucket permanently seals an Object Store bucket
func (m *NatsManager) SealObjectBucket(ctx context.Context, bucket string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	obs, err := js.ObjectStore(ctxTimeout, bucket)
	if err != nil {
		return fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	if err := obs.Seal(ctxTimeout); err != nil {
		return fmt.Errorf("failed to seal object store '%s': %w", bucket, err)
	}

	return nil
}

// ListObjects returns information about all objects in a bucket
func (m *NatsManager) ListObjects(ctx context.Context, bucket string) ([]ObjectEntryInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	obs, err := js.ObjectStore(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	objects, err := obs.List(ctxTimeout)
	if err != nil {
		if errors.Is(err, jetstream.ErrNoObjectsFound) {
			return []ObjectEntryInfo{}, nil
		}
		return nil, fmt.Errorf("failed to list objects in bucket '%s': %w", bucket, err)
	}

	var res []ObjectEntryInfo
	for _, obj := range objects {
		if obj == nil {
			continue
		}

		isLink := false
		linkTarget := ""
		if obj.Opts != nil && obj.Opts.Link != nil {
			isLink = true
			if obj.Opts.Link.Name != "" {
				linkTarget = fmt.Sprintf("%s / %s", obj.Opts.Link.Bucket, obj.Opts.Link.Name)
			} else {
				linkTarget = obj.Opts.Link.Bucket
			}
		}

		entry := ObjectEntryInfo{
			Bucket:      obj.Bucket,
			Name:        obj.Name,
			Description: obj.Description,
			Size:        obj.Size,
			ModTime:     obj.ModTime,
			Chunks:      obj.Chunks,
			Digest:      obj.Digest,
			Deleted:     obj.Deleted,
			NUID:        obj.NUID,
			Metadata:    obj.Metadata,
			Headers:     obj.Headers,
			IsLink:      isLink,
			LinkTarget:  linkTarget,
		}
		res = append(res, entry)
	}

	return res, nil
}

// GetObjectInfo returns metadata for a single object
func (m *NatsManager) GetObjectInfo(ctx context.Context, bucket string, name string) (*ObjectEntryInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	obs, err := js.ObjectStore(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	obj, err := obs.GetInfo(ctxTimeout, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get info for object '%s': %w", name, err)
	}

	isLink := false
	linkTarget := ""
	if obj.Opts != nil && obj.Opts.Link != nil {
		isLink = true
		if obj.Opts.Link.Name != "" {
			linkTarget = fmt.Sprintf("%s / %s", obj.Opts.Link.Bucket, obj.Opts.Link.Name)
		} else {
			linkTarget = obj.Opts.Link.Bucket
		}
	}

	return &ObjectEntryInfo{
		Bucket:      obj.Bucket,
		Name:        obj.Name,
		Description: obj.Description,
		Size:        obj.Size,
		ModTime:     obj.ModTime,
		Chunks:      obj.Chunks,
		Digest:      obj.Digest,
		Deleted:     obj.Deleted,
		NUID:        obj.NUID,
		Metadata:    obj.Metadata,
		Headers:     obj.Headers,
		IsLink:      isLink,
		LinkTarget:  linkTarget,
	}, nil
}

// PutObject streams data into an object from an io.Reader
func (m *NatsManager) PutObject(ctx context.Context, bucket string, name string, description string, r io.Reader, meta map[string]string) (*ObjectEntryInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	obs, err := js.ObjectStore(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	objMeta := jetstream.ObjectMeta{
		Name:        name,
		Description: description,
		Metadata:    meta,
	}

	info, err := obs.Put(ctx, objMeta, r)
	if err != nil {
		return nil, fmt.Errorf("failed to put object '%s': %w", name, err)
	}

	return &ObjectEntryInfo{
		Bucket:      info.Bucket,
		Name:        info.Name,
		Description: info.Description,
		Size:        info.Size,
		ModTime:     info.ModTime,
		Chunks:      info.Chunks,
		Digest:      info.Digest,
		Deleted:     info.Deleted,
		NUID:        info.NUID,
		Metadata:    info.Metadata,
		Headers:     info.Headers,
	}, nil
}

// PutObjectBytes puts a raw byte slice into an object
func (m *NatsManager) PutObjectBytes(ctx context.Context, bucket string, name string, description string, data []byte, meta map[string]string) (*ObjectEntryInfo, error) {
	return m.PutObject(ctx, bucket, name, description, bytes.NewReader(data), meta)
}

// PutObjectFile uploads a local file from disk directly into the object store
func (m *NatsManager) PutObjectFile(ctx context.Context, bucket string, name string, description string, filePath string, meta map[string]string) (*ObjectEntryInfo, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open local file '%s': %w", filePath, err)
	}
	defer f.Close()

	if name == "" {
		name = filepath.Base(filePath)
	}

	return m.PutObject(ctx, bucket, name, description, f, meta)
}

// GetObjectBytes retrieves the full object content as bytes
func (m *NatsManager) GetObjectBytes(ctx context.Context, bucket string, name string) ([]byte, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	obs, err := js.ObjectStore(ctxTimeout, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	data, err := obs.GetBytes(ctxTimeout, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get object bytes for '%s': %w", name, err)
	}

	return data, nil
}

// SaveObjectToFile streams an object directly to a destination path on local disk
func (m *NatsManager) SaveObjectToFile(ctx context.Context, bucket string, name string, targetPath string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	obs, err := js.ObjectStore(ctx, bucket)
	if err != nil {
		return fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	if err := obs.GetFile(ctx, name, targetPath); err != nil {
		return fmt.Errorf("failed to save object '%s' to '%s': %w", name, targetPath, err)
	}

	return nil
}

// DeleteObject deletes an object from the bucket
func (m *NatsManager) DeleteObject(ctx context.Context, bucket string, name string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	obs, err := js.ObjectStore(ctxTimeout, bucket)
	if err != nil {
		return fmt.Errorf("failed to bind to object store '%s': %w", bucket, err)
	}

	if err := obs.Delete(ctxTimeout, name); err != nil {
		return fmt.Errorf("failed to delete object '%s': %w", name, err)
	}

	return nil
}
