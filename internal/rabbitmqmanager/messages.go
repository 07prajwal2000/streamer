package rabbitmqmanager

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// PublishMessage sends an AMQP message with publisher confirms and custom attributes
func (m *RabbitMQManager) PublishMessage(ctx context.Context, params PublishRMQMessageParams) (*PublishRMQMessageResult, error) {
	conn, err := m.GetAMQPConnection()
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	// Enable Publisher Confirms if requested
	waitForConfirm := params.WaitForConfirm
	if waitForConfirm {
		if err := ch.Confirm(false); err != nil {
			return nil, fmt.Errorf("failed to put channel into confirm mode: %w", err)
		}
	}

	// Setup mandatory return listener
	var returnCh chan amqp.Return
	if params.Mandatory {
		returnCh = make(chan amqp.Return, 1)
		ch.NotifyReturn(returnCh)
	}

	// Prepare headers
	table := amqp.Table{}
	for k, v := range params.Headers {
		table[k] = v
	}

	msgID := params.MessageID
	if msgID == "" {
		msgID = fmt.Sprintf("rmq-%d", time.Now().UnixNano())
	}

	contentType := params.ContentType
	if contentType == "" {
		contentType = "application/json"
	}

	deliveryMode := params.DeliveryMode
	if deliveryMode == 0 {
		deliveryMode = amqp.Persistent // Default to persistent (2)
	}

	publishing := amqp.Publishing{
		Headers:         table,
		ContentType:     contentType,
		DeliveryMode:    deliveryMode,
		Priority:        params.Priority,
		CorrelationId:   params.CorrelationID,
		ReplyTo:         params.ReplyTo,
		Expiration:      params.Expiration,
		MessageId:       msgID,
		Timestamp:       time.Now().UTC(),
		Type:            params.Type,
		Body:            []byte(params.Payload),
	}

	now := time.Now().UnixMilli()

	// Publish with deferred confirmation
	if waitForConfirm {
		dc, err := ch.PublishWithDeferredConfirmWithContext(
			ctx,
			params.Exchange,
			params.RoutingKey,
			params.Mandatory,
			false, // immediate flag is deprecated in RabbitMQ 3.0+
			publishing,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to publish message: %w", err)
		}

		confirmed := false
		if dc != nil {
			confirmed = dc.Wait()
		}

		returned := false
		returnReason := ""
		if params.Mandatory {
			select {
			case ret, ok := <-returnCh:
				if ok {
					returned = true
					returnReason = fmt.Sprintf("NO_ROUTE (code %d: %s)", ret.ReplyCode, ret.ReplyText)
				}
			case <-time.After(50 * time.Millisecond):
				// No return received
			}
		}

		return &PublishRMQMessageResult{
			Success:      confirmed && !returned,
			Confirmed:    confirmed,
			Returned:     returned,
			ReturnReason: returnReason,
			MessageID:    msgID,
			Timestamp:    now,
		}, nil
	}

	// Standard publish without waiting for confirm
	err = ch.PublishWithContext(
		ctx,
		params.Exchange,
		params.RoutingKey,
		params.Mandatory,
		false,
		publishing,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to publish message: %w", err)
	}

	return &PublishRMQMessageResult{
		Success:   true,
		Confirmed: false,
		MessageID: msgID,
		Timestamp: now,
	}, nil
}

// mgtGetMessageResponse represents the JSON response item from POST /api/queues/{vhost}/{name}/get
type mgtGetMessageResponse struct {
	PayloadBytes    int                    `json:"payload_bytes"`
	Redelivered     bool                   `json:"redelivered"`
	Exchange        string                 `json:"exchange"`
	RoutingKey      string                 `json:"routing_key"`
	MessageCount    uint32                 `json:"message_count"`
	Properties      mgtMessageProperties   `json:"properties"`
	Payload         string                 `json:"payload"`
	PayloadEncoding string                 `json:"payload_encoding"`
}

type mgtMessageProperties struct {
	MessageID       string                 `json:"message_id,omitempty"`
	CorrelationID   string                 `json:"correlation_id,omitempty"`
	ContentType     string                 `json:"content_type,omitempty"`
	ContentEncoding string                 `json:"content_encoding,omitempty"`
	DeliveryMode    uint8                  `json:"delivery_mode,omitempty"`
	Priority        uint8                  `json:"priority,omitempty"`
	ReplyTo         string                 `json:"reply_to,omitempty"`
	Expiration      string                 `json:"expiration,omitempty"`
	Timestamp       int64                  `json:"timestamp,omitempty"`
	Type            string                 `json:"type,omitempty"`
	UserID          string                 `json:"user_id,omitempty"`
	AppID           string                 `json:"app_id,omitempty"`
	Headers         map[string]interface{} `json:"headers,omitempty"`
}

// escapeRMQPathSegment escapes URL path segments for RabbitMQ HTTP API, ensuring "/" is "%2F"
func escapeRMQPathSegment(segment string) string {
	s := strings.TrimSpace(segment)
	if s == "" || s == "/" {
		return "%2F"
	}
	escaped := url.PathEscape(s)
	return strings.ReplaceAll(escaped, "/", "%2F")
}

// PeekMessages retrieves messages from a queue non-destructively
func (m *RabbitMQManager) PeekMessages(ctx context.Context, params PeekRMQMessagesParams) ([]RMQMessage, error) {
	vhost := m.resolveVHost(params.VHost)
	queue := strings.TrimSpace(params.QueueName)
	if queue == "" {
		return nil, fmt.Errorf("queue name is required")
	}

	count := params.Count
	if count <= 0 {
		count = 10
	}
	if count > 100 {
		count = 100
	}

	ackMode := params.AckMode
	if ackMode == "" {
		ackMode = "ack_requeue_true" // Default to non-destructive inspection
	}

	encoding := params.Encoding
	if encoding == "" {
		encoding = "auto"
	}

	// 1. Try Management HTTP API first: This is the safest way to peek messages without altering queue order
	m.mu.RLock()
	mgtURL := m.managementURL
	p := m.profile
	rawHTTP := m.httpClient
	m.mu.RUnlock()

	if mgtURL != "" && p != nil && rawHTTP != nil {
		reqBody := map[string]interface{}{
			"count":    count,
			"ackmode":  ackMode,
			"encoding": encoding,
			"truncate": 500000,
		}
		bodyBytes, err := json.Marshal(reqBody)
		if err == nil {
			targetURL := fmt.Sprintf("%s/api/queues/%s/%s/get", mgtURL, escapeRMQPathSegment(vhost), escapeRMQPathSegment(queue))
			req, err := http.NewRequestWithContext(ctx, "POST", targetURL, bytes.NewReader(bodyBytes))
			if err == nil {
				req.Header.Set("Content-Type", "application/json")
				user := p.Username
				if user == "" {
					user = "guest"
				}
				pass := p.Password
				if pass == "" {
					pass = "guest"
				}
				req.SetBasicAuth(user, pass)

				resp, err := rawHTTP.Do(req)
				if err == nil && resp != nil {
					defer resp.Body.Close()
					if resp.StatusCode == http.StatusOK {
						data, readErr := io.ReadAll(resp.Body)
						if readErr == nil {
							var apiMsgs []mgtGetMessageResponse
							if json.Unmarshal(data, &apiMsgs) == nil {
								var results []RMQMessage
								for idx, item := range apiMsgs {
									ts := item.Properties.Timestamp
									if ts > 0 && ts < 100000000000 {
										ts = ts * 1000
									}

									results = append(results, RMQMessage{
										Payload:         item.Payload,
										PayloadBytes:    item.PayloadBytes,
										PayloadEncoding: item.PayloadEncoding,
										Exchange:        item.Exchange,
										RoutingKey:      item.RoutingKey,
										DeliveryTag:     uint64(idx + 1),
										Redelivered:     item.Redelivered,
										MessageCount:    item.MessageCount,
										ContentType:     item.Properties.ContentType,
										ContentEncoding: item.Properties.ContentEncoding,
										DeliveryMode:    item.Properties.DeliveryMode,
										Priority:        item.Properties.Priority,
										CorrelationID:   item.Properties.CorrelationID,
										ReplyTo:         item.Properties.ReplyTo,
										Expiration:      item.Properties.Expiration,
										MessageID:       item.Properties.MessageID,
										Timestamp:       ts,
										Type:            item.Properties.Type,
										UserID:          item.Properties.UserID,
										AppID:           item.Properties.AppID,
										Headers:         item.Properties.Headers,
										QueueName:       queue,
									})
								}
								return results, nil
							}
						}
					}
				}
			}
		}
	}

	// 2. Pure AMQP fallback: Basic.Get + Nack(requeue: true)
	amqpConn, err := m.GetAMQPConnection()
	if err != nil {
		return nil, err
	}

	ch, err := amqpConn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	var results []RMQMessage
	var deliveries []amqp.Delivery
	requeue := strings.Contains(ackMode, "requeue_true")

	// Read up to `count` messages into deliveries without acknowledging or nacking during the loop.
	// In AMQP, unacknowledged deliveries remain locked on this channel and will NOT be redelivered
	// to subsequent ch.Get calls, guaranteeing distinct messages from the queue.
	for i := 0; i < count; i++ {
		delivery, ok, err := ch.Get(queue, false)
		if err != nil || !ok {
			break
		}
		deliveries = append(deliveries, delivery)

		headers := make(map[string]interface{})
		for k, v := range delivery.Headers {
			headers[k] = v
		}

		var ts int64
		if !delivery.Timestamp.IsZero() {
			ts = delivery.Timestamp.UnixMilli()
		}

		results = append(results, RMQMessage{
			Payload:         string(delivery.Body),
			PayloadBytes:    len(delivery.Body),
			PayloadEncoding: "string",
			Exchange:        delivery.Exchange,
			RoutingKey:      delivery.RoutingKey,
			DeliveryTag:     delivery.DeliveryTag,
			Redelivered:     delivery.Redelivered,
			MessageCount:    delivery.MessageCount,
			ContentType:     delivery.ContentType,
			ContentEncoding: delivery.ContentEncoding,
			DeliveryMode:    delivery.DeliveryMode,
			Priority:        delivery.Priority,
			CorrelationID:   delivery.CorrelationId,
			ReplyTo:         delivery.ReplyTo,
			Expiration:      delivery.Expiration,
			MessageID:       delivery.MessageId,
			Timestamp:       ts,
			Type:            delivery.Type,
			UserID:          delivery.UserId,
			AppID:           delivery.AppId,
			Headers:         headers,
			QueueName:       queue,
		})
	}

	// Settle deliveries AFTER the batch loop completes so that every retrieved message is distinct.
	if requeue {
		// Non-destructive peek: return all messages back to queue
		for _, d := range deliveries {
			_ = d.Nack(false, true)
		}
	} else {
		// Destructive peek (consume): acknowledge removal
		for _, d := range deliveries {
			_ = d.Ack(false)
		}
	}

	return results, nil
}

// StartLiveConsume starts an asynchronous push consumer loop, streaming messages to Wails UI
func (m *RabbitMQManager) StartLiveConsume(params ConsumeRMQMessagesParams) error {
	m.StopLiveConsume()

	queue := strings.TrimSpace(params.QueueName)
	if queue == "" {
		return fmt.Errorf("queue name is required")
	}

	conn, err := m.GetAMQPConnection()
	if err != nil {
		return err
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open AMQP channel for live consume: %w", err)
	}

	// Apply prefetch QoS to prevent RAM exhaustion
	prefetch := params.PrefetchCount
	if prefetch <= 0 {
		prefetch = 50
	}
	if err := ch.Qos(prefetch, 0, false); err != nil {
		_ = ch.Close()
		return fmt.Errorf("failed to set consumer QoS: %w", err)
	}

	consumerTag := fmt.Sprintf("streamer-ui-%d", time.Now().UnixNano())

	deliveries, err := ch.Consume(
		queue,
		consumerTag,
		params.AutoAck,
		params.Exclusive,
		false,
		false,
		nil,
	)
	if err != nil {
		_ = ch.Close()
		return fmt.Errorf("failed to register AMQP consumer: %w", err)
	}

	doneCh := make(chan struct{})

	m.streamMu.Lock()
	m.streamCh = ch
	m.streamTag = consumerTag
	m.streamDone = doneCh
	m.streamMu.Unlock()

	go func() {
		defer close(doneCh)
		defer func() {
			_ = ch.Close()
		}()

		for d := range deliveries {
			headers := make(map[string]interface{})
			for k, v := range d.Headers {
				headers[k] = v
			}

			var ts int64
			if !d.Timestamp.IsZero() {
				ts = d.Timestamp.UnixMilli()
			}

			msg := RMQMessage{
				Payload:         string(d.Body),
				PayloadBytes:    len(d.Body),
				PayloadEncoding: "string",
				Exchange:        d.Exchange,
				RoutingKey:      d.RoutingKey,
				DeliveryTag:     d.DeliveryTag,
				Redelivered:     d.Redelivered,
				MessageCount:    d.MessageCount,
				ContentType:     d.ContentType,
				ContentEncoding: d.ContentEncoding,
				DeliveryMode:    d.DeliveryMode,
				Priority:        d.Priority,
				CorrelationID:   d.CorrelationId,
				ReplyTo:         d.ReplyTo,
				Expiration:      d.Expiration,
				MessageID:       d.MessageId,
				Timestamp:       ts,
				Type:            d.Type,
				UserID:          d.UserId,
				AppID:           d.AppId,
				Headers:         headers,
				QueueName:       queue,
			}

			if m.ctx != nil {
				runtime.EventsEmit(m.ctx, "rabbitmq:message", msg)
			}

			// If not auto-ack, ack automatically on reception for the live stream monitor
			if !params.AutoAck {
				_ = d.Ack(false)
			}
		}
	}()

	return nil
}

// StopLiveConsume halts active consumer streaming safely
func (m *RabbitMQManager) StopLiveConsume() {
	m.streamMu.Lock()
	ch := m.streamCh
	tag := m.streamTag
	doneCh := m.streamDone
	m.streamCh = nil
	m.streamTag = ""
	m.streamDone = nil
	m.streamMu.Unlock()

	if ch == nil {
		return
	}

	// Cancel consumer on the broker first so no new messages arrive
	if tag != "" {
		_ = ch.Cancel(tag, false)
	}
	// Close the channel, which cleanly closes the deliveries channel
	_ = ch.Close()

	if doneCh != nil {
		select {
		case <-doneCh:
		case <-time.After(1 * time.Second):
		}
	}
}

// RedriveDLQ moves dead-letter messages from a DLQ back to their original target destination
func (m *RabbitMQManager) RedriveDLQ(ctx context.Context, params RedriveDLQParams) (*RedriveDLQResult, error) {
	srcQueue := strings.TrimSpace(params.SourceQueue)
	if srcQueue == "" {
		return nil, fmt.Errorf("source dead letter queue name is required")
	}

	maxMsgs := params.MaxMessages
	if maxMsgs <= 0 {
		maxMsgs = 50
	}

	conn, err := m.GetAMQPConnection()
	if err != nil {
		return nil, err
	}

	// Open read channel for DLQ
	readCh, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open DLQ read channel: %w", err)
	}
	defer readCh.Close()

	// Open write channel with publisher confirms
	pubCh, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open publisher channel: %w", err)
	}
	defer pubCh.Close()

	if err := pubCh.Confirm(false); err != nil {
		return nil, fmt.Errorf("failed to enable publisher confirms: %w", err)
	}

	result := &RedriveDLQResult{
		MovedCount:  0,
		FailedCount: 0,
	}

	for i := 0; i < maxMsgs; i++ {
		select {
		case <-ctx.Done():
			result.Errors = append(result.Errors, "operation timed out or was cancelled")
			return result, nil
		default:
		}

		delivery, ok, err := readCh.Get(srcQueue, false)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("error reading from DLQ: %v", err))
			break
		}
		if !ok {
			// No more messages in DLQ
			break
		}

		// Determine target exchange and routing key
		targetExchange := strings.TrimSpace(params.TargetExchange)
		targetRoutingKey := strings.TrimSpace(params.TargetRoutingKey)

		// If target exchange or routing key are not specified, extract them from x-death header
		if targetExchange == "" || targetRoutingKey == "" {
			if xDeathRaw, exists := delivery.Headers["x-death"]; exists {
				if xDeathList, ok := xDeathRaw.([]interface{}); ok && len(xDeathList) > 0 {
					if firstDeath, ok := xDeathList[0].(map[string]interface{}); ok {
						if targetExchange == "" {
							if origEx, ok := firstDeath["exchange"].(string); ok {
								targetExchange = origEx
							}
						}
						if targetRoutingKey == "" {
							if rkList, ok := firstDeath["routing-keys"].([]interface{}); ok && len(rkList) > 0 {
								if rk, ok := rkList[0].(string); ok {
									targetRoutingKey = rk
								}
							}
						}
					}
				}
			}
		}

		// Fallback to queue name routing key if still empty
		if targetRoutingKey == "" {
			targetRoutingKey = srcQueue
		}

		// Re-publish message
		pub := amqp.Publishing{
			Headers:         delivery.Headers,
			ContentType:     delivery.ContentType,
			ContentEncoding: delivery.ContentEncoding,
			DeliveryMode:    delivery.DeliveryMode,
			Priority:        delivery.Priority,
			CorrelationId:   delivery.CorrelationId,
			ReplyTo:         delivery.ReplyTo,
			Expiration:      delivery.Expiration,
			MessageId:       delivery.MessageId,
			Timestamp:       time.Now().UTC(),
			Type:            delivery.Type,
			Body:            delivery.Body,
		}

		dc, err := pubCh.PublishWithDeferredConfirmWithContext(
			ctx,
			targetExchange,
			targetRoutingKey,
			false,
			false,
			pub,
		)

		if err != nil || dc == nil || !dc.Wait() {
			result.FailedCount++
			_ = delivery.Nack(false, true) // Put back in DLQ on failure
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to re-publish message %s: %v", delivery.MessageId, err))
			} else {
				result.Errors = append(result.Errors, fmt.Sprintf("message %s was NACKed by broker", delivery.MessageId))
			}
			continue
		}

		// Successfully republished: acknowledge removal from DLQ
		_ = delivery.Ack(false)
		result.MovedCount++
	}

	return result, nil
}
