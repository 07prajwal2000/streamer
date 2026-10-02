import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Eraser,
  ExternalLink,
  Shield,
  Clock,
  MessageSquare,
  Filter,
  ArrowRight,
  Info,
  Check,
  Boxes,
  Database,
  Users,
  RotateCcw,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import {
  ListRabbitMQQueues,
  ListRabbitMQVHosts,
  PurgeRabbitMQQueue,
  DeleteRabbitMQQueue,
} from '../../../wailsjs/go/main/App';
import { CreateQueueModal } from './CreateQueueModal';
import { QueueDetailDrawer } from './QueueDetailDrawer';

interface RabbitMQQueuesViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
  onNavigateToMessages?: (queueName: string) => void;
  onOpenRedrive?: (queueName: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const RabbitMQQueuesView: React.FC<RabbitMQQueuesViewProps> = ({
  isConnected,
  isActiveTab,
  onNavigateToMessages,
  onOpenRedrive,
}) => {
  const [queues, setQueues] = useState<rabbitmqmanager.RMQQueueSummary[]>([]);
  const [vhosts, setVhosts] = useState<string[]>(['/']);
  const [selectedVhost, setSelectedVhost] = useState<string>(''); // empty string = all vhosts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'classic' | 'quorum' | 'stream' | 'dlx'>('all');

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDrawerQueue, setSelectedDrawerQueue] = useState<{ vhost: string; name: string } | null>(null);

  // Purge confirmation
  const [purgeTarget, setPurgeTarget] = useState<rabbitmqmanager.RMQQueueSummary | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<rabbitmqmanager.RMQQueueSummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const [qData, vhData] = await Promise.all([
        ListRabbitMQQueues(selectedVhost),
        ListRabbitMQVHosts().catch(() => []),
      ]);

      setQueues(qData || []);
      if (vhData && vhData.length > 0) {
        setVhosts(vhData.map((v) => v.name));
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
  }, [isConnected, isActiveTab, selectedVhost]);

  const filteredQueues = useMemo(() => {
    return queues.filter((q) => {
      // Type filter
      if (typeFilter === 'classic' && q.type !== 'classic') return false;
      if (typeFilter === 'quorum' && q.type !== 'quorum') return false;
      if (typeFilter === 'stream' && q.type !== 'stream') return false;
      if (typeFilter === 'dlx' && !q.hasDlx) return false;

      // Search filter
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        q.name.toLowerCase().includes(term) ||
        (q.vhost && q.vhost.toLowerCase().includes(term))
      );
    });
  }, [queues, typeFilter, search]);

  const stats = useMemo(() => {
    let totalMessages = 0;
    let totalReady = 0;
    let totalUnack = 0;
    let totalConsumers = 0;
    let quorumCount = 0;
    let dlxCount = 0;

    for (const q of queues) {
      totalMessages += q.messages || 0;
      totalReady += q.messagesReady || 0;
      totalUnack += q.messagesUnacknowledged || 0;
      totalConsumers += q.consumers || 0;
      if (q.type === 'quorum') quorumCount++;
      if (q.hasDlx) dlxCount++;
    }

    return {
      totalQueues: queues.length,
      totalMessages,
      totalReady,
      totalUnack,
      totalConsumers,
      quorumCount,
      dlxCount,
    };
  }, [queues]);

  const handleExecutePurge = async () => {
    if (!purgeTarget) return;
    setPurgeLoading(true);
    setPurgeFeedback(null);
    try {
      const purged = await PurgeRabbitMQQueue(purgeTarget.vhost, purgeTarget.name);
      setPurgeFeedback({
        message: `Successfully purged ${purged} message(s) from queue '${purgeTarget.name}'.`,
        isError: false,
      });
      setPurgeTarget(null);
      await loadData();
    } catch (err: any) {
      setPurgeFeedback({
        message: String(err),
        isError: true,
      });
    } finally {
      setPurgeLoading(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await DeleteRabbitMQQueue(deleteTarget.vhost, deleteTarget.name, false, false);
      setDeleteTarget(null);
      setDeleteConfirmName('');
      await loadData();
    } catch (err: any) {
      setDeleteError(String(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 select-none">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <Boxes className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Not Connected to RabbitMQ</h3>
          <p className="text-xs text-gray-500 mb-4">
            Connect to a RabbitMQ broker in the Connections tab to view, declare, and manage queues.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d13] select-none">
      {/* Top Toolbar */}
      <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-rose-400" />
            Queues & Metrics
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitor, inspect, declare, and purge RabbitMQ queues across virtual hosts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Virtual Host Filter */}
          <div className="flex items-center gap-1.5 bg-[#141a24] border border-[#232c3d] rounded-lg px-2.5 py-1 text-xs">
            <Database className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-400">vhost:</span>
            <select
              value={selectedVhost}
              onChange={(e) => setSelectedVhost(e.target.value)}
              className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
            >
              <option value="">All Virtual Hosts</option>
              {vhosts.map((vh) => (
                <option key={vh} value={vh} className="bg-[#141a24] text-white">
                  {vh}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141a24] hover:bg-[#1a2332] text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-[#232c3d] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Queue</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Banner */}
      <div className="px-6 py-3 border-b border-[#18202c] bg-[#090d13] grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Queues</div>
            <div className="text-sm font-mono font-bold text-white">{stats.totalQueues}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Ready Messages</div>
            <div className="text-sm font-mono font-bold text-emerald-400">{stats.totalReady.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Unacknowledged</div>
            <div className="text-sm font-mono font-bold text-purple-300">{stats.totalUnack.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Consumers</div>
            <div className="text-sm font-mono font-bold text-white">{stats.totalConsumers}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">DLX Enabled</div>
            <div className="text-sm font-mono font-bold text-amber-300">{stats.dlxCount}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-6 py-3 border-b border-[#18202c] bg-[#0c1017] flex flex-wrap items-center justify-between gap-4">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1 bg-[#131923] p-1 rounded-lg border border-[#232c3d]">
          {[
            { id: 'all', label: `All (${queues.length})` },
            { id: 'classic', label: 'Classic' },
            { id: 'quorum', label: `Quorum (${stats.quorumCount})` },
            { id: 'stream', label: 'Stream' },
            { id: 'dlx', label: `With DLX (${stats.dlxCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                typeFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2332]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queue name or vhost..."
            className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Feedback Alert */}
      {purgeFeedback && (
        <div className="px-6 pt-3">
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
              purgeFeedback.isError
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {purgeFeedback.isError ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              ) : (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              )}
              <span>{purgeFeedback.message}</span>
            </div>
            <button
              onClick={() => setPurgeFeedback(null)}
              className="p-1 rounded text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                <th className="py-2.5 px-4 font-medium">Queue Name</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium">State</th>
                <th className="py-2.5 px-3 font-medium">Messages Ready</th>
                <th className="py-2.5 px-3 font-medium">Unacked</th>
                <th className="py-2.5 px-3 font-medium">Total</th>
                <th className="py-2.5 px-3 font-medium">Consumers</th>
                <th className="py-2.5 px-3 font-medium">Memory</th>
                <th className="py-2.5 px-3 font-medium">DLX</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18202c]">
              {loading && queues.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-500 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-400" />
                    Loading RabbitMQ queues...
                  </td>
                </tr>
              ) : filteredQueues.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-500 text-xs">
                    No queues match your filters.
                  </td>
                </tr>
              ) : (
                filteredQueues.map((q) => (
                  <tr
                    key={`${q.vhost}/${q.name}`}
                    className="hover:bg-[#121822] transition-colors group cursor-pointer"
                    onClick={() => setSelectedDrawerQueue({ vhost: q.vhost, name: q.name })}
                  >
                    <td className="py-3 px-4 font-mono font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[220px]" title={q.name}>
                          {q.name}
                        </span>
                        {q.vhost !== '/' && (
                          <span className="text-[10px] text-gray-500 font-mono">({q.vhost})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                          q.type === 'quorum'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : q.type === 'stream'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {q.type || 'classic'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-400 font-mono text-[11px] capitalize">
                        {q.state || 'running'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                      {q.messagesReady.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-purple-300">
                      {q.messagesUnacknowledged.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-white">
                      {q.messages.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-300">
                      {q.consumers}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-400 text-[11px]">
                      {formatBytes(q.memory)}
                    </td>
                    <td className="py-3 px-3">
                      {q.hasDlx ? (
                        <span
                          className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[10px] font-mono cursor-help"
                          title={`DLX Target: ${q.dlxTarget}${q.dlxRoutingKey ? ' (key: ' + q.dlxRoutingKey + ')' : ''}`}
                        >
                          DLX
                        </span>
                      ) : (
                        <span className="text-gray-600 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {onNavigateToMessages && (
                          <button
                            onClick={() => onNavigateToMessages(q.name)}
                            title="Inspect messages in studio"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2736] transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => setPurgeTarget(q)}
                          title="Purge all messages"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          <Eraser className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setDeleteTarget(q);
                            setDeleteConfirmName('');
                            setDeleteError(null);
                          }}
                          title="Delete queue"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {selectedDrawerQueue && (
        <QueueDetailDrawer
          isOpen={!!selectedDrawerQueue}
          onClose={() => setSelectedDrawerQueue(null)}
          vhost={selectedDrawerQueue.vhost}
          queueName={selectedDrawerQueue.name}
          onNavigateToMessages={(name) => {
            if (onNavigateToMessages) onNavigateToMessages(name);
            setSelectedDrawerQueue(null);
          }}
          onPurge={(vh, name) => {
            const target = queues.find((q) => q.vhost === vh && q.name === name);
            if (target) setPurgeTarget(target);
            setSelectedDrawerQueue(null);
          }}
          onDelete={(vh, name) => {
            const target = queues.find((q) => q.vhost === vh && q.name === name);
            if (target) {
              setDeleteTarget(target);
              setDeleteConfirmName('');
              setDeleteError(null);
            }
            setSelectedDrawerQueue(null);
          }}
          onOpenRedrive={(name) => {
            if (onOpenRedrive) onOpenRedrive(name);
            setSelectedDrawerQueue(null);
          }}
        />
      )}

      {/* Create Queue Modal */}
      {showCreateModal && (
        <CreateQueueModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadData}
          vhosts={vhosts}
          currentVhost={selectedVhost || '/'}
        />
      )}

      {/* Purge Confirmation Modal */}
      {purgeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
          <div className="w-full max-w-md bg-[#0c1017] border border-[#1e2530] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Eraser className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Purge Queue Messages</h3>
                <p className="text-xs text-gray-500 font-mono">{purgeTarget.name}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to purge all <strong className="text-white">{purgeTarget.messages}</strong> message(s) from queue{' '}
              <code className="text-amber-400 font-mono">{purgeTarget.name}</code>? This operation cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPurgeTarget(null)}
                className="px-3.5 py-1.5 bg-[#141a24] hover:bg-[#1a2332] text-gray-300 rounded-lg text-xs font-medium border border-[#232c3d]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePurge}
                disabled={purgeLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                {purgeLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Purge All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
          <div className="w-full max-w-md bg-[#0c1017] border border-[#1e2530] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete Queue</h3>
                <p className="text-xs text-gray-500 font-mono">{deleteTarget.name}</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-gray-300 leading-relaxed">
              This will permanently delete queue <code className="text-rose-400 font-mono">{deleteTarget.name}</code> and all messages stored within it.
              Please type the queue name to confirm:
            </p>

            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={deleteTarget.name}
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 bg-[#141a24] hover:bg-[#1a2332] text-gray-300 rounded-lg text-xs font-medium border border-[#232c3d]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={deleteLoading || deleteConfirmName !== deleteTarget.name}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Queue</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
