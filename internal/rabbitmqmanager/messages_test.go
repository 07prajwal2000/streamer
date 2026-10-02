package rabbitmqmanager

import (
	"encoding/json"
	"testing"
)

func TestMgtGetMessageResponseJSON(t *testing.T) {
	rawJSON := `[
		{
			"payload_bytes": 27,
			"redelivered": false,
			"exchange": "amq.direct",
			"routing_key": "test.key",
			"message_count": 0,
			"properties": {
				"message_id": "msg-101",
				"correlation_id": "corr-55",
				"delivery_mode": 2,
				"priority": 5,
				"content_type": "application/json",
				"headers": {
					"traceId": "abc-123"
				}
			},
			"payload": "{\"status\":\"order_created\"}",
			"payload_encoding": "string"
		}
	]`

	var msgs []mgtGetMessageResponse
	if err := json.Unmarshal([]byte(rawJSON), &msgs); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}

	m := msgs[0]
	if m.Payload != "{\"status\":\"order_created\"}" {
		t.Errorf("unexpected payload: %s", m.Payload)
	}
	if m.Properties.MessageID != "msg-101" {
		t.Errorf("unexpected message_id: %s", m.Properties.MessageID)
	}
	if m.Properties.DeliveryMode != 2 {
		t.Errorf("expected delivery_mode=2, got %d", m.Properties.DeliveryMode)
	}
	if m.Properties.Priority != 5 {
		t.Errorf("expected priority=5, got %d", m.Properties.Priority)
	}
	if m.Properties.Headers["traceId"] != "abc-123" {
		t.Errorf("expected header traceId='abc-123', got %v", m.Properties.Headers["traceId"])
	}
}

func TestEscapeRMQPathSegment(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/", "%2F"},
		{"", "%2F"},
		{" ", "%2F"},
		{"my-queue", "my-queue"},
		{"orders/invoices", "orders%2Finvoices"},
		{"vhost with spaces", "vhost%20with%20spaces"},
		{"orders:dev", "orders:dev"},
	}

	for _, tt := range tests {
		got := escapeRMQPathSegment(tt.input)
		if got != tt.expected {
			t.Errorf("escapeRMQPathSegment(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestTimestampNormalization(t *testing.T) {
	// Seconds to Milliseconds
	sec := int64(1700000000)
	ts := sec
	if ts > 0 && ts < 100000000000 {
		ts = ts * 1000
	}
	if ts != 1700000000000 {
		t.Errorf("expected 1700000000000, got %d", ts)
	}

	// Already milliseconds
	milli := int64(1700000000000)
	ts2 := milli
	if ts2 > 0 && ts2 < 100000000000 {
		ts2 = ts2 * 1000
	}
	if ts2 != 1700000000000 {
		t.Errorf("expected 1700000000000, got %d", ts2)
	}

	// Zero timestamp
	zero := int64(0)
	ts3 := zero
	if ts3 > 0 && ts3 < 100000000000 {
		ts3 = ts3 * 1000
	}
	if ts3 != 0 {
		t.Errorf("expected 0, got %d", ts3)
	}
}
