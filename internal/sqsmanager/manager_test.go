package sqsmanager

import (
	"testing"

	"streamer/internal/storage"
)

func TestNewSqsManager(t *testing.T) {
	mgr := NewSqsManager()
	if mgr == nil {
		t.Fatalf("expected non-nil SqsManager")
	}

	status := mgr.GetStatus()
	if status.Connected {
		t.Errorf("expected disconnected initially")
	}
	if status.Protocol != "sqs" {
		t.Errorf("expected protocol sqs, got %s", status.Protocol)
	}
}

func TestResolveQueueURL(t *testing.T) {
	mgr := NewSqsManager()

	// Case 1: Standard AWS SQS (empty custom endpoint URL)
	mgr.profile = &storage.ConnectionProfile{
		URL: "",
	}
	rawAWS := "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
	if resolved := mgr.ResolveQueueURL(rawAWS); resolved != rawAWS {
		t.Errorf("expected %s, got %s", rawAWS, resolved)
	}

	// Case 2: LocalStack with Docker hostname rewrite
	mgr.profile = &storage.ConnectionProfile{
		URL: "http://localhost:4566",
	}
	dockerQueueURL := "http://localstack:4566/000000000000/my-queue"
	expectedResolved := "http://localhost:4566/000000000000/my-queue"
	if resolved := mgr.ResolveQueueURL(dockerQueueURL); resolved != expectedResolved {
		t.Errorf("expected %s, got %s", expectedResolved, resolved)
	}

	// Case 3: ElasticMQ with 127.0.0.1 rewrite
	mgr.profile = &storage.ConnectionProfile{
		URL: "http://127.0.0.1:9324",
	}
	emqQueueURL := "http://localhost:9324/queue/my-queue"
	expectedEMQ := "http://127.0.0.1:9324/queue/my-queue"
	if resolved := mgr.ResolveQueueURL(emqQueueURL); resolved != expectedEMQ {
		t.Errorf("expected %s, got %s", expectedEMQ, resolved)
	}
}

func TestBuildClientDummyAuth(t *testing.T) {
	mgr := NewSqsManager()

	p := &storage.ConnectionProfile{
		ID:        "test-profile",
		Protocol:  "sqs",
		URL:       "http://localhost:4566",
		AuthType:  "none",
		AWSRegion: "us-east-1",
	}

	client, display, err := mgr.buildClient(p)
	if err != nil {
		t.Fatalf("expected buildClient to succeed for dummy auth: %v", err)
	}
	if client == nil {
		t.Fatalf("expected non-nil client")
	}
	if display != "http://localhost:4566" {
		t.Errorf("expected endpoint display 'http://localhost:4566', got %s", display)
	}
}

func TestBuildClientStaticAuthValidation(t *testing.T) {
	mgr := NewSqsManager()

	// Missing credentials
	p := &storage.ConnectionProfile{
		ID:        "test-profile",
		Protocol:  "sqs",
		AuthType:  "static",
		AWSRegion: "us-east-1",
	}

	_, _, err := mgr.buildClient(p)
	if err == nil {
		t.Errorf("expected error when static credentials are empty")
	}

	// With credentials
	p.Username = "AKIAEXAMPLE"
	p.Password = "SECRETKEYEXAMPLE"
	client, display, err := mgr.buildClient(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client == nil {
		t.Fatalf("expected non-nil client")
	}
	if display != "AWS Cloud (us-east-1)" {
		t.Errorf("expected AWS Cloud (us-east-1), got %s", display)
	}
}
