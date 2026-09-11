package kafkamanager

import (
	"strings"
	"testing"
)

func TestValidateTopicName(t *testing.T) {
	tests := []struct {
		name    string
		topic   string
		wantErr bool
	}{
		{"valid alphanumeric", "orders.v1", false},
		{"valid with dashes and underscores", "user_events-prod", false},
		{"empty topic", "", true},
		{"whitespace only", "   ", true},
		{"dot only", ".", true},
		{"double dot", "..", true},
		{"invalid characters spaces", "invalid topic name", true},
		{"invalid characters special", "order$*!", true},
		{"too long", strings.Repeat("a", 250), true},
		{"max valid length", strings.Repeat("a", 249), false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateTopicName(tc.topic)
			if (err != nil) != tc.wantErr {
				t.Errorf("ValidateTopicName(%q) error = %v; wantErr %v", tc.topic, err, tc.wantErr)
			}
		})
	}
}
