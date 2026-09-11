package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// Server coordinates the embedded MCP server running inside Streamer
type Server struct {
	mu        sync.RWMutex
	backend   StreamerBackend
	actions   map[string]ActionDefinition
	catalog   []ActionDefinition
	sseServer *server.SSEServer
	mcpServer *server.MCPServer
	status    ServerStatus
}

// NewServer creates a new instance of the embedded MCP server
func NewServer(backend StreamerBackend) *Server {
	catalog := DefaultActionCatalog()
	actionsMap := make(map[string]ActionDefinition, len(catalog))
	for _, act := range catalog {
		actionsMap[act.Action] = act
	}

	return &Server{
		backend: backend,
		actions: actionsMap,
		catalog: catalog,
		status: ServerStatus{
			Running:  false,
			Port:     8765,
			URL:      "http://127.0.0.1:8765/sse",
			ReadOnly: false,
		},
	}
}

// Start launches the MCP HTTP/SSE listener on the specified port
func (s *Server) Start(port int, readOnly bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.status.Running {
		return fmt.Errorf("MCP server is already running on port %d", s.status.Port)
	}

	if port <= 0 || port > 65535 {
		port = 8765
	}

	addr := fmt.Sprintf("127.0.0.1:%d", port)

	// Pre-test TCP port binding to fail fast if port is taken
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("cannot bind MCP server to %s: %w", addr, err)
	}
	_ = ln.Close()

	// Initialize the MCP server with the 4 meta-tools
	mcpServer := server.NewMCPServer(
		"Streamer MCP Server",
		"1.0.0",
		server.WithToolCapabilities(false),
	)

	s.registerMetaTools(mcpServer)

	// Setup SSE Server transport
	sseServer := server.NewSSEServer(
		mcpServer,
		server.WithSSEEndpoint("/sse"),
		server.WithMessageEndpoint("/message"),
		server.WithSSEDisableLocalhostProtection(true),
		server.WithSSECORS(
			server.WithCORSAllowedOrigins("*"),
		),
	)

	s.mcpServer = mcpServer
	s.sseServer = sseServer
	now := time.Now()
	s.status = ServerStatus{
		Running:      true,
		Port:         port,
		URL:          fmt.Sprintf("http://127.0.0.1:%d/sse", port),
		ReadOnly:     readOnly,
		StartedAt:    &now,
		ErrorMessage: "",
	}

	// Launch listener in background
	go func(targetAddr string, srv *server.SSEServer) {
		if err := srv.Start(targetAddr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.mu.Lock()
			s.status.Running = false
			s.status.ErrorMessage = err.Error()
			s.mu.Unlock()
		}
	}(addr, sseServer)

	return nil
}

// Stop gracefully shuts down the running MCP server
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.status.Running || s.sseServer == nil {
		s.status.Running = false
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := s.sseServer.Shutdown(ctx)
	s.sseServer = nil
	s.mcpServer = nil
	s.status.Running = false
	s.status.StartedAt = nil

	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		s.status.ErrorMessage = err.Error()
		return err
	}

	s.status.ErrorMessage = ""
	return nil
}

// GetStatus returns the current live server status
func (s *Server) GetStatus() ServerStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status
}

// registerMetaTools attaches the 4 core meta-tools to the MCP server
func (s *Server) registerMetaTools(mcpServer *server.MCPServer) {
	// 1. list_actions
	listTool := mcp.NewTool("list_actions",
		mcp.WithDescription("Discover available actions supported by Streamer across Kafka, NATS, SQS, and System, along with the active connection context."),
		mcp.WithString("protocol", mcp.Description("Optional filter: 'active' (default), 'kafka', 'nats', 'sqs', 'system', or 'all'")),
		mcp.WithString("search", mcp.Description("Optional keyword search to filter actions")),
	)
	mcpServer.AddTool(listTool, s.handleListActions)

	// 2. get_action_schema
	schemaTool := mcp.NewTool("get_action_schema",
		mcp.WithDescription("Get the parameter JSON schema and documentation for a specific Streamer action."),
		mcp.WithString("action", mcp.Required(), mcp.Description("The unique action identifier (e.g. 'kafka.get_messages', 'sqs.poll_messages')")),
	)
	mcpServer.AddTool(schemaTool, s.handleGetActionSchema)

	// 3. run_action
	runTool := mcp.NewTool("run_action",
		mcp.WithDescription("Execute a single Streamer action with the provided parameters."),
		mcp.WithString("action", mcp.Required(), mcp.Description("The action identifier to run (e.g. 'kafka.list_topics', 'sqs.send_message')")),
		mcp.WithObject("params", mcp.Description("JSON object containing parameter key-values for the action")),
	)
	mcpServer.AddTool(runTool, s.handleRunAction)

	// 4. run_action_sequence
	seqTool := mcp.NewTool("run_action_sequence",
		mcp.WithDescription("Execute a sequence of Streamer actions sequentially in a single batch call."),
		mcp.WithArray("steps", mcp.Required(), mcp.Description("Array of step objects, each having 'id' (string), 'action' (string), and optional 'params' (object)")),
		mcp.WithBoolean("stop_on_error", mcp.Description("Whether to abort remaining steps if one fails (default true)")),
	)
	mcpServer.AddTool(seqTool, s.handleRunActionSequence)
}

// handleListActions executes the list_actions meta-tool
func (s *Server) handleListActions(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	protoFilter := strings.ToLower(request.GetString("protocol", "active"))
	searchTerm := strings.ToLower(request.GetString("search", ""))

	activeProto := s.backend.GetActiveProtocol()
	if protoFilter == "active" || protoFilter == "" {
		if activeProto != "" {
			protoFilter = activeProto
		} else {
			protoFilter = "all"
		}
	}

	type actionSummary struct {
		Action      string `json:"action"`
		Namespace   string `json:"namespace"`
		Description string `json:"description"`
		ReadOnly    bool   `json:"read_only"`
	}

	var filtered []actionSummary
	for _, act := range s.catalog {
		// Namespace check: if specific protocol chosen, allow that protocol OR "system"
		if protoFilter != "all" && act.Namespace != protoFilter && act.Namespace != "system" {
			continue
		}

		// Search term check
		if searchTerm != "" {
			match := strings.Contains(strings.ToLower(act.Action), searchTerm) ||
				strings.Contains(strings.ToLower(act.Description), searchTerm)
			if !match {
				continue
			}
		}

		filtered = append(filtered, actionSummary{
			Action:      act.Action,
			Namespace:   act.Namespace,
			Description: act.Description,
			ReadOnly:    act.ReadOnly,
		})
	}

	connStatus, _ := s.backend.GetConnectionStatus()

	resp := map[string]any{
		"active_protocol":   activeProto,
		"connection_status": connStatus,
		"read_only_mode":    s.status.ReadOnly,
		"actions_count":     len(filtered),
		"actions":           filtered,
	}

	jsonBytes, err := json.MarshalIndent(resp, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to encode response: %v", err)), nil
	}

	return mcp.NewToolResultText(string(jsonBytes)), nil
}

// handleGetActionSchema executes the get_action_schema meta-tool
func (s *Server) handleGetActionSchema(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	actionName, err := request.RequireString("action")
	if err != nil {
		return mcp.NewToolResultError("the 'action' parameter is required"), nil
	}

	resolvedName := resolveActionAlias(actionName)
	act, ok := s.actions[resolvedName]
	if !ok {
		return mcp.NewToolResultError(fmt.Sprintf("action '%s' not found. Call 'list_actions' to discover available actions.", actionName)), nil
	}

	// Construct JSON Schema representation
	props := make(map[string]any)
	var requiredFields []string

	for _, p := range act.Parameters {
		prop := map[string]any{
			"type":        p.Type,
			"description": p.Description,
		}
		if p.Default != nil {
			prop["default"] = p.Default
		}
		props[p.Name] = prop
		if p.Required {
			requiredFields = append(requiredFields, p.Name)
		}
	}

	schema := map[string]any{
		"action":      act.Action,
		"namespace":   act.Namespace,
		"description": act.Description,
		"read_only":   act.ReadOnly,
		"parameters": map[string]any{
			"type":       "object",
			"properties": props,
			"required":   requiredFields,
		},
	}

	jsonBytes, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to encode schema: %v", err)), nil
	}

	return mcp.NewToolResultText(string(jsonBytes)), nil
}

// handleRunAction executes a single action
func (s *Server) handleRunAction(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	actionName, err := request.RequireString("action")
	if err != nil {
		return mcp.NewToolResultError("the 'action' parameter is required"), nil
	}

	params := parseActionParams(request.GetArguments())

	res, err := s.executeAction(ctx, actionName, params)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	jsonBytes, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to serialize result: %v", err)), nil
	}

	return mcp.NewToolResultText(string(jsonBytes)), nil
}

// handleRunActionSequence executes a sequence of actions sequentially
func (s *Server) handleRunActionSequence(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	rawArgs := request.GetArguments()
	rawSteps, ok := rawArgs["steps"].([]any)
	if !ok || len(rawSteps) == 0 {
		return mcp.NewToolResultError("steps array is required and must not be empty"), nil
	}

	stopOnError := true
	if soe, ok := rawArgs["stop_on_error"].(bool); ok {
		stopOnError = soe
	}

	results := make(map[string]any)
	executedCount := 0

	for idx, rawStep := range rawSteps {
		stepMap, ok := rawStep.(map[string]any)
		if !ok {
			return mcp.NewToolResultError(fmt.Sprintf("step at index %d is not a valid object", idx)), nil
		}

		stepID, _ := stepMap["id"].(string)
		if stepID == "" {
			stepID = fmt.Sprintf("step_%d", idx+1)
		}

		actionName, _ := stepMap["action"].(string)
		if actionName == "" {
			return mcp.NewToolResultError(fmt.Sprintf("step '%s' is missing 'action'", stepID)), nil
		}

		params := parseActionParams(stepMap)

		res, err := s.executeAction(ctx, actionName, params)
		if err != nil {
			if stopOnError {
				resp := map[string]any{
					"success":        false,
					"failed_step":    stepID,
					"error":          err.Error(),
					"steps_executed": executedCount,
					"results":        results,
				}
				jsonBytes, _ := json.MarshalIndent(resp, "", "  ")
				return mcp.NewToolResultText(string(jsonBytes)), nil
			}
			results[stepID] = map[string]any{"error": err.Error()}
		} else {
			results[stepID] = res
			executedCount++
		}
	}

	resp := map[string]any{
		"success":        true,
		"steps_executed": executedCount,
		"results":        results,
	}

	jsonBytes, err := json.MarshalIndent(resp, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to serialize batch results: %v", err)), nil
	}

	return mcp.NewToolResultText(string(jsonBytes)), nil
}

// executeAction performs validation and executes the underlying handler
func (s *Server) executeAction(ctx context.Context, actionName string, params map[string]any) (any, error) {
	resolvedName := resolveActionAlias(actionName)
	act, ok := s.actions[resolvedName]
	if !ok {
		return nil, fmt.Errorf("action '%s' not found. Call 'list_actions' to discover available actions", actionName)
	}

	s.mu.RLock()
	readOnly := s.status.ReadOnly
	s.mu.RUnlock()

	if readOnly && !act.ReadOnly {
		return nil, fmt.Errorf("action '%s' is a mutating/write operation and cannot be executed while MCP Server is running in Read-Only Mode", actionName)
	}

	return act.Handler(ctx, s.backend, params)
}

// parseActionParams extracts and merges parameters from both top-level and nested params objects
func parseActionParams(rawArgs map[string]any) map[string]any {
	params := make(map[string]any)
	for k, v := range rawArgs {
		if k != "action" && k != "id" && k != "params" {
			params[k] = v
		}
	}

	if p, ok := rawArgs["params"]; ok && p != nil {
		switch pv := p.(type) {
		case map[string]any:
			for k, v := range pv {
				params[k] = v
			}
		case string:
			trimmed := strings.TrimSpace(pv)
			if strings.HasPrefix(trimmed, "{") {
				var parsed map[string]any
				if err := json.Unmarshal([]byte(trimmed), &parsed); err == nil {
					for k, v := range parsed {
						params[k] = v
					}
				}
			}
		}
	}
	return params
}

// resolveActionAlias normalizes common synonyms for action names
func resolveActionAlias(actionName string) string {
	switch strings.ToLower(strings.TrimSpace(actionName)) {
	case "kafka.publish_message", "kafka.publish_msg", "kafka.produce_message", "kafka.publish", "kafka.send_message", "kafka.send_record", "kafka.send":
		return "kafka.produce_record"
	case "kafka.fetch_messages", "kafka.poll_messages", "kafka.read_messages":
		return "kafka.get_messages"
	case "nats.publish_message", "nats.publish_msg", "nats.produce_message", "nats.send_message", "nats.send_msg", "nats.send":
		return "nats.publish"
	case "nats.request_message", "nats.request_msg":
		return "nats.request"
	case "nats.fetch_messages", "nats.get_messages", "nats.stream_messages":
		return "nats.get_stream_messages"
	case "nats.put_kv", "nats.set_kv", "nats.set_kv_entry":
		return "nats.put_kv_entry"
	case "nats.get_kv":
		return "nats.get_kv_entry"
	case "sqs.publish_message", "sqs.publish_msg", "sqs.produce_message", "sqs.send", "sqs.send_msg", "sqs.publish":
		return "sqs.send_message"
	case "sqs.get_messages", "sqs.receive_messages", "sqs.read_messages", "sqs.fetch_messages":
		return "sqs.poll_messages"
	case "sqs.get_queue", "sqs.queue_details", "sqs.get_queue_attributes":
		return "sqs.get_queue_details"
	default:
		return actionName
	}
}
