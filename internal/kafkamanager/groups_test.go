package kafkamanager

import (
	"context"
	"testing"
)

func TestResetOffsetsValidation(t *testing.T) {
	km := NewKafkaManager()

	ctx := context.Background()

	// 1. Empty group
	err := km.ResetConsumerGroupOffsets(ctx, ResetOffsetsParams{
		Group:    "",
		Strategy: "earliest",
	})
	if err == nil {
		t.Errorf("expected error for empty group name, got nil")
	}

	// 2. Invalid strategy
	err = km.ResetConsumerGroupOffsets(ctx, ResetOffsetsParams{
		Group:    "my-group",
		Strategy: "invalid-strat",
	})
	if err == nil {
		t.Errorf("expected error for invalid strategy, got nil")
	}

	// 3. Timestamp strategy with invalid timestamp
	err = km.ResetConsumerGroupOffsets(ctx, ResetOffsetsParams{
		Group:     "my-group",
		Strategy:  "timestamp",
		Timestamp: 0,
	})
	if err == nil {
		t.Errorf("expected error for zero timestamp, got nil")
	}

	// 4. Offset strategy with negative offset
	err = km.ResetConsumerGroupOffsets(ctx, ResetOffsetsParams{
		Group:    "my-group",
		Strategy: "offset",
		Offset:   -5,
	})
	if err == nil {
		t.Errorf("expected error for negative offset, got nil")
	}
}

func TestDeleteGroupValidation(t *testing.T) {
	km := NewKafkaManager()
	ctx := context.Background()

	err := km.DeleteConsumerGroup(ctx, "   ")
	if err == nil {
		t.Errorf("expected error for whitespace group name, got nil")
	}
}
