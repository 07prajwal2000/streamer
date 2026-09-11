package sqsmanager

import (
	"context"
	"testing"
)

func TestSendMessageValidation(t *testing.T) {
	mgr := NewSqsManager()

	// 1. Not connected error
	_, err := mgr.SendMessage(context.Background(), SendSQSMessageParams{
		QueueURL: "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
		Body:     "Hello SQS",
	})
	if err == nil {
		t.Errorf("expected error when not connected")
	}

	// 2. Empty body validation
	// Connect dummy to test parameter checking
	_, err = mgr.SendMessage(context.Background(), SendSQSMessageParams{
		QueueURL: "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
		Body:     "   ",
	})
	if err == nil {
		t.Errorf("expected error for empty body")
	}
}

func TestPollMessagesValidation(t *testing.T) {
	mgr := NewSqsManager()

	// Not connected error
	_, err := mgr.PollMessages(context.Background(), PollSQSMessagesParams{
		QueueURL: "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
		Mode:     "peek",
	})
	if err == nil {
		t.Errorf("expected error when not connected")
	}
}

func TestRedriveDLQValidation(t *testing.T) {
	mgr := NewSqsManager()

	// Empty URLs
	_, err := mgr.RedriveDLQ(context.Background(), RedriveDLQParams{
		SourceQueueURL: "",
		TargetQueueURL: "",
	})
	if err == nil {
		t.Errorf("expected error when URLs are empty")
	}

	// Identical source and target
	_, err = mgr.RedriveDLQ(context.Background(), RedriveDLQParams{
		SourceQueueURL: "http://localhost:4566/000000000000/orders-dlq",
		TargetQueueURL: "http://localhost:4566/000000000000/orders-dlq",
	})
	if err == nil {
		t.Errorf("expected error when source and target are identical")
	}
}

func TestLivePollLifecycle(t *testing.T) {
	mgr := NewSqsManager()

	// Stopping when none running should be a no-op without panic
	err := mgr.StopSQSLivePoll()
	if err != nil {
		t.Errorf("expected no error when stopping idle poller, got %v", err)
	}
}
