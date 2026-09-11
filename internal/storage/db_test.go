package storage

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func TestStorageProtocols(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "streamer_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	defer db.Close()

	s := &Storage{db: db}
	if err := s.initSchema(); err != nil {
		t.Fatalf("failed to init schema: %v", err)
	}

	// 1. Save NATS Profile
	natsProf := ConnectionProfile{
		ID:         "nats-1",
		Protocol:   "nats",
		Name:       "Test NATS",
		URL:        "nats://localhost:4222",
		AuthType:   "none",
		ClientName: "StreamerNATS",
	}
	if err := s.SaveConnection(natsProf); err != nil {
		t.Fatalf("failed to save NATS profile: %v", err)
	}

	// 2. Save Kafka Profile
	kafkaProf := ConnectionProfile{
		ID:          "kafka-1",
		Protocol:    "kafka",
		Name:        "Test Kafka",
		URL:         "localhost:9092,localhost:9093",
		AuthType:    "scram256",
		Username:    "alice",
		Password:    "secret",
		TLSSNI:      "kafka.internal",
		TLSInsecure: true,
		ClientName:  "StreamerKafka",
	}
	if err := s.SaveConnection(kafkaProf); err != nil {
		t.Fatalf("failed to save Kafka profile: %v", err)
	}

	// 3. Query All Connections
	conns, err := s.GetAllConnections()
	if err != nil {
		t.Fatalf("failed to get all connections: %v", err)
	}

	if len(conns) != 2 {
		t.Fatalf("expected 2 connections, got %d", len(conns))
	}

	foundNats := false
	foundKafka := false
	for _, c := range conns {
		if c.ID == "nats-1" {
			foundNats = true
			if c.Protocol != "nats" {
				t.Errorf("expected protocol 'nats', got %q", c.Protocol)
			}
		}
		if c.ID == "kafka-1" {
			foundKafka = true
			if c.Protocol != "kafka" {
				t.Errorf("expected protocol 'kafka', got %q", c.Protocol)
			}
			if c.Username != "alice" || c.Password != "secret" {
				t.Errorf("mismatched Kafka credentials: %s / %s", c.Username, c.Password)
			}
			if c.TLSSNI != "kafka.internal" {
				t.Errorf("expected TLSSNI 'kafka.internal', got %q", c.TLSSNI)
			}
			if !c.TLSInsecure {
				t.Errorf("expected TLSInsecure to be true")
			}
		}
	}

	if !foundNats || !foundKafka {
		t.Errorf("expected to find both NATS and Kafka profiles, foundNats=%v, foundKafka=%v", foundNats, foundKafka)
	}
}
