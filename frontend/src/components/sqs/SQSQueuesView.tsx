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
  Mail,
  Filter,
  ArrowRight,
  Info,
  Check,
  Copy,
} from 'lucide-react';
import { sqsmanager } from '../../../wailsjs/go/models';
import {
  ListSQSQueues,
  PurgeSQSQueue,
  DeleteSQSQueue,
} from '../../../wailsjs/go/main/App';
import { CreateQueueModal } from './CreateQueueModal';
import { QueueDetailDrawer } from './QueueDetailDrawer';

interface SQSQueuesViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
  onNavigateToMessages?: (queueUrl: string) => void;
}

export const SQSQueuesView: React.FC<SQSQueuesViewProps> = ({
  isConnected,
  isActiveTab,
  onNavigateToMessages,
}) => {
  const [queues, setQueues] = useState<sqsmanager.SQSQueueSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'standard' | 'fifo' | 'dlq'>('all');

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQueueUrl, setSelectedQueueUrl] = useState<string | null>(null);

  // Quick Action confirmation states
  const [purgeTarget, setPurgeTarget] = useState<sqsmanager.SQSQueueSummary | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<sqsmanager.SQSQueueSummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadQueues = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ListSQSQueues('');
      setQueues(data || []);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadQueues();
    }
  }, [isConnected, isActiveTab]);

  const filteredQueues = useMemo(() => {
    return queues.filter((q) => {
      // Type filter
      if (typeFilter === 'standard' && q.isFifo) return false;
      if (typeFilter === 'fifo' && !q.isFifo) return false;
      if (typeFilter === 'dlq' && !q.isDeadLetterQueue) return false;

      // Search
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        q.queueName.toLowerCase().includes(term) ||
        (q.queueArn && q.queueArn.toLowerCase().includes(term))
      );
    });
  }, [queues, typeFilter, search]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    let totalMessages = 0;
    let totalInFlight = 0;
    let totalDelayed = 0;
    let fifoCount = 0;
    let dlqCount = 0;

    for (const q of queues) {
      totalMessages += q.approximateNumberOfMessages || 0;
      totalInFlight += q.approximateNumberOfNotVisible || 0;
      totalDelayed += q.approximateNumberOfDelayed || 0;
      if (q.isFifo) fifoCount++;
      if (q.isDeadLetterQueue) dlqCount++;
    }

    return {
      totalQueues: queues.length,
      totalMessages,
      totalInFlight,
      totalDelayed,
      fifoCount,
      dlqCount,
    };
  }, [queues]);

  const handleExecutePurge = async () => {
    if (!purgeTarget) return;
    setPurgeLoading(true);
    setPurgeFeedback(null);
    try {
      await PurgeSQSQueue(purgeTarget.queueUrl);
      setPurgeFeedback({
        message: `Queue '${purgeTarget.queueName}' purge initiated. Note: AWS enforces a 60s cooldown.`,
        isError: false,
      });
      setPurgeTarget(null);
      await loadQueues();
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
      await DeleteSQSQueue(deleteTarget.queueUrl);
      setDeleteTarget(null);
      setDeleteConfirmName('');
      await loadQueues();
    } catch (err: any) {
      setDeleteError(String(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatRetention = (seconds: number) => {
    if (!seconds) return '-';
    const days = Math.round(seconds / 86400);
    if (days >= 1) return `${days}d`;
    const hours = Math.round(seconds / 3600);
    return `${hours}h`;
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 select-none">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4 text-orange-400">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Not Connected to SQS</h3>
          <p className="text-xs text-gray-500 mb-4">
            Connect to an Amazon SQS endpoint or local emulator (LocalStack, ElasticMQ) in the Connection tab to inspect and manage queues.
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
            <Layers className="w-5 h-5 text-orange-400" />
            Queues & Metrics
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitor, inspect, create, and manage Amazon SQS queues
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadQueues}
            disabled={loading}
            title="Refresh Queues"
            className="p-2 rounded-xl bg-[#151b23] border border-[#222d3d] text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium text-xs shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Queue
          </button>
        </div>
      </div>

      {/* Metric Cards Ribbon */}
      <div className="px-6 py-3 border-b border-[#1e2530] bg-[#0a0e14]">
        <div className="grid grid-cols-5 gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-[#0f141c] border border-[#1e2530]">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 block mb-0.5">
              Total Queues
            </span>
            <div className="text-lg font-bold text-white font-mono">{stats.totalQueues}</div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-orange-400 block mb-0.5">
              Available Msgs
            </span>
            <div className="text-lg font-bold text-white font-mono">
              {stats.totalMessages.toLocaleString()}
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400 block mb-0.5">
              In-Flight Msgs
            </span>
            <div className="text-lg font-bold text-white font-mono">
              {stats.totalInFlight.toLocaleString()}
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 block mb-0.5">
              Delayed Msgs
            </span>
            <div className="text-lg font-bold text-white font-mono">
              {stats.totalDelayed.toLocaleString()}
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-[#0f141c] border border-[#1e2530]">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block mb-0.5">
              FIFO / DLQ
            </span>
            <div className="text-lg font-bold text-white font-mono">
              {stats.fifoCount} <span className="text-xs text-gray-500 font-normal">FIFO</span> /{' '}
              {stats.dlqCount} <span className="text-xs text-gray-500 font-normal">DLQ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter queues by name or ARN..."
            className="w-full pl-9 pr-4 py-1.5 bg-[#0f141c] border border-[#1e2530] rounded-xl text-white text-xs placeholder-gray-600 focus:outline-hidden focus:border-orange-500/50"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: 'All Queues' },
            { id: 'standard', label: 'Standard' },
            { id: 'fifo', label: 'FIFO Only' },
            { id: 'dlq', label: 'DLQ Only' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setTypeFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === pill.id
                  ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                  : 'bg-[#0f141c] border-[#1e2530] text-gray-400 hover:text-white'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Banner */}
      {purgeFeedback && (
        <div
          className={`mx-6 mt-3 p-3 rounded-xl border flex items-center justify-between text-xs ${
            purgeFeedback.isError
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-green-500/10 border-green-500/30 text-green-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {purgeFeedback.isError ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{purgeFeedback.message}</span>
          </div>
          <button
            onClick={() => setPurgeFeedback(null)}
            className="p-1 hover:opacity-75"
          >
            &times;
          </button>
        </div>
      )}

      {/* Queues Table Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error ? (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold mb-1">Failed to list SQS queues</p>
              <p>{error}</p>
            </div>
            <button
              onClick={loadQueues}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium"
            >
              Retry
            </button>
          </div>
        ) : filteredQueues.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-[#151b23] border border-[#222d3d] flex items-center justify-center mx-auto mb-3 text-gray-500">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-300 mb-1">No queues found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              {search.trim() || typeFilter !== 'all'
                ? 'No queues match your current filters. Try changing your search keywords or filter tab.'
                : 'No SQS queues exist in this AWS account or local emulator yet. Create your first queue to get started.'}
            </p>
            {typeFilter === 'all' && !search.trim() && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create SQS Queue
              </button>
            )}
          </div>
        ) : (
          <div className="border border-[#1e2530] rounded-2xl overflow-hidden bg-[#0c1017]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090d13] text-gray-400 border-b border-[#1e2530]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Queue Name</th>
                  <th className="py-3 px-4 font-semibold text-right">Available</th>
                  <th className="py-3 px-4 font-semibold text-right">In-Flight</th>
                  <th className="py-3 px-4 font-semibold text-right">Delayed</th>
                  <th className="py-3 px-4 font-semibold text-center">Visibility</th>
                  <th className="py-3 px-4 font-semibold text-center">Retention</th>
                  <th className="py-3 px-4 font-semibold text-center">Encryption</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2530]">
                {filteredQueues.map((q) => (
                  <tr
                    key={q.queueUrl}
                    className="hover:bg-[#121822] transition-colors cursor-pointer group"
                    onClick={() => setSelectedQueueUrl(q.queueUrl)}
                  >
                    {/* Name & Badges */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-white group-hover:text-orange-300 transition-colors">
                          {q.queueName}
                        </span>
                        {q.isFifo && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/15 border border-orange-500/30 text-orange-400 font-mono font-medium">
                            FIFO
                          </span>
                        )}
                        {q.isDeadLetterQueue && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400 font-medium">
                            DLQ
                          </span>
                        )}
                        {q.hasRedrivePolicy && (
                          <span
                            title={`Redrive configured -> ${q.deadLetterTargetArn}`}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-green-500/15 border border-green-500/30 text-green-400 font-medium"
                          >
                            Redrive
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono truncate max-w-md mt-0.5">
                        {q.queueUrl}
                      </div>
                    </td>

                    {/* Available */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-orange-400">
                      {q.approximateNumberOfMessages?.toLocaleString() ?? 0}
                    </td>

                    {/* In Flight */}
                    <td className="py-3 px-4 text-right font-mono text-blue-400">
                      {q.approximateNumberOfNotVisible?.toLocaleString() ?? 0}
                    </td>

                    {/* Delayed */}
                    <td className="py-3 px-4 text-right font-mono text-amber-400">
                      {q.approximateNumberOfDelayed?.toLocaleString() ?? 0}
                    </td>

                    {/* Visibility */}
                    <td className="py-3 px-4 text-center font-mono text-gray-300">
                      {q.visibilityTimeoutSeconds}s
                    </td>

                    {/* Retention */}
                    <td className="py-3 px-4 text-center font-mono text-gray-300">
                      {formatRetention(q.messageRetentionSeconds)}
                    </td>

                    {/* Encryption */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          q.serverSideEncryption === 'SSE-KMS'
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                            : q.serverSideEncryption === 'SSE-SQS'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-gray-800 border-gray-700 text-gray-500'
                        }`}
                      >
                        {q.serverSideEncryption || 'None'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Messages Navigation */}
                        {onNavigateToMessages && (
                          <button
                            onClick={() => onNavigateToMessages(q.queueUrl)}
                            title="Inspect / Produce Messages"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-400 hover:bg-[#1a2230] transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}

                        {/* Inspect Details */}
                        <button
                          onClick={() => setSelectedQueueUrl(q.queueUrl)}
                          title="Inspect Queue Details"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        {/* Purge */}
                        <button
                          onClick={() => setPurgeTarget(q)}
                          title="Purge Queue"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-[#1a2230] transition-colors"
                        >
                          <Eraser className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            setDeleteTarget(q);
                            setDeleteConfirmName('');
                            setDeleteError(null);
                          }}
                          title="Delete Queue"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-[#1a2230] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Queue Modal */}
      {showCreateModal && (
        <CreateQueueModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            loadQueues();
          }}
          existingQueues={queues}
        />
      )}

      {/* Queue Details Drawer */}
      {selectedQueueUrl && (
        <QueueDetailDrawer
          isOpen={Boolean(selectedQueueUrl)}
          queueUrl={selectedQueueUrl}
          onClose={() => setSelectedQueueUrl(null)}
          onQueueDeleted={() => {
            setSelectedQueueUrl(null);
            loadQueues();
          }}
          onQueueUpdated={() => {
            loadQueues();
          }}
          onNavigateToMessages={(url) => {
            setSelectedQueueUrl(null);
            if (onNavigateToMessages) onNavigateToMessages(url);
          }}
        />
      )}

      {/* Purge Modal Dialog */}
      {purgeTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="bg-[#090d13] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Eraser className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Purge Queue Messages</h3>
                <p className="text-xs text-gray-500">60-second cooldown rate limit</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to purge all messages from queue{' '}
              <strong className="text-white font-mono">{purgeTarget.queueName}</strong>? All available, in-flight, and delayed messages will be deleted.
            </p>

            <div className="p-3 bg-amber-500/[0.05] border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
              Note: SQS enforces a strict 60-second cooldown period between purges for the same queue.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPurgeTarget(null)}
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeLoading}
                onClick={handleExecutePurge}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {purgeLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="bg-[#090d13] border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete SQS Queue</h3>
                <p className="text-xs text-gray-500">Irreversible action</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-gray-300 leading-relaxed">
              This will permanently delete <strong className="text-white font-mono">{deleteTarget.queueName}</strong> and all messages stored within it.
            </p>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">
                Type the queue name <code className="text-red-400 font-mono font-bold">{deleteTarget.queueName}</code> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget.queueName}
                className="w-full px-3 py-1.5 bg-[#0c1017] border border-[#1e2530] rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-red-500/50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmName('');
                }}
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading || deleteConfirmName !== deleteTarget.queueName}
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
