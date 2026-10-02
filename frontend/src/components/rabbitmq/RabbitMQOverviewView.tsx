import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Activity,
  Layers,
  Users,
  MessageSquare,
  ShieldAlert,
  Server,
  Network,
  Clock,
  Boxes,
  Database,
  Radio,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import {
  GetRabbitMQOverview,
  ListRabbitMQNodes,
  ListRabbitMQVHosts,
} from '../../../wailsjs/go/main/App';

interface RabbitMQOverviewViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export const RabbitMQOverviewView: React.FC<RabbitMQOverviewViewProps> = ({
  isConnected,
  isActiveTab,
}) => {
  const [overview, setOverview] = useState<rabbitmqmanager.RMQOverview | null>(null);
  const [nodes, setNodes] = useState<rabbitmqmanager.RMQNodeInfo[]>([]);
  const [vhosts, setVhosts] = useState<rabbitmqmanager.RMQVHostInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const [ovData, nodeData, vhostData] = await Promise.allSettled([
        GetRabbitMQOverview(),
        ListRabbitMQNodes(),
        ListRabbitMQVHosts(),
      ]);

      if (ovData.status === 'fulfilled') {
        setOverview(ovData.value);
      } else {
        console.warn('Overview fetch error:', ovData.reason);
      }

      if (nodeData.status === 'fulfilled') {
        setNodes(nodeData.value || []);
      }

      if (vhostData.status === 'fulfilled') {
        setVhosts(vhostData.value || []);
      }

      if (ovData.status === 'rejected' && nodeData.status === 'rejected') {
        setError(String(ovData.reason || 'Failed to fetch cluster overview'));
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadData();
    }
  }, [isConnected, isActiveTab]);

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 select-none">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <Boxes className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Not Connected to RabbitMQ</h3>
          <p className="text-xs text-gray-500 mb-4">
            Connect to a RabbitMQ broker in the Connections tab to view cluster overview, node telemetry, and virtual hosts.
          </p>
        </div>
      </div>
    );
  }

  const hasAlarms = overview?.diskFreeAlarm || overview?.memoryAlarm;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d13] overflow-y-auto select-none">
      {/* Top Toolbar */}
      <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-rose-400" />
              Cluster Overview & Nodes
            </h1>
            {overview?.clusterName && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#161c26] text-gray-300 border border-[#232c3d]">
                {overview.clusterName}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            RabbitMQ broker cluster health, memory/disk thresholds, and cluster nodes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141a24] hover:bg-[#1a2332] text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-[#232c3d] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <div className="flex-1 font-mono">{error}</div>
          </div>
        )}

        {/* Resource Alarms Banner */}
        {hasAlarms && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center gap-3 animate-pulse">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
            <div>
              <div className="text-xs font-semibold text-rose-300 uppercase tracking-wide">
                Cluster Resource Alarm Triggered!
              </div>
              <div className="text-xs text-gray-300 mt-0.5">
                {overview?.memoryAlarm && 'Memory threshold exceeded on one or more nodes. '}
                {overview?.diskFreeAlarm && 'Free disk space low water mark alarm tripped. '}
                Publishers are currently throttled or blocked by RabbitMQ until alarms clear.
              </div>
            </div>
          </div>
        )}

        {/* Cluster Versions & Specs Pill Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">RabbitMQ Version</span>
              <span className="text-xs font-mono font-medium text-white truncate block">
                {overview?.rabbitmqVersion ? `v${overview.rabbitmqVersion}` : 'AMQP Broker'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Erlang / OTP</span>
              <span className="text-xs font-mono font-medium text-white truncate block">
                {overview?.erlangVersion ? `OTP ${overview.erlangVersion}` : '-'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Cluster Health</span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {hasAlarms ? 'Alarm Active' : 'Normal'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <Network className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Nodes Online</span>
              <span className="text-xs font-mono font-medium text-white block">
                {nodes.length > 0 ? nodes.length : 1} Node{nodes.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530]">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Total Queues</span>
              <Layers className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {overview?.totalQueues ?? 0}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Declared queues</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530]">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Exchanges</span>
              <Boxes className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {overview?.totalExchanges ?? 0}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Routers & defaults</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530]">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Connections</span>
              <Network className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {overview?.totalConnections ?? 0}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">
              {overview?.totalChannels ?? 0} channels
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530]">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Consumers</span>
              <Users className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {overview?.totalConsumers ?? 0}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Active listeners</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530]">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Messages Ready</span>
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              {overview?.messagesReady ?? 0}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Pending delivery</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530]">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Unacknowledged</span>
              <Clock className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-purple-300 font-mono">
              {overview?.messagesUnack ?? 0}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">In-flight deliveries</span>
          </div>
        </div>

        {/* Real-Time Message Rates Card */}
        {overview?.messageRates && (
          <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530]">
            <div className="flex items-center justify-between mb-3 border-b border-[#1b2330] pb-2">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-rose-400" />
                Cluster Message Rates
              </span>
              <span className="text-[10px] text-gray-500">Calculated over recent management sample window</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-[#121822] border border-[#1a2332]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Publish Rate</span>
                <span className="text-sm font-mono font-bold text-white mt-0.5 block">
                  {overview.messageRates.publishRate.toFixed(1)} /s
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#121822] border border-[#1a2332]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Deliver / Get Rate</span>
                <span className="text-sm font-mono font-bold text-amber-300 mt-0.5 block">
                  {overview.messageRates.deliverRate.toFixed(1)} /s
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#121822] border border-[#1a2332]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Acknowledge Rate</span>
                <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
                  {overview.messageRates.ackRate.toFixed(1)} /s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Nodes Telemetry Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-rose-400" />
              Cluster Nodes ({nodes.length})
            </h2>
          </div>

          <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                  <th className="py-2.5 px-4 font-medium">Node Name</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Memory</th>
                  <th className="py-2.5 px-4 font-medium">Disk Free</th>
                  <th className="py-2.5 px-4 font-medium">FDs</th>
                  <th className="py-2.5 px-4 font-medium">Sockets</th>
                  <th className="py-2.5 px-4 font-medium">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18202c]">
                {nodes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500 text-xs">
                      {loading ? 'Querying RabbitMQ cluster nodes...' : 'No node telemetry available (pure AMQP fallback mode or management API disabled)'}
                    </td>
                  </tr>
                ) : (
                  nodes.map((node) => {
                    const memPct = node.memLimit > 0 ? Math.min(100, Math.round((node.memUsed / node.memLimit) * 100)) : 0;
                    return (
                      <tr key={node.name} className="hover:bg-[#121822] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${node.running ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {node.name}
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono text-[11px] uppercase">
                          <span className="px-1.5 py-0.5 rounded bg-[#161d28] border border-[#232c3d]">
                            {node.type || 'disc'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {node.running ? (
                            <span className="text-emerald-400 font-medium text-[11px]">Running</span>
                          ) : (
                            <span className="text-rose-400 font-medium text-[11px]">Stopped</span>
                          )}
                        </td>
                        <td className="py-3 px-4 min-w-[140px]">
                          <div className="flex items-center justify-between text-[10px] font-mono text-gray-300 mb-1">
                            <span>{formatBytes(node.memUsed)}</span>
                            <span className="text-gray-500">{formatBytes(node.memLimit)}</span>
                          </div>
                          <div className="w-full bg-[#18202c] rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                node.memAlarm
                                  ? 'bg-rose-500'
                                  : memPct > 80
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{ width: `${memPct}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-300 font-mono text-[11px]">
                          <span className={node.diskFreeAlarm ? 'text-rose-400 font-bold' : ''}>
                            {formatBytes(node.diskFree)} free
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                          {node.fdUsed} / {node.fdTotal}
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                          {node.socketsUsed} / {node.socketsTotal}
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                          {formatUptime(node.uptimeSeconds)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Virtual Hosts Section */}
        {vhosts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Virtual Hosts ({vhosts.length})
            </h2>

            <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                    <th className="py-2.5 px-4 font-medium">Virtual Host</th>
                    <th className="py-2.5 px-4 font-medium">Total Messages</th>
                    <th className="py-2.5 px-4 font-medium">Ready</th>
                    <th className="py-2.5 px-4 font-medium">Unacknowledged</th>
                    <th className="py-2.5 px-4 font-medium">Rates</th>
                    <th className="py-2.5 px-4 font-medium">Tracing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202c]">
                  {vhosts.map((vh) => (
                    <tr key={vh.name} className="hover:bg-[#121822] transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        {vh.name}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-200">
                        {vh.messages.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-emerald-400">
                        {vh.messagesReady.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-purple-300">
                        {vh.messagesUnacknowledged.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-400 text-[11px]">
                        pub: {vh.messageRates?.publishRate?.toFixed(1) || '0.0'}/s · del: {vh.messageRates?.deliverRate?.toFixed(1) || '0.0'}/s
                      </td>
                      <td className="py-2.5 px-4">
                        {vh.tracing ? (
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                            Enabled
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500">Disabled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
