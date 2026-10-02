package rabbitmqmanager

import (
	"testing"

	rabbithole "github.com/michaelklishin/rabbit-hole/v3"
)

func TestMapQueueSummary(t *testing.T) {
	mgr := NewRabbitMQManager()

	q := rabbithole.QueueInfo{
		Name:                   "orders.dlq",
		Vhost:                  "ecommerce",
		Type:                   "quorum",
		Durable:                true,
		AutoDelete:             rabbithole.AutoDelete(false),
		Status:                 "running",
		Messages:               1542,
		MessagesReady:          1500,
		MessagesUnacknowledged: 42,
		Consumers:              3,
		Memory:                 1048576,
		Node:                   "rabbit@node-1",
		Arguments: map[string]interface{}{
			"x-queue-type":              "quorum",
			"x-dead-letter-exchange":    "orders.retry.dx",
			"x-dead-letter-routing-key": "orders.retry",
		},
		MessageStats: &rabbithole.MessageStats{
			PublishDetails:   rabbithole.RateDetails{Rate: 25.5},
			DeliverGetDetails: rabbithole.RateDetails{Rate: 24.0},
			AckDetails:        rabbithole.RateDetails{Rate: 23.8},
		},
	}

	summary := mgr.mapQueueSummary(q)

	if summary.Name != "orders.dlq" {
		t.Errorf("expected name 'orders.dlq', got %q", summary.Name)
	}
	if summary.Type != "quorum" {
		t.Errorf("expected type 'quorum', got %q", summary.Type)
	}
	if !summary.Durable {
		t.Errorf("expected durable=true")
	}
	if summary.AutoDelete {
		t.Errorf("expected autoDelete=false")
	}
	if summary.Messages != 1542 {
		t.Errorf("expected messages=1542, got %d", summary.Messages)
	}
	if !summary.HasDLX {
		t.Errorf("expected HasDLX=true")
	}
	if summary.DLXTarget != "orders.retry.dx" {
		t.Errorf("expected DLXTarget='orders.retry.dx', got %q", summary.DLXTarget)
	}
	if summary.DLXRoutingKey != "orders.retry" {
		t.Errorf("expected DLXRoutingKey='orders.retry', got %q", summary.DLXRoutingKey)
	}
	if summary.MessageRates.PublishRate != 25.5 {
		t.Errorf("expected PublishRate=25.5, got %f", summary.MessageRates.PublishRate)
	}
}
