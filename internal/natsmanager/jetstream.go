package natsmanager

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

// DTOs for frontend serialization

type JSStreamInfo struct {
	Name          string    `json:"name"`
	Description   string    `json:"description,omitempty"`
	Subjects      []string  `json:"subjects"`
	Storage       string    `json:"storage"` // file or memory
	Retention     string    `json:"retention"` // limits, interest, workqueue
	Discard       string    `json:"discard"` // old, new
	MaxMsgs       int64     `json:"maxMsgs"`
	MaxBytes      int64     `json:"maxBytes"`
	MaxAgeSec     int64     `json:"maxAgeSec"`
	MaxMsgSize    int32     `json:"maxMsgSize"`
	Replicas      int       `json:"replicas"`
	Msgs          uint64    `json:"msgs"`
	Bytes         uint64    `json:"bytes"`
	FirstSeq      uint64    `json:"firstSeq"`
	LastSeq       uint64    `json:"lastSeq"`
	FirstTime          time.Time `json:"firstTime"`
	LastTime           time.Time `json:"lastTime"`
	ConsumerCount      int       `json:"consumerCount"`
	AllowMsgSchedules  bool      `json:"allowMsgSchedules"`
	DenyPurge          bool      `json:"denyPurge"`
	DenyDelete         bool      `json:"denyDelete"`
}

type StreamCreateParams struct {
	Name               string   `json:"name"`
	Description        string   `json:"description,omitempty"`
	Subjects           []string `json:"subjects"`
	Storage            string   `json:"storage"` // "file" or "memory"
	Retention          string   `json:"retention"` // "limits", "interest", "workqueue"
	Discard            string   `json:"discard"` // "old", "new"
	MaxMsgs            int64    `json:"maxMsgs"`
	MaxBytes           int64    `json:"maxBytes"`
	MaxAgeSec          int64    `json:"maxAgeSec"`
	MaxMsgSize         int32    `json:"maxMsgSize"`
	Replicas           int      `json:"replicas"`
	AllowMsgSchedules  bool     `json:"allowMsgSchedules"`
	DenyPurge          bool     `json:"denyPurge"`
	DenyDelete         bool     `json:"denyDelete"`
}

type JSConsumerInfo struct {
	Stream         string   `json:"stream"`
	Name           string   `json:"name"`
	Durable        string   `json:"durable,omitempty"`
	Description    string   `json:"description,omitempty"`
	DeliverPolicy  string   `json:"deliverPolicy"`
	AckPolicy      string   `json:"ackPolicy"`
	AckWaitSec     int64    `json:"ackWaitSec"`
	MaxDeliver     int      `json:"maxDeliver"`
	FilterSubject  string   `json:"filterSubject,omitempty"`
	FilterSubjects []string `json:"filterSubjects,omitempty"`
	ReplayPolicy   string   `json:"replayPolicy"`
	NumAckPending  int      `json:"numAckPending"`
	NumRedelivered int      `json:"numRedelivered"`
	NumWaiting     int      `json:"numWaiting"`
	NumPending     uint64   `json:"numPending"`
	DeliveredSeq   uint64   `json:"deliveredSeq"`
	AckFloorSeq    uint64   `json:"ackFloorSeq"`
	Paused         bool     `json:"paused"`
}

type ConsumerCreateParams struct {
	Stream        string   `json:"stream"`
	Name          string   `json:"name"`
	Durable       string   `json:"durable,omitempty"`
	Description   string   `json:"description,omitempty"`
	DeliverPolicy string   `json:"deliverPolicy"` // all, last, new, by_start_sequence
	OptStartSeq   uint64   `json:"optStartSeq,omitempty"`
	AckPolicy     string   `json:"ackPolicy"` // explicit, none, all
	AckWaitSec    int64    `json:"ackWaitSec"`
	MaxDeliver    int      `json:"maxDeliver"`
	FilterSubject string   `json:"filterSubject,omitempty"`
	FilterSubjects []string `json:"filterSubjects,omitempty"`
	ReplayPolicy  string   `json:"replayPolicy"` // instant, original
}

type JSStoredMsg struct {
	Sequence  uint64              `json:"sequence"`
	Subject   string              `json:"subject"`
	Reply     string              `json:"reply,omitempty"`
	Headers   map[string][]string `json:"headers,omitempty"`
	Data      string              `json:"data"`
	IsBinary  bool                `json:"isBinary"`
	Size      int                 `json:"size"`
	Timestamp time.Time           `json:"timestamp"`
}

func (m *NatsManager) getJetStream() (jetstream.JetStream, error) {
	m.mu.RLock()
	nc := m.nc
	m.mu.RUnlock()

	if nc == nil || !nc.IsConnected() {
		return nil, fmt.Errorf("nats client is not connected")
	}

	js, err := jetstream.New(nc)
	if err != nil {
		return nil, fmt.Errorf("jetstream not available: %w", err)
	}

	return js, nil
}

func (m *NatsManager) ListStreams(ctx context.Context) ([]JSStreamInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	lister := js.ListStreams(ctxTimeout)
	var list []JSStreamInfo

	for info := range lister.Info() {
		storageStr := "file"
		if info.Config.Storage == jetstream.MemoryStorage {
			storageStr = "memory"
		}

		retentionStr := "limits"
		switch info.Config.Retention {
		case jetstream.InterestPolicy:
			retentionStr = "interest"
		case jetstream.WorkQueuePolicy:
			retentionStr = "workqueue"
		}

		discardStr := "old"
		if info.Config.Discard == jetstream.DiscardNew {
			discardStr = "new"
		}

		list = append(list, JSStreamInfo{
			Name:          info.Config.Name,
			Description:   info.Config.Description,
			Subjects:      info.Config.Subjects,
			Storage:       storageStr,
			Retention:     retentionStr,
			Discard:       discardStr,
			MaxMsgs:       info.Config.MaxMsgs,
			MaxBytes:      info.Config.MaxBytes,
			MaxAgeSec:     int64(info.Config.MaxAge.Seconds()),
			MaxMsgSize:    info.Config.MaxMsgSize,
			Replicas:      info.Config.Replicas,
			Msgs:          info.State.Msgs,
			Bytes:         info.State.Bytes,
			FirstSeq:      info.State.FirstSeq,
			LastSeq:       info.State.LastSeq,
			FirstTime:     info.State.FirstTime,
			LastTime:      info.State.LastTime,
			ConsumerCount:      info.State.Consumers,
			AllowMsgSchedules:  info.Config.AllowMsgSchedules,
			DenyPurge:          info.Config.DenyPurge,
			DenyDelete:         info.Config.DenyDelete,
		})
	}

	if lister.Err() != nil {
		return nil, lister.Err()
	}

	return list, nil
}

func (m *NatsManager) CreateStream(ctx context.Context, p StreamCreateParams) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	cfg := jetstream.StreamConfig{
		Name:        p.Name,
		Description: p.Description,
		Subjects:    p.Subjects,
		MaxMsgs:     p.MaxMsgs,
		MaxBytes:    p.MaxBytes,
		MaxMsgSize:  p.MaxMsgSize,
		Replicas:    p.Replicas,
	}

	if p.Storage == "memory" {
		cfg.Storage = jetstream.MemoryStorage
	} else {
		cfg.Storage = jetstream.FileStorage
	}

	switch p.Retention {
	case "interest":
		cfg.Retention = jetstream.InterestPolicy
	case "workqueue":
		cfg.Retention = jetstream.WorkQueuePolicy
	default:
		cfg.Retention = jetstream.LimitsPolicy
	}

	if p.Discard == "new" {
		cfg.Discard = jetstream.DiscardNew
	} else {
		cfg.Discard = jetstream.DiscardOld
	}

	if p.MaxAgeSec > 0 {
		cfg.MaxAge = time.Duration(p.MaxAgeSec) * time.Second
	}

	if cfg.Replicas <= 0 {
		cfg.Replicas = 1
	}

	cfg.AllowMsgSchedules = p.AllowMsgSchedules
	cfg.DenyPurge = p.DenyPurge
	cfg.DenyDelete = p.DenyDelete

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err = js.CreateStream(ctxTimeout, cfg)
	return err
}

func (m *NatsManager) UpdateStream(ctx context.Context, p StreamCreateParams) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	cfg := jetstream.StreamConfig{
		Name:               p.Name,
		Description:        p.Description,
		Subjects:           p.Subjects,
		MaxMsgs:            p.MaxMsgs,
		MaxBytes:           p.MaxBytes,
		MaxMsgSize:         p.MaxMsgSize,
		Replicas:           p.Replicas,
		AllowMsgSchedules:  p.AllowMsgSchedules,
		DenyPurge:          p.DenyPurge,
		DenyDelete:         p.DenyDelete,
	}

	if p.Storage == "memory" {
		cfg.Storage = jetstream.MemoryStorage
	} else {
		cfg.Storage = jetstream.FileStorage
	}

	switch p.Retention {
	case "interest":
		cfg.Retention = jetstream.InterestPolicy
	case "workqueue":
		cfg.Retention = jetstream.WorkQueuePolicy
	default:
		cfg.Retention = jetstream.LimitsPolicy
	}

	if p.Discard == "new" {
		cfg.Discard = jetstream.DiscardNew
	} else {
		cfg.Discard = jetstream.DiscardOld
	}

	if p.MaxAgeSec > 0 {
		cfg.MaxAge = time.Duration(p.MaxAgeSec) * time.Second
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err = js.UpdateStream(ctxTimeout, cfg)
	return err
}

func (m *NatsManager) DeleteStream(ctx context.Context, name string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return js.DeleteStream(ctxTimeout, name)
}

func (m *NatsManager) PurgeStream(ctx context.Context, name string, subject string, seq uint64) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	stream, err := js.Stream(ctxTimeout, name)
	if err != nil {
		return err
	}

	var opts []jetstream.StreamPurgeOpt
	if subject != "" {
		opts = append(opts, jetstream.WithPurgeSubject(subject))
	}
	if seq > 0 {
		opts = append(opts, jetstream.WithPurgeSequence(seq))
	}

	return stream.Purge(ctxTimeout, opts...)
}

func (m *NatsManager) GetStreamMsg(ctx context.Context, streamName string, seq uint64) (*JSStoredMsg, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	stream, err := js.Stream(ctxTimeout, streamName)
	if err != nil {
		return nil, err
	}

	raw, err := stream.GetMsg(ctxTimeout, seq)
	if err != nil {
		return nil, err
	}

	binaryFlag := isBinary(raw.Data)

	return &JSStoredMsg{
		Sequence:  raw.Sequence,
		Subject:   raw.Subject,
		Headers:   raw.Header,
		Data:      string(raw.Data),
		IsBinary:  binaryFlag,
		Size:      len(raw.Data),
		Timestamp: raw.Time,
	}, nil
}

// GetStreamMsgsBatch fetches a range of messages from startSeq up to limit count (newest first or oldest first)
func (m *NatsManager) GetStreamMsgsBatch(ctx context.Context, streamName string, startSeq uint64, limit int, reverse bool) ([]JSStoredMsg, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 50
	} else if limit > 500 {
		limit = 500
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()

	stream, err := js.Stream(ctxTimeout, streamName)
	if err != nil {
		return nil, err
	}

	info, err := stream.Info(ctxTimeout)
	if err != nil {
		return nil, err
	}

	firstSeq := info.State.FirstSeq
	lastSeq := info.State.LastSeq

	if info.State.Msgs == 0 || lastSeq < firstSeq {
		return []JSStoredMsg{}, nil
	}

	var results []JSStoredMsg

	if reverse {
		// Newest downwards
		var curr uint64 = lastSeq
		if startSeq > 0 && startSeq <= lastSeq {
			curr = startSeq
		}

		consecutiveFails := 0
		for curr >= firstSeq && len(results) < limit && consecutiveFails < 20 {
			raw, err := stream.GetMsg(ctxTimeout, curr)
			if err == nil && raw != nil {
				consecutiveFails = 0
				results = append(results, JSStoredMsg{
					Sequence:  raw.Sequence,
					Subject:   raw.Subject,
					Headers:   raw.Header,
					Data:      string(raw.Data),
					IsBinary:  isBinary(raw.Data),
					Size:      len(raw.Data),
					Timestamp: raw.Time,
				})
			} else {
				consecutiveFails++
			}
			if curr == 0 {
				break
			}
			curr--
		}
	} else {
		// Oldest upwards
		var curr uint64 = firstSeq
		if startSeq > 0 && startSeq >= firstSeq {
			curr = startSeq
		}

		consecutiveFails := 0
		for curr <= lastSeq && len(results) < limit && consecutiveFails < 20 {
			raw, err := stream.GetMsg(ctxTimeout, curr)
			if err == nil && raw != nil {
				consecutiveFails = 0
				results = append(results, JSStoredMsg{
					Sequence:  raw.Sequence,
					Subject:   raw.Subject,
					Headers:   raw.Header,
					Data:      string(raw.Data),
					IsBinary:  isBinary(raw.Data),
					Size:      len(raw.Data),
					Timestamp: raw.Time,
				})
			} else {
				consecutiveFails++
			}
			curr++
		}
	}

	return results, nil
}

func (m *NatsManager) DeleteStreamMsg(ctx context.Context, streamName string, seq uint64) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	stream, err := js.Stream(ctxTimeout, streamName)
	if err != nil {
		return err
	}

	return stream.DeleteMsg(ctxTimeout, seq)
}

func (m *NatsManager) ListConsumers(ctx context.Context, streamName string) ([]JSConsumerInfo, error) {
	js, err := m.getJetStream()
	if err != nil {
		return nil, err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	stream, err := js.Stream(ctxTimeout, streamName)
	if err != nil {
		return nil, err
	}

	lister := stream.ListConsumers(ctxTimeout)
	var list []JSConsumerInfo

	for info := range lister.Info() {
		delivPolicyStr := "all"
		switch info.Config.DeliverPolicy {
		case jetstream.DeliverLastPolicy:
			delivPolicyStr = "last"
		case jetstream.DeliverNewPolicy:
			delivPolicyStr = "new"
		case jetstream.DeliverByStartSequencePolicy:
			delivPolicyStr = "by_start_sequence"
		}

		ackPolicyStr := "explicit"
		switch info.Config.AckPolicy {
		case jetstream.AckNonePolicy:
			ackPolicyStr = "none"
		case jetstream.AckAllPolicy:
			ackPolicyStr = "all"
		}

		replayStr := "instant"
		if info.Config.ReplayPolicy == jetstream.ReplayOriginalPolicy {
			replayStr = "original"
		}

		list = append(list, JSConsumerInfo{
			Stream:         info.Stream,
			Name:           info.Name,
			Durable:        info.Config.Durable,
			Description:    info.Config.Description,
			DeliverPolicy:  delivPolicyStr,
			AckPolicy:      ackPolicyStr,
			AckWaitSec:     int64(info.Config.AckWait.Seconds()),
			MaxDeliver:     info.Config.MaxDeliver,
			FilterSubject:  info.Config.FilterSubject,
			FilterSubjects: info.Config.FilterSubjects,
			ReplayPolicy:   replayStr,
			NumAckPending:  info.NumAckPending,
			NumRedelivered: info.NumRedelivered,
			NumWaiting:     info.NumWaiting,
			NumPending:     info.NumPending,
			DeliveredSeq:   info.Delivered.Stream,
			AckFloorSeq:    info.AckFloor.Stream,
			Paused:         info.Paused,
		})
	}

	if lister.Err() != nil {
		return nil, lister.Err()
	}

	return list, nil
}

func (m *NatsManager) CreateConsumer(ctx context.Context, p ConsumerCreateParams) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	cfg := jetstream.ConsumerConfig{
		Name:          p.Name,
		Durable:       p.Durable,
		Description:   p.Description,
		MaxDeliver:    p.MaxDeliver,
		FilterSubject: p.FilterSubject,
	}

	if len(p.FilterSubjects) > 0 {
		cfg.FilterSubjects = p.FilterSubjects
	}

	if p.AckWaitSec > 0 {
		cfg.AckWait = time.Duration(p.AckWaitSec) * time.Second
	} else {
		cfg.AckWait = 30 * time.Second
	}

	switch p.DeliverPolicy {
	case "last":
		cfg.DeliverPolicy = jetstream.DeliverLastPolicy
	case "new":
		cfg.DeliverPolicy = jetstream.DeliverNewPolicy
	case "by_start_sequence":
		cfg.DeliverPolicy = jetstream.DeliverByStartSequencePolicy
		cfg.OptStartSeq = p.OptStartSeq
	default:
		cfg.DeliverPolicy = jetstream.DeliverAllPolicy
	}

	switch p.AckPolicy {
	case "none":
		cfg.AckPolicy = jetstream.AckNonePolicy
	case "all":
		cfg.AckPolicy = jetstream.AckAllPolicy
	default:
		cfg.AckPolicy = jetstream.AckExplicitPolicy
	}

	if p.ReplayPolicy == "original" {
		cfg.ReplayPolicy = jetstream.ReplayOriginalPolicy
	} else {
		cfg.ReplayPolicy = jetstream.ReplayInstantPolicy
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	stream, err := js.Stream(ctxTimeout, p.Stream)
	if err != nil {
		return err
	}

	_, err = stream.CreateOrUpdateConsumer(ctxTimeout, cfg)
	return err
}

func (m *NatsManager) DeleteConsumer(ctx context.Context, streamName string, consumerName string) error {
	js, err := m.getJetStream()
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	stream, err := js.Stream(ctxTimeout, streamName)
	if err != nil {
		return err
	}

	return stream.DeleteConsumer(ctxTimeout, consumerName)
}
