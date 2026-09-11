package kafkamanager

import (
	"context"
	"testing"
)

func TestGetKafkaMessagesValidation(t *testing.T) {
	km := NewKafkaManager()
	ctx := context.Background()

	// 1. Empty topic
	_, err := km.GetKafkaMessages(ctx, GetKafkaMessagesParams{
		Topic: "",
	})
	if err == nil {
		t.Errorf("expected error for empty topic, got nil")
	}

	// 2. Invalid strategy
	_, err = km.GetKafkaMessages(ctx, GetKafkaMessagesParams{
		Topic:    "test-topic",
		Strategy: "invalid-strategy",
	})
	if err == nil {
		t.Errorf("expected error for invalid strategy, got nil")
	}

	// 3. Not connected
	_, err = km.GetKafkaMessages(ctx, GetKafkaMessagesParams{
		Topic:    "test-topic",
		Strategy: "latest",
	})
	if err == nil {
		t.Errorf("expected error when not connected, got nil")
	}
}

func TestProduceKafkaRecordValidation(t *testing.T) {
	km := NewKafkaManager()
	ctx := context.Background()

	// 1. Empty topic
	_, err := km.ProduceKafkaRecord(ctx, ProduceKafkaRecordParams{
		Topic:   "",
		Payload: "hello",
	})
	if err == nil {
		t.Errorf("expected error for empty topic, got nil")
	}

	// 2. Not connected
	_, err = km.ProduceKafkaRecord(ctx, ProduceKafkaRecordParams{
		Topic:   "test-topic",
		Payload: "hello",
	})
	if err == nil {
		t.Errorf("expected error when not connected, got nil")
	}
}
