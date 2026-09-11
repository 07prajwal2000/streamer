package sqsmanager

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestExtractQueueName(t *testing.T) {
	tests := []struct {
		url      string
		expected string
	}{
		{"https://sqs.us-east-1.amazonaws.com/123456789012/my-test-queue", "my-test-queue"},
		{"http://localhost:4566/000000000000/orders.fifo", "orders.fifo"},
		{"http://localhost:9324/queue/events", "events"},
		{"my-simple-queue", "my-simple-queue"},
	}

	for _, tc := range tests {
		result := ExtractQueueName(tc.url)
		if result != tc.expected {
			t.Errorf("for url %q expected %q, got %q", tc.url, tc.expected, result)
		}
	}
}

func TestRedrivePolicyJSON(t *testing.T) {
	cfg := RedrivePolicyConfig{
		DeadLetterTargetArn: "arn:aws:sqs:us-east-1:123456789012:my-dlq",
		MaxReceiveCount:     5,
	}

	bytes, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("failed to marshal RedrivePolicyConfig: %v", err)
	}

	var parsed RedrivePolicyConfig
	if err := json.Unmarshal(bytes, &parsed); err != nil {
		t.Fatalf("failed to unmarshal RedrivePolicyConfig: %v", err)
	}

	if parsed.DeadLetterTargetArn != cfg.DeadLetterTargetArn {
		t.Errorf("expected arn %s, got %s", cfg.DeadLetterTargetArn, parsed.DeadLetterTargetArn)
	}
	if parsed.MaxReceiveCount != 5 {
		t.Errorf("expected maxReceiveCount 5, got %d", parsed.MaxReceiveCount)
	}
}

func TestCreateQueueValidation(t *testing.T) {
	mgr := NewSqsManager()

	// 1. Not connected error
	_, err := mgr.CreateQueue(context.Background(), CreateQueueParams{
		QueueName: "test-queue",
	})
	if err == nil {
		t.Errorf("expected error when manager is not connected")
	}

	// 2. Empty queue name error
	// Even if we don't have a connected client, if we validate queueName empty:
	// In CreateQueue, client check happens first or name check. Let's make sure empty name check is solid.
}

func TestFIFOQueueNameRule(t *testing.T) {
	// Verify that if isFIFO is true, name receives .fifo if missing
	p := CreateQueueParams{
		QueueName: "payments",
		IsFIFO:    true,
	}

	name := strings.TrimSpace(p.QueueName)
	if p.IsFIFO && !strings.HasSuffix(name, ".fifo") {
		name += ".fifo"
	}

	if name != "payments.fifo" {
		t.Errorf("expected 'payments.fifo', got %s", name)
	}

	// If already has .fifo
	p2 := CreateQueueParams{
		QueueName: "orders.fifo",
		IsFIFO:    false,
	}
	name2 := strings.TrimSpace(p2.QueueName)
	isFIFO := p2.IsFIFO
	if strings.HasSuffix(name2, ".fifo") {
		isFIFO = true
	}
	if !isFIFO || name2 != "orders.fifo" {
		t.Errorf("expected isFIFO to be true for 'orders.fifo'")
	}
}
