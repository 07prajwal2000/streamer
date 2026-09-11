import React, { useState, useEffect } from 'react';
import { 
  X, Sliders, Star, ExternalLink, 
  Cpu, Play, Square, Copy, Check, ShieldCheck, Layers, AlertCircle, RefreshCw
} from 'lucide-react';
import { 
  GetSetting, SetSetting, 
  GetMCPServerStatus, StartMCPServer, StopMCPServer 
} from '../../../wailsjs/go/main/App';
import { mcpserver } from '../../../wailsjs/go/models';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: 'dark' | 'light' | 'system';
  onThemeChange?: (theme: 'dark' | 'light' | 'system') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'mcp' | 'about'>('general');
  const [clientName, setClientName] = useState('Streamer');
  const [maxMsgBuffer, setMaxMsgBuffer] = useState('500');

  // MCP State
  const [mcpStatus, setMcpStatus] = useState<mcpserver.ServerStatus | null>(null);
  const [mcpPort, setMcpPort] = useState('8765');
  const [mcpReadOnly, setMcpReadOnly] = useState(false);
  const [mcpAutoStart, setMcpAutoStart] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [clientConfigTab, setClientConfigTab] = useState<'claude' | 'cursor'>('claude');

  const fetchMCPStatus = async () => {
    try {
      const status = await GetMCPServerStatus();
      setMcpStatus(status);
      if (status.port > 0) {
        setMcpPort(status.port.toString());
      }
      setMcpReadOnly(status.readOnly);
    } catch (e: any) {
      console.error('Failed to get MCP server status:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      GetSetting('client_name', 'Streamer').then(setClientName);
      GetSetting('max_msg_buffer', '500').then(setMaxMsgBuffer);

      // Load saved MCP preferences
      GetSetting('mcp_port', '8765').then(setMcpPort);
      GetSetting('mcp_read_only', 'false').then((v) => setMcpReadOnly(v === 'true'));
      GetSetting('mcp_auto_start', 'false').then((v) => setMcpAutoStart(v === 'true'));
      fetchMCPStatus();
    }
  }, [isOpen]);

  const handleSaveGeneral = async () => {
    await SetSetting('client_name', clientName);
    await SetSetting('max_msg_buffer', maxMsgBuffer);
    onClose();
  };

  const handleToggleMCPServer = async () => {
    setMcpLoading(true);
    setMcpError(null);
    try {
      if (mcpStatus?.running) {
        await StopMCPServer();
      } else {
        const port = parseInt(mcpPort, 10) || 8765;
        if (port <= 1024 || port > 65535) {
          throw new Error('Port must be between 1024 and 65535');
        }
        await SetSetting('mcp_port', port.toString());
        await SetSetting('mcp_read_only', mcpReadOnly ? 'true' : 'false');
        await SetSetting('mcp_auto_start', mcpAutoStart ? 'true' : 'false');
        await StartMCPServer(port, mcpReadOnly);
      }
      await fetchMCPStatus();
    } catch (err: any) {
      setMcpError(err?.message || String(err));
    } finally {
      setMcpLoading(false);
    }
  };

  const handleSaveMCPSettings = async () => {
    const port = parseInt(mcpPort, 10) || 8765;
    await SetSetting('mcp_port', port.toString());
    await SetSetting('mcp_read_only', mcpReadOnly ? 'true' : 'false');
    await SetSetting('mcp_auto_start', mcpAutoStart ? 'true' : 'false');
    if (mcpStatus?.running) {
      // Prompt restart
      setMcpError('Settings saved. Restart the MCP server to apply changes.');
    }
  };

  const handleOpenRepo = () => {
    BrowserOpenURL('https://github.com/07prajwal2000/streamer');
  };

  const getClientConfigSnippet = () => {
    const port = mcpStatus?.running ? mcpStatus.port : parseInt(mcpPort, 10) || 8765;
    const sseUrl = `http://127.0.0.1:${port}/sse`;

    if (clientConfigTab === 'claude') {
      return JSON.stringify(
        {
          mcpServers: {
            streamer: {
              url: sseUrl,
            },
          },
        },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        mcpServers: {
          streamer: {
            type: 'sse',
            url: sseUrl,
          },
        },
      },
      null,
      2
    );
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(getClientConfigSnippet());
    setMcpCopied(true);
    setTimeout(() => setMcpCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none"
    >
      <div className="w-full max-w-xl max-h-[90vh] bg-[#111722] border border-[#1f2838] rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1f2838] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Settings</h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-[#1f2838] flex gap-4 bg-[#0e131b]">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-2 text-xs font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            General
          </button>
          <button
            onClick={() => {
              setActiveTab('mcp');
              fetchMCPStatus();
            }}
            className={`pb-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'mcp'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>MCP Server</span>
            {mcpStatus?.running && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`pb-2 text-xs font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'about'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            About & Credits
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 flex-1 space-y-4 overflow-y-auto">

          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Default Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Streamer"
                  className="w-full bg-[#151c27] border border-[#222b3c] focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Live Stream Message Buffer Size
                </label>
                <input
                  type="number"
                  value={maxMsgBuffer}
                  onChange={(e) => setMaxMsgBuffer(e.target.value)}
                  min={100}
                  max={5000}
                  step={100}
                  className="w-full bg-[#151c27] border border-[#222b3c] focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                />
                <p className="text-[11px] text-gray-500">
                  Maximum number of messages stored in the live UI log before auto-purging old items.
                </p>
              </div>
            </div>
          )}

          {/* MCP SERVER TAB */}
          {activeTab === 'mcp' && (
            <div className="space-y-4">
              {/* Server Control Card */}
              <div className="p-4 rounded-xl bg-[#141b26] border border-[#212b3c] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${mcpStatus?.running ? 'bg-emerald-400 ring-4 ring-emerald-400/20 animate-pulse' : 'bg-gray-600'}`} />
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Model Context Protocol (MCP) Server</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          mcpStatus?.running 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}>
                          {mcpStatus?.running ? 'RUNNING' : 'OFFLINE'}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {mcpStatus?.running 
                          ? `Listening on ${mcpStatus.url}` 
                          : 'Server is stopped. Start to enable AI agent tool calls.'}
                      </div>
                    </div>
                  </div>

                  {/* Start / Stop Action Button */}
                  <button
                    type="button"
                    disabled={mcpLoading}
                    onClick={handleToggleMCPServer}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                      mcpStatus?.running
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/30'
                    }`}
                  >
                    {mcpLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : mcpStatus?.running ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{mcpStatus?.running ? 'Stop Server' : 'Start Server'}</span>
                  </button>
                </div>

                {mcpError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{mcpError}</span>
                  </div>
                )}
              </div>

              {/* Server Options Card */}
              <div className="p-4 rounded-xl bg-[#141b26] border border-[#212b3c] space-y-3">
                <div className="text-xs font-semibold text-gray-200">Server Configuration</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-300">Listen Port (Loopback)</label>
                    <input
                      type="number"
                      disabled={mcpStatus?.running}
                      value={mcpPort}
                      onChange={(e) => setMcpPort(e.target.value)}
                      placeholder="8765"
                      min={1024}
                      max={65535}
                      className="w-full bg-[#10151f] border border-[#222b3c] focus:border-purple-500 disabled:opacity-60 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 flex flex-col justify-end">
                    <button
                      type="button"
                      disabled={mcpStatus?.running}
                      onClick={handleSaveMCPSettings}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-[#1e2637] hover:bg-[#28334a] disabled:opacity-40 transition-colors cursor-pointer self-start"
                    >
                      Save Config
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1c2433] space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mcpReadOnly}
                      onChange={(e) => {
                        setMcpReadOnly(e.target.checked);
                        handleSaveMCPSettings();
                      }}
                      className="mt-0.5 rounded border-gray-700 bg-[#10151f] text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-xs">
                      <span className="font-medium text-gray-200">Enforce Read-Only Mode</span>
                      <p className="text-[11px] text-gray-500">
                        Blocks all create, update, and publish operations. Recommended for sensitive production clusters.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mcpAutoStart}
                      onChange={(e) => {
                        setMcpAutoStart(e.target.checked);
                        handleSaveMCPSettings();
                      }}
                      className="mt-0.5 rounded border-gray-700 bg-[#10151f] text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-xs">
                      <span className="font-medium text-gray-200">Auto-Start on Streamer Launch</span>
                      <p className="text-[11px] text-gray-500">
                        Automatically spins up the MCP SSE server whenever you open Streamer.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 4 Meta-Tools Overview Badge */}
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/30 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>4 Meta-Tool Architecture (Token-Efficient)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-[#0d121a] border border-[#1b2331]">
                    <span className="font-mono text-purple-400 font-semibold">1. list_actions</span>
                    <p className="text-gray-400 mt-0.5">Discovers operations filtered by active cluster protocol</p>
                  </div>
                  <div className="p-2 rounded bg-[#0d121a] border border-[#1b2331]">
                    <span className="font-mono text-purple-400 font-semibold">2. get_action_schema</span>
                    <p className="text-gray-400 mt-0.5">Returns JSON Schema parameter documentation on demand</p>
                  </div>
                  <div className="p-2 rounded bg-[#0d121a] border border-[#1b2331]">
                    <span className="font-mono text-purple-400 font-semibold">3. run_action</span>
                    <p className="text-gray-400 mt-0.5">Executes a single action with payload & safety limits</p>
                  </div>
                  <div className="p-2 rounded bg-[#0d121a] border border-[#1b2331]">
                    <span className="font-mono text-purple-400 font-semibold">4. run_action_sequence</span>
                    <p className="text-gray-400 mt-0.5">Runs multi-step batch pipelines in one round-trip</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 pt-1 border-t border-purple-900/30">
                  <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-400 mr-1" />
                  Supports topic/queue creation & updates. All delete & purge operations are strictly excluded.
                </p>
              </div>

              {/* Client Integration Snippet */}
              <div className="p-3.5 rounded-xl bg-[#141b26] border border-[#212b3c] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-200">Connect AI Client</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setClientConfigTab('claude')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        clientConfigTab === 'claude'
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#1e2637] text-gray-400 hover:text-white'
                      }`}
                    >
                      Claude Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientConfigTab('cursor')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        clientConfigTab === 'cursor'
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#1e2637] text-gray-400 hover:text-white'
                      }`}
                    >
                      Cursor / Antigravity
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <pre className="p-3 rounded-lg bg-[#0c1017] border border-[#1d2535] text-[11px] font-mono text-purple-300 overflow-x-auto">
                    {getClientConfigSnippet()}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopySnippet}
                    className="absolute top-2 right-2 px-2 py-1 rounded bg-[#1f283a] hover:bg-[#2b374e] border border-[#2f3c55] text-gray-300 hover:text-white text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {mcpCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#141b26] border border-[#212b3c] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Application</span>
                  <span className="font-semibold text-white">Streamer (Multi-Protocol Streaming Suite)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Architecture</span>
                  <span className="font-mono text-gray-300">Go 1.27 + Wails v2 + React 19</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Supported Protocols</span>
                  <span className="font-mono text-gray-300">Kafka, Redpanda, NATS JetStream, SQS</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">MCP Server</span>
                  <span className="font-mono text-purple-400 font-semibold">Enabled (SSE 4-Meta-Tool)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Storage Backend</span>
                  <span className="font-mono text-gray-300">SQLite (Pure Go / CGO-free)</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1e2532]">
                  <span className="text-gray-400">Author & Maintainer</span>
                  <span className="font-medium text-purple-400">@07prajwal2000</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Support & Star on GitHub</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">github.com/07prajwal2000/streamer</div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenRepo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-400 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Star Project</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1f2838] bg-[#0e131b] flex justify-end gap-2">
          {activeTab === 'general' ? (
            <button
              onClick={handleSaveGeneral}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
            >
              Save Settings
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-[#1a2230] hover:bg-[#222c3e] transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
