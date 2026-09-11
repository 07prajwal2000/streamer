package kafkamanager

import (
	"reflect"
	"testing"
)

func TestParseBrokers(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "single host port",
			input:    "localhost:9092",
			expected: []string{"localhost:9092"},
		},
		{
			name:     "multiple comma separated",
			input:    "localhost:9092, 127.0.0.1:9093 , broker3:9094",
			expected: []string{"localhost:9092", "127.0.0.1:9093", "broker3:9094"},
		},
		{
			name:     "with protocol scheme",
			input:    "kafka://10.0.0.1:9092, plaintext://10.0.0.2:9092",
			expected: []string{"10.0.0.1:9092", "10.0.0.2:9092"},
		},
		{
			name:     "empty strings and trailing commas",
			input:    "localhost:9092, , ",
			expected: []string{"localhost:9092"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := parseBrokers(tc.input)
			if !reflect.DeepEqual(got, tc.expected) {
				t.Errorf("parseBrokers(%q) = %v; want %v", tc.input, got, tc.expected)
			}
		})
	}
}
