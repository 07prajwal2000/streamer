package rabbitmqmanager

import (
	"context"
	"fmt"
	"strings"

	rabbithole "github.com/michaelklishin/rabbit-hole/v3"
	amqp "github.com/rabbitmq/amqp091-go"
)

// ListExchanges retrieves all exchanges within the specified virtual host
func (m *RabbitMQManager) ListExchanges(ctx context.Context, vhost string) ([]RMQExchangeSummary, error) {
	vhost = m.resolveVHost(vhost)

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		var exchanges []rabbithole.ExchangeInfo
		if vhost == "" || vhost == "*" {
			exchanges, err = httpCli.ListExchanges()
		} else {
			exchanges, err = httpCli.ListExchangesIn(vhost)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to list exchanges in vhost %q: %w", vhost, err)
		}

		var summaries []RMQExchangeSummary
		for _, e := range exchanges {
			summaries = append(summaries, m.mapExchangeSummary(e))
		}
		return summaries, nil
	}

	return nil, fmt.Errorf("listing exchanges requires the RabbitMQ Management HTTP Plugin (port 15672)")
}

// GetExchangeDetails retrieves details and associated bindings for an exchange
func (m *RabbitMQManager) GetExchangeDetails(ctx context.Context, vhost string, exchange string) (*RMQExchangeDetail, error) {
	vhost = m.resolveVHost(vhost)
	exchange = strings.TrimSpace(exchange)

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		eInfo, err := httpCli.GetExchange(vhost, exchange)
		if err != nil {
			return nil, fmt.Errorf("failed to get exchange %q: %w", exchange, err)
		}

		summary := m.mapDetailedExchangeSummary(*eInfo)
		detail := &RMQExchangeDetail{
			RMQExchangeSummary: summary,
		}

		// Retrieve all bindings for this vhost to find incoming/outgoing bindings
		bindings, err := httpCli.ListBindingsIn(vhost)
		if err == nil {
			for _, b := range bindings {
				bInfo := RMQBindingInfo{
					Source:          b.Source,
					VHost:           b.Vhost,
					Destination:     b.Destination,
					DestinationType: b.DestinationType,
					RoutingKey:      b.RoutingKey,
					Arguments:       b.Arguments,
					PropertiesKey:   b.PropertiesKey,
				}

				if b.Source == exchange {
					detail.BindingsSource = append(detail.BindingsSource, bInfo)
				}
				if b.DestinationType == "exchange" && b.Destination == exchange {
					detail.BindingsDestination = append(detail.BindingsDestination, bInfo)
				}
			}
		}

		return detail, nil
	}

	// Pure AMQP Fallback probe
	amqpConn, err := m.GetAMQPConnection()
	if err != nil {
		return nil, err
	}

	ch, err := amqpConn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	err = ch.ExchangeDeclarePassive(exchange, "direct", false, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("exchange %q does not exist or channel error: %w", exchange, err)
	}

	return &RMQExchangeDetail{
		RMQExchangeSummary: RMQExchangeSummary{
			Name:  exchange,
			VHost: vhost,
		},
	}, nil
}

// CreateExchange declares an exchange with the specified type and parameters
func (m *RabbitMQManager) CreateExchange(ctx context.Context, params CreateExchangeParams) (*RMQExchangeSummary, error) {
	vhost := m.resolveVHost(params.VHost)
	name := strings.TrimSpace(params.Name)
	if name == "" {
		return nil, fmt.Errorf("exchange name is required")
	}

	kind := strings.ToLower(strings.TrimSpace(params.Type))
	if kind == "" {
		kind = "direct"
	}

	args := make(map[string]interface{})
	for k, v := range params.CustomArguments {
		args[k] = v
	}

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		settings := rabbithole.ExchangeSettings{
			Type:       kind,
			Durable:    params.Durable,
			AutoDelete: params.AutoDelete,
			Arguments:  args,
		}
		resp, err := httpCli.DeclareExchange(vhost, name, settings)
		if err != nil {
			return nil, fmt.Errorf("failed to declare exchange via Management API: %w", err)
		}
		if resp != nil && resp.StatusCode >= 400 {
			return nil, fmt.Errorf("management API returned status %d declaring exchange %s", resp.StatusCode, name)
		}
	} else {
		// Pure AMQP fallback
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

		err = ch.ExchangeDeclare(name, kind, params.Durable, params.AutoDelete, params.Internal, false, amqpTable)
		if err != nil {
			return nil, fmt.Errorf("failed to declare exchange via AMQP: %w", err)
		}
	}

	return &RMQExchangeSummary{
		Name:       name,
		VHost:      vhost,
		Type:       kind,
		Durable:    params.Durable,
		AutoDelete: params.AutoDelete,
		Internal:   params.Internal,
		Arguments:  args,
	}, nil
}

// DeleteExchange deletes an existing exchange
func (m *RabbitMQManager) DeleteExchange(ctx context.Context, vhost string, exchange string, ifUnused bool) error {
	vhost = m.resolveVHost(vhost)
	exchange = strings.TrimSpace(exchange)
	if exchange == "" {
		return fmt.Errorf("exchange name is required")
	}

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		_, err := httpCli.DeleteExchange(vhost, exchange)
		if err != nil {
			return fmt.Errorf("failed to delete exchange %q via Management API: %w", exchange, err)
		}
		return nil
	}

	// Pure AMQP fallback
	amqpConn, err := m.GetAMQPConnection()
	if err != nil {
		return err
	}

	ch, err := amqpConn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	err = ch.ExchangeDelete(exchange, ifUnused, false)
	if err != nil {
		return fmt.Errorf("failed to delete exchange %q via AMQP: %w", exchange, err)
	}

	return nil
}

// ListBindings retrieves all bindings within the specified virtual host
func (m *RabbitMQManager) ListBindings(ctx context.Context, vhost string) ([]RMQBindingInfo, error) {
	vhost = m.resolveVHost(vhost)

	httpCli, err := m.GetHTTPClient()
	if err != nil {
		return nil, fmt.Errorf("listing bindings requires the RabbitMQ Management HTTP Plugin")
	}

	bindings, err := httpCli.ListBindingsIn(vhost)
	if err != nil {
		return nil, fmt.Errorf("failed to list bindings in vhost %q: %w", vhost, err)
	}

	var results []RMQBindingInfo
	for _, b := range bindings {
		results = append(results, RMQBindingInfo{
			Source:          b.Source,
			VHost:           b.Vhost,
			Destination:     b.Destination,
			DestinationType: b.DestinationType,
			RoutingKey:      b.RoutingKey,
			Arguments:       b.Arguments,
			PropertiesKey:   b.PropertiesKey,
		})
	}

	return results, nil
}

// CreateBinding establishes a new binding between an exchange and a queue or exchange
func (m *RabbitMQManager) CreateBinding(ctx context.Context, params CreateBindingParams) error {
	vhost := m.resolveVHost(params.VHost)
	source := strings.TrimSpace(params.Source)
	dest := strings.TrimSpace(params.Destination)
	destType := strings.ToLower(strings.TrimSpace(params.DestinationType))
	if destType == "" {
		destType = "queue"
	}

	if source == "" {
		return fmt.Errorf("source exchange is required")
	}
	if dest == "" {
		return fmt.Errorf("destination is required")
	}

	args := params.Arguments
	if args == nil {
		args = make(map[string]interface{})
	}

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		bInfo := rabbithole.BindingInfo{
			Source:          source,
			Vhost:           vhost,
			Destination:     dest,
			DestinationType: destType,
			RoutingKey:      params.RoutingKey,
			Arguments:       args,
		}
		_, err := httpCli.DeclareBinding(vhost, bInfo)
		if err != nil {
			return fmt.Errorf("failed to declare binding via Management API: %w", err)
		}
		return nil
	}

	// Pure AMQP fallback
	amqpConn, err := m.GetAMQPConnection()
	if err != nil {
		return err
	}

	ch, err := amqpConn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	amqpTable := amqp.Table{}
	for k, v := range args {
		amqpTable[k] = v
	}

	if destType == "queue" {
		err = ch.QueueBind(dest, params.RoutingKey, source, false, amqpTable)
	} else {
		err = ch.ExchangeBind(dest, params.RoutingKey, source, false, amqpTable)
	}
	if err != nil {
		return fmt.Errorf("failed to bind via AMQP: %w", err)
	}

	return nil
}

// DeleteBinding removes a binding between an exchange and a queue or exchange
func (m *RabbitMQManager) DeleteBinding(ctx context.Context, params CreateBindingParams) error {
	vhost := m.resolveVHost(params.VHost)
	source := strings.TrimSpace(params.Source)
	dest := strings.TrimSpace(params.Destination)
	destType := strings.ToLower(strings.TrimSpace(params.DestinationType))
	if destType == "" {
		destType = "queue"
	}

	args := params.Arguments
	if args == nil {
		args = make(map[string]interface{})
	}

	httpCli, err := m.GetHTTPClient()
	if err == nil && httpCli != nil {
		bInfo := rabbithole.BindingInfo{
			Source:          source,
			Vhost:           vhost,
			Destination:     dest,
			DestinationType: destType,
			RoutingKey:      params.RoutingKey,
			Arguments:       args,
		}
		_, err := httpCli.DeleteBinding(vhost, bInfo)
		if err != nil {
			return fmt.Errorf("failed to delete binding via Management API: %w", err)
		}
		return nil
	}

	// Pure AMQP fallback
	amqpConn, err := m.GetAMQPConnection()
	if err != nil {
		return err
	}

	ch, err := amqpConn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open AMQP channel: %w", err)
	}
	defer ch.Close()

	amqpTable := amqp.Table{}
	for k, v := range args {
		amqpTable[k] = v
	}

	if destType == "queue" {
		err = ch.QueueUnbind(dest, params.RoutingKey, source, amqpTable)
	} else {
		err = ch.ExchangeUnbind(dest, params.RoutingKey, source, false, amqpTable)
	}
	if err != nil {
		return fmt.Errorf("failed to unbind via AMQP: %w", err)
	}

	return nil
}

// mapExchangeSummary maps rabbithole.ExchangeInfo to RMQExchangeSummary
func (m *RabbitMQManager) mapExchangeSummary(e rabbithole.ExchangeInfo) RMQExchangeSummary {
	var pubInRate, pubOutRate float64
	if e.MessageStats != nil {
		if e.MessageStats.PublishInDetails != nil {
			pubInRate = float64(e.MessageStats.PublishInDetails.Rate)
		}
		if e.MessageStats.PublishOutDetails != nil {
			pubOutRate = float64(e.MessageStats.PublishOutDetails.Rate)
		}
	}

	autoDelete := bool(e.AutoDelete)

	return RMQExchangeSummary{
		Name:       e.Name,
		VHost:      e.Vhost,
		Type:       e.Type,
		Durable:    e.Durable,
		AutoDelete: autoDelete,
		Internal:   e.Internal,
		Arguments:  e.Arguments,
		MessageRates: RMQMessageRates{
			PublishRate: pubInRate,
			DeliverRate: pubOutRate,
		},
	}
}

// mapDetailedExchangeSummary maps rabbithole.DetailedExchangeInfo to RMQExchangeSummary
func (m *RabbitMQManager) mapDetailedExchangeSummary(e rabbithole.DetailedExchangeInfo) RMQExchangeSummary {
	var pubInRate, pubOutRate float64
	if e.PublishStats.PublishInDetails != nil {
		pubInRate = float64(e.PublishStats.PublishInDetails.Rate)
	}
	if e.PublishStats.PublishOutDetails != nil {
		pubOutRate = float64(e.PublishStats.PublishOutDetails.Rate)
	}

	return RMQExchangeSummary{
		Name:       e.Name,
		VHost:      e.Vhost,
		Type:       e.Type,
		Durable:    e.Durable,
		AutoDelete: e.AutoDelete,
		Internal:   e.Internal,
		Arguments:  e.Arguments,
		MessageRates: RMQMessageRates{
			PublishRate: pubInRate,
			DeliverRate: pubOutRate,
		},
	}
}
