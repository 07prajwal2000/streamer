import React from 'react';
import { 
  Database, 
  Radio, 
  Layers, 
  KeyRound, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Server,
  Play,
  PowerOff,
  Settings,
  Star,
  ExternalLink,
  Zap,
  Cpu,
  HardDrive,
  Users,
  MessageSquare,
  Inbox
} from 'lucide-react';
import { storage, natsmanager } from '../../wailsjs/go/models';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

interface SidebarProps {
  connections: storage.ConnectionProfile[];
  selectedId: string | null;
  activeStatus: natsmanager.ServerStatus;
  activeProfileId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onConnect: (p: storage.ConnectionProfile) => void;
  onDisconnect: (id: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  connections,
  selectedId,
  activeStatus,
  activeProfileId,
  onSelect,
  onNew,
  onConnect,
  onDisconnect,
  activeTab,
  onTabChange,
  onOpenSettings,
}) => {
  const handleOpenRepo = (e: React.MouseEvent) => {
    e.preventDefault();
    BrowserOpenURL('https://github.com/07prajwal2000/streamer');
  };

  return (
    <aside className="w-64 bg-[#090d13] border-r border-[#1e2530] flex flex-col h-full select-none">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#1e2530] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon.png"
            alt="Streamer Icon"
            className="w-8 h-8 rounded-lg shadow-sm border border-blue-500/20 object-cover"
          />
          <div>
            <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>Streamer</span>
            </div>
            <div className="text-[10px] text-gray-500 font-mono leading-none">NATS, Kafka & SQS</div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="p-2 space-y-0.5 border-b border-[#1e2530]">
        <button
          onClick={() => onTabChange('connections')}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'connections'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Connections</span>
          <span className="ml-auto text-[10px] bg-[#1a212d] text-gray-400 px-1.5 py-0.5 rounded-full">
            {connections.length}
          </span>
        </button>

        {activeStatus.connected && activeStatus.protocol === 'kafka' ? (
          <>
            <button
              onClick={() => onTabChange('kafka-cluster')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'kafka-cluster'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              <span>Brokers & Cluster</span>
            </button>

            <button
              onClick={() => onTabChange('kafka-topics')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'kafka-topics'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-orange-400" />
              <span>Topics</span>
            </button>

            <button
              onClick={() => onTabChange('kafka-groups')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'kafka-groups'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-orange-400" />
              <span>Consumer Groups</span>
            </button>

            <button
              onClick={() => onTabChange('kafka-messages')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'kafka-messages'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
              <span>Messages</span>
            </button>
          </>
        ) : activeStatus.connected && activeStatus.protocol === 'sqs' ? (
          <>
            <button
              onClick={() => onTabChange('sqs-queues')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'sqs-queues'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 text-amber-400" />
              <span>Queues & Metrics</span>
            </button>

            <button
              onClick={() => onTabChange('sqs-messages')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'sqs-messages'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Messages & Poller</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onTabChange('pubsub')}
              disabled={!activeStatus.connected}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !activeStatus.connected
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : activeTab === 'pubsub'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Pub/Sub Live</span>
            </button>

            <button
              onClick={() => onTabChange('jetstream')}
              disabled={!activeStatus.connected || !activeStatus.jetStream}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !activeStatus.connected || !activeStatus.jetStream
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : activeTab === 'jetstream'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>JetStream</span>
            </button>

            <button
              onClick={() => onTabChange('kv')}
              disabled={!activeStatus.connected || !activeStatus.jetStream}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !activeStatus.connected || !activeStatus.jetStream
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : activeTab === 'kv'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>KV Store</span>
            </button>
          </>
        )}
      </div>

      {/* Saved Profiles Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Profiles</span>
          <button
            onClick={onNew}
            title="New Connection Profile"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1e2530] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {connections.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-600">
              No saved profiles yet. Click + to add one.
            </div>
          ) : (
            connections.map((p) => {
              const isSelected = selectedId === p.id;
              const isActive = activeStatus.connected && activeProfileId === p.id;
              const isConnecting = activeStatus.connecting && activeProfileId === p.id;
              const isKafka = p.protocol === 'kafka';
              const isSQS = p.protocol === 'sqs';

              return (
                <div
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`group px-2.5 py-2 rounded-lg cursor-pointer text-left transition-all border ${
                    isSelected
                      ? isKafka
                        ? 'bg-[#191512] border-orange-500/40 text-white shadow-sm'
                        : isSQS
                        ? 'bg-[#1a1711] border-amber-500/40 text-white shadow-sm'
                        : 'bg-[#151c27] border-blue-500/30 text-white shadow-sm'
                      : 'border-transparent text-gray-300 hover:bg-[#111720] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isKafka ? (
                        <Layers className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      ) : isSQS ? (
                        <Inbox className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      <span className="text-xs font-medium truncate">{p.name || 'Untitled'}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDisconnect(p.id);
                          }}
                          title="Disconnect"
                          className="p-1 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
                        >
                          <PowerOff className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onConnect(p);
                          }}
                          title="Connect"
                          className={`p-1 rounded transition-colors ${
                            isKafka
                              ? 'hover:bg-orange-500/20 text-gray-400 hover:text-orange-400'
                              : isSQS
                              ? 'hover:bg-amber-500/20 text-gray-400 hover:text-amber-400'
                              : 'hover:bg-blue-500/20 text-gray-400 hover:text-blue-400'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 truncate font-mono mt-0.5">
                    {p.url || (p.protocol === 'sqs' ? `AWS Cloud (${p.awsRegion || 'us-east-1'})` : '')}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500">
                    {isKafka ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-orange-500/15 text-orange-400 text-[9px] font-semibold border border-orange-500/25">
                        <Layers className="w-2.5 h-2.5" />
                        KAFKA
                      </span>
                    ) : isSQS ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 text-[9px] font-semibold border border-amber-500/25">
                        <Inbox className="w-2.5 h-2.5" />
                        SQS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-400 text-[9px] font-semibold border border-cyan-500/25">
                        <Zap className="w-2.5 h-2.5" />
                        NATS
                      </span>
                    )}
                    <span className="uppercase px-1 py-0.2 rounded bg-[#1c2330] text-[9px] font-medium text-gray-400">
                      {p.authType}
                    </span>
                    {isActive && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Active
                      </span>
                    )}
                    {p.tlsInsecure && (
                      <span className="text-amber-500/80">Insecure TLS</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Server Health Pill & Settings Footer */}
      <div className="p-3 border-t border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {activeStatus.connected ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : activeStatus.connecting ? (
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-gray-500" />
          )}
          <span className="text-[11px] font-medium text-gray-300">
            {activeStatus.connected
              ? 'Connected'
              : activeStatus.connecting
              ? 'Connecting...'
              : 'Disconnected'}
          </span>
          {activeStatus.connected && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-1">
              {activeStatus.rttMs.toFixed(1)}ms
            </span>
          )}
        </div>

        <button
          onClick={onOpenSettings}
          title="App Settings"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Credits & Give Star on GitHub Link */}
      <div className="px-3 py-2 border-t border-[#18202c] bg-[#070b10] flex items-center justify-between text-[11px]">
        <span className="text-gray-500 truncate">
          by <span className="text-gray-300 font-medium">@07prajwal2000</span>
        </span>
        <button
          onClick={handleOpenRepo}
          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors font-medium bg-amber-400/10 hover:bg-amber-400/15 border border-amber-400/20 px-2 py-0.5 rounded-md text-[10px]"
          title="Open repository in browser & give a star"
        >
          <Star className="w-3 h-3 fill-current" />
          <span>Star on GitHub</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </button>
      </div>
    </aside>
  );
};
