package mcpserver

import (
	"strings"
	"testing"
)

func TestDefaultActionCatalog_NoDeleteOrPurge(t *testing.T) {
	catalog := DefaultActionCatalog()
	if len(catalog) == 0 {
		t.Fatal("expected non-empty action catalog")
	}

	for _, act := range catalog {
		lowerAction := strings.ToLower(act.Action)
		if strings.Contains(lowerAction, "delete") || strings.Contains(lowerAction, "purge") {
			t.Errorf("found forbidden destructive action in catalog: %s", act.Action)
		}
	}
}

func TestDefaultActionCatalog_IncludesCreateAndUpdate(t *testing.T) {
	catalog := DefaultActionCatalog()
	actionMap := make(map[string]ActionDefinition)
	for _, act := range catalog {
		actionMap[act.Action] = act
	}

	expectedCreateUpdate := []string{
		"kafka.create_topic",
		"kafka.update_topic_partitions",
		"kafka.update_topic_configs",
		"nats.create_stream",
		"sqs.create_queue",
		"sqs.update_queue_attributes",
	}

	for _, name := range expectedCreateUpdate {
		act, ok := actionMap[name]
		if !ok {
			t.Errorf("expected action %s was not found in catalog", name)
			continue
		}
		if act.ReadOnly {
			t.Errorf("action %s is a mutating action, expected ReadOnly=false", name)
		}
	}
}
