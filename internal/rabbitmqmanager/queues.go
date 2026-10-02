package rabbitmqmanager

import (
	"context"
	"fmt"
	"strings"

	rabbithole "github.com/michaelklishin/rabbit-hole/v3"
	amqp "github.com/rabbitmq/amqp091-go"
)

// ListQueues retrieves all queues within the specified vhost
func (m *RabbitMQManager) ListQueues(ctx context.Context, vhost string) ([]RMQQueueSummary, error) {
	vhost = m.resolveVHost(vhost)

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		var queues []rabbithole.QueueInfo
		if vhost == "" || vhost == "*" {
			queues, err = httpCli.ListQueues()
		} else {
			queues, err = httpCli.ListQueuesIn(vhost)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to list queues in vhost %q: %w", vhost, err)
		}

		var summaries []RMQQueueSummary
		for _, q := range queues {
			summaries = append(summaries, m.mapQueueSummary(q))
		}
		return summaries, nil
	}

	// Fallback when Management API is not enabled: AMQP 0-9-1 cannot list unknown queues
	return nil, fmt.Errorf("listing queues requires the RabbitMQ Management HTTP Plugin (port 15672). Please enable rabbitmq_management on your server")
}

// GetQueueDetails retrieves detailed metrics, consumer info, and bindings for a queue
func (m *RabbitMQManager) GetQueueDetails(ctx context.Context, vhost string, queue string) (*RMQQueueDetail, error) {
	vhost = m.resolveVHost(vhost)
	queue = strings.TrimSpace(queue)
	if queue == "" {
		return nil, fmt.Errorf("queue name is required")
	}

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		qInfo, err := httpCli.GetQueue(vhost, queue)
		if err != nil {
			return nil, fmt.Errorf("failed to get queue details for %q: %w", queue, err)
		}

		summary := m.mapQueueSummary(rabbithole.QueueInfo(*qInfo))
		detail := &RMQQueueDetail{
			RMQQueueSummary: summary,
		}

		// Map active consumers if available
		if qInfo.ConsumerDetails != nil {
			for _, c := range *qInfo.ConsumerDetails {
				detail.ConsumersList = append(detail.ConsumersList, RMQConsumerInfo{
					ConsumerTag: c.ConsumerTag,
					ChannelPid:  c.ChannelDetails.Name,
					Prefetch:    int(c.PrefetchCount),
					AckRequired: c.AckRequired,
					Exclusive:   c.Exclusive,
					Active:      c.Active,
				})
			}
		}

		// Retrieve queue bindings
		bindings, err := httpCli.ListQueueBindings(vhost, queue)
		if err == nil {
			for _, b := range bindings {
				detail.Bindings = append(detail.Bindings, RMQBindingInfo{
					Source:          b.Source,
					VHost:           b.Vhost,
					Destination:     b.Destination,
					DestinationType: b.DestinationType,
					RoutingKey:      b.RoutingKey,
					Arguments:       b.Arguments,
					PropertiesKey:   b.PropertiesKey,
				})
			}
		}

		return detail, nil
	}

	// AMQP Fallback: Use passive declare to query message and consumer count
	amqpConn, err := m.GetAMQPConnection()
	if err != nil {
		return nil, err
	}

	ch, err := amqpConn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	q, err := ch.QueueDeclarePassive(queue, false, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("queue %q does not exist or channel error: %w", queue, err)
	}

	return &RMQQueueDetail{
		RMQQueueSummary: RMQQueueSummary{
			Name:      q.Name,
			VHost:     vhost,
			Type:      "classic",
			Messages:  int64(q.Messages),
			Consumers: q.Consumers,
			State:     "running",
		},
	}, nil
}

// CreateQueue declares a new queue with full parameterization
func (m *RabbitMQManager) CreateQueue(ctx context.Context, params CreateQueueParams) (*RMQQueueSummary, error) {
	vhost := m.resolveVHost(params.VHost)
	name := strings.TrimSpace(params.Name)
	if name == "" {
		return nil, fmt.Errorf("queue name is required")
	}

	qType := strings.ToLower(strings.TrimSpace(params.Type))
	if qType == "" {
		qType = "classic"
	}

	args := make(map[string]interface{})
	for k, v := range params.CustomArguments {
		args[k] = v
	}

	// Set queue type
	if qType != "classic" {
		args["x-queue-type"] = qType
	}

	// Quorum queues must be durable
	durable := params.Durable
	if qType == "quorum" {
		durable = true
	}

	if params.MessageTTL > 0 {
		args["x-message-ttl"] = params.MessageTTL
	}
	if params.AutoExpire > 0 {
		args["x-expires"] = params.AutoExpire
	}
	if params.MaxLength > 0 {
		args["x-max-length"] = params.MaxLength
	}
	if params.MaxLengthBytes > 0 {
		args["x-max-length-bytes"] = params.MaxLengthBytes
	}
	if params.MaxPriority > 0 && qType == "classic" {
		args["x-max-priority"] = params.MaxPriority
	}
	if params.DeadLetterExchange != "" {
		args["x-dead-letter-exchange"] = strings.TrimSpace(params.DeadLetterExchange)
	}
	if params.DeadLetterRoutingKey != "" {
		args["x-dead-letter-routing-key"] = strings.TrimSpace(params.DeadLetterRoutingKey)
	}
	if params.Overflow != "" {
		args["overflow"] = strings.TrimSpace(params.Overflow)
	}
	if params.DeliveryLimit > 0 && qType == "quorum" {
		args["x-delivery-limit"] = params.DeliveryLimit
	}

	// Try Management API first if available
	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		settings := rabbithole.QueueSettings{
			Type:       qType,
			Durable:    durable,
			AutoDelete: params.AutoDelete,
			Arguments:  args,
		}
		resp, err := httpCli.DeclareQueue(vhost, name, settings)
		if err != nil {
			return nil, fmt.Errorf("failed to declare queue via Management API: %w", err)
		}
		if resp != nil && resp.StatusCode >= 400 {
			return nil, fmt.Errorf("management API returned status %d declaring queue %s", resp.StatusCode, name)
		}
	} else {
		// Fallback to pure AMQP QueueDeclare
		amqpConn, err := m.GetAMQPConnection()
		if err != nil {
			return nil, err
		}

		ch, err := amqpConn.Channel()
		if err != nil {
			return nil, fmt.Errorf("failed to open AMQP channel: %w", err)
		}
		defer ch.Close()

		amqpTable := amqp.Table{}
		for k, v := range args {
			amqpTable[k] = v
		}

		_, err = ch.QueueDeclare(name, durable, params.AutoDelete, params.Exclusive, false, amqpTable)
		if err != nil {
			return nil, fmt.Errorf("failed to declare queue via AMQP: %w", err)
		}
	}

	// Return updated summary
	return &RMQQueueSummary{
		Name:          name,
		VHost:         vhost,
		Type:          qType,
		Durable:       durable,
		AutoDelete:    params.AutoDelete,
		Exclusive:     params.Exclusive,
		State:         "running",
		Arguments:     args,
		HasDLX:        params.DeadLetterExchange != "",
		DLXTarget:     params.DeadLetterExchange,
		DLXRoutingKey: params.DeadLetterRoutingKey,
	}, nil
}

// DeleteQueue deletes an existing queue
func (m *RabbitMQManager) DeleteQueue(ctx context.Context, vhost string, queue string, ifUnused bool, ifEmpty bool) error {
	vhost = m.resolveVHost(vhost)
	queue = strings.TrimSpace(queue)
	if queue == "" {
		return fmt.Errorf("queue name is required")
	}

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		_, err := httpCli.DeleteQueue(vhost, queue, rabbithole.QueueDeleteOptions{
			IfUnused: ifUnused,
			IfEmpty:  ifEmpty,
		})
		if err != nil {
			return fmt.Errorf("failed to delete queue %q via Management API: %w", queue, err)
		}
		return nil
	}

	// Fallback to pure AMQP
	amqpConn, err := m.GetAMQPConnection()
	if err != nil {
		return err
	}

	ch, err := amqpConn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	_, err = ch.QueueDelete(queue, ifUnused, ifEmpty, false)
	if err != nil {
		return fmt.Errorf("failed to delete queue %q via AMQP: %w", queue, err)
	}

	return nil
}

// PurgeQueue removes all messages ready for delivery from a queue
func (m *RabbitMQManager) PurgeQueue(ctx context.Context, vhost string, queue string) (int, error) {
	vhost = m.resolveVHost(vhost)
	queue = strings.TrimSpace(queue)
	if queue == "" {
		return 0, fmt.Errorf("queue name is required")
	}

	// Pure AMQP purge returns the purged message count directly
	amqpConn, err := m.GetAMQPConnection()
	if err == nil && amqpConn != nil {
		ch, err := amqpConn.Channel()
		if err == nil {
			defer ch.Close()
			count, err := ch.QueuePurge(queue, false)
			if err == nil {
				return count, nil
			}
		}
	}

	// Fallback to Management API
	httpCli, err := m.GetHTTPClient()
	if err != nil {
		return 0, err
	}

	_, err = httpCli.PurgeQueue(vhost, queue)
	if err != nil {
		return 0, fmt.Errorf("failed to purge queue %q: %w", queue, err)
	}

	return 0, nil
}

// mapQueueSummary translates rabbithole.QueueInfo to RMQQueueSummary
func (m *RabbitMQManager) mapQueueSummary(q rabbithole.QueueInfo) RMQQueueSummary {
	qType := q.Type
	if qType == "" {
		if t, ok := q.Arguments["x-queue-type"].(string); ok && t != "" {
			qType = t
		} else {
			qType = "classic"
		}
	}

	dlx, _ := q.Arguments["x-dead-letter-exchange"].(string)
	dlxKey, _ := q.Arguments["x-dead-letter-routing-key"].(string)

	autoDelete := bool(q.AutoDelete)

	var pubRate, delRate, ackRate float64
	if q.MessageStats != nil {
		pubRate = float64(q.MessageStats.PublishDetails.Rate)
		delRate = float64(q.MessageStats.DeliverGetDetails.Rate)
		ackRate = float64(q.MessageStats.AckDetails.Rate)
	}

	return RMQQueueSummary{
		Name:                   q.Name,
		VHost:                  q.Vhost,
		Type:                   qType,
		Durable:                q.Durable,
		AutoDelete:             autoDelete,
		Exclusive:              q.Exclusive,
		State:                  q.Status,
		Messages:               int64(q.Messages),
		MessagesReady:          int64(q.MessagesReady),
		MessagesUnacknowledged: int64(q.MessagesUnacknowledged),
		Consumers:              q.Consumers,
		Memory:                 q.Memory,
		LeaderNode:             q.Node,
		Arguments:              q.Arguments,
		HasDLX:                 dlx != "",
		DLXTarget:              dlx,
		DLXRoutingKey:          dlxKey,
		MessageRates: RMQMessageRates{
			PublishRate: pubRate,
			DeliverRate: delRate,
			AckRate:     ackRate,
		},
	}
}
