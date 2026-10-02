import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Activity,
  Users,
  MessageSquare,
  Shield,
  Trash2,
  Eraser,
  RefreshCw,
  ExternalLink,
  Clock,
  ArrowRight,
  Database,
  Radio,
  Boxes,
  RotateCcw,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import { GetRabbitMQQueueDetails } from '../../../wailsjs/go/main/App';

interface QueueDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vhost: string;
  queueName: string;
  onNavigateToMessages: (queueName: string) => void;
  onPurge?: (vhost: string, queueName: string) => void;
  onDelete?: (vhost: string, queueName: string) => void;
  onOpenRedrive?: (queueName: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const QueueDetailDrawer: React.FC<QueueDetailDrawerProps> = ({
  isOpen,
  onClose,
  vhost,
  queueName,
  onNavigateToMessages,
  onPurge,
  onDelete,
  onOpenRedrive,
}) => {
  const [detail, setDetail] = useState<rabbitmqmanager.RMQQueueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'consumers' | 'bindings' | 'args'>('overview');

  const loadDetails = async () => {
    if (!vhost || !queueName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await GetRabbitMQQueueDetails(vhost, queueName);
      setDetail(data);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && vhost && queueName) {
      loadDetails();
      setActiveTab('overview');
    }
  }, [isOpen, vhost, queueName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm select-none">
      <div className="w-full max-w-2xl bg-[#090d13] border-l border-[#1e2530] flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white truncate font-mono">{queueName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#18202c] text-rose-300 border border-[#222c3c]">
                  {detail?.type || 'classic'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono">vhost: {vhost}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDetails}
              disabled={loading}
              title="Refresh details"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Header */}
        <div className="px-6 border-b border-[#1e2530] bg-[#0c1017] flex gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Overview & Metrics
          </button>
          <button
            onClick={() => setActiveTab('consumers')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'consumers'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Consumers</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#18202c] text-gray-300">
              {detail?.consumersList?.length || detail?.consumers || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('bindings')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'bindings'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Bindings</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#18202c] text-gray-300">
              {detail?.bindings?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('args')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'args'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Queue Arguments
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          {activeTab === 'overview' && detail && (
            <div className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Total Messages</span>
                  <div className="text-xl font-mono font-bold text-white mt-1">
                    {detail.messages.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-gray-500">Ready + unacknowledged</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Ready</span>
                  <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                    {detail.messagesReady.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-gray-500">Delivered immediately</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Unacked</span>
                  <div className="text-xl font-mono font-bold text-purple-300 mt-1">
                    {detail.messagesUnacknowledged.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-gray-500">In-flight at consumer</span>
                </div>
              </div>

              {/* Message Rates Grid */}
              {detail.messageRates && (
                <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530] space-y-2">
                  <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    Throughput Rates
                  </span>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="p-2.5 rounded-lg bg-[#121822] border border-[#1a2332]">
                      <span className="text-[10px] text-gray-500 block">Publish</span>
                      <span className="text-xs font-mono font-bold text-white">
                        {detail.messageRates.publishRate.toFixed(1)} /s
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#121822] border border-[#1a2332]">
                      <span className="text-[10px] text-gray-500 block">Deliver</span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {detail.messageRates.deliverRate.toFixed(1)} /s
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#121822] border border-[#1a2332]">
                      <span className="text-[10px] text-gray-500 block">Ack</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {detail.messageRates.ackRate.toFixed(1)} /s
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Dead Letter Exchange Alert & Redrive Action */}
              {detail.hasDlx && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Dead Letter Exchange Configured
                    </span>
                    <p className="text-[11px] text-gray-300 mt-0.5 font-mono">
                      Target Exchange: <span className="text-white font-semibold">{detail.dlxTarget}</span>
                      {detail.dlxRoutingKey && (
                        <span> · Routing Key: <span className="text-white">{detail.dlxRoutingKey}</span></span>
                      )}
                    </p>
                  </div>

                  {onOpenRedrive && (
                    <button
                      onClick={() => onOpenRedrive(queueName)}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Redrive Messages</span>
                    </button>
                  )}
                </div>
              )}

              {/* Configuration Specification List */}
              <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530] space-y-3">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Queue Attributes
                </h3>

                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="text-gray-400">Durability</div>
                  <div className="font-mono text-white">
                    {detail.durable ? 'Durable (Persistent on disk)' : 'Transient (Memory only)'}
                  </div>

                  <div className="text-gray-400">Auto-Delete</div>
                  <div className="font-mono text-white">{detail.autoDelete ? 'Yes' : 'No'}</div>

                  <div className="text-gray-400">Exclusive</div>
                  <div className="font-mono text-white">{detail.exclusive ? 'Yes' : 'No'}</div>

                  <div className="text-gray-400">State</div>
                  <div className="font-mono text-emerald-400 capitalize">{detail.state || 'running'}</div>

                  <div className="text-gray-400">Memory Footprint</div>
                  <div className="font-mono text-white">{formatBytes(detail.memory)}</div>

                  {detail.leaderNode && (
                    <>
                      <div className="text-gray-400">Leader / Node</div>
                      <div className="font-mono text-rose-300">{detail.leaderNode}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'consumers' && detail && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-rose-400" />
                Active Consumers ({detail.consumersList?.length || 0})
              </h3>

              <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                      <th className="py-2 px-3 font-medium">Consumer Tag</th>
                      <th className="py-2 px-3 font-medium">Prefetch</th>
                      <th className="py-2 px-3 font-medium">Ack Req</th>
                      <th className="py-2 px-3 font-medium">Channel PID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#18202c]">
                    {!detail.consumersList || detail.consumersList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500 text-xs">
                          No active consumers attached to this queue
                        </td>
                      </tr>
                    ) : (
                      detail.consumersList.map((c) => (
                        <tr key={c.consumerTag} className="hover:bg-[#121822]">
                          <td className="py-2.5 px-3 font-mono font-medium text-white truncate max-w-[200px]" title={c.consumerTag}>
                            {c.consumerTag}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-300">{c.prefetch}</td>
                          <td className="py-2.5 px-3">
                            {c.ackRequired ? (
                              <span className="text-amber-400 text-[10px]">Manual Ack</span>
                            ) : (
                              <span className="text-emerald-400 text-[10px]">Auto Ack</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-400 text-[11px]">{c.channelPid}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'bindings' && detail && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Inbound Bindings ({detail.bindings?.length || 0})
              </h3>

              <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                      <th className="py-2 px-3 font-medium">Source Exchange</th>
                      <th className="py-2 px-3 font-medium">Routing Key</th>
                      <th className="py-2 px-3 font-medium">Arguments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#18202c]">
                    {!detail.bindings || detail.bindings.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-gray-500 text-xs">
                          No custom bindings (bound only to default exchange via queue name)
                        </td>
                      </tr>
                    ) : (
                      detail.bindings.map((b, idx) => (
                        <tr key={idx} className="hover:bg-[#121822]">
                          <td className="py-2.5 px-3 font-mono text-white">
                            {b.source === '' ? '(AMQP default)' : b.source}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-rose-300">{b.routingKey || '(none)'}</td>
                          <td className="py-2.5 px-3 font-mono text-gray-400 text-[11px]">
                            {b.arguments && Object.keys(b.arguments).length > 0
                              ? JSON.stringify(b.arguments)
                              : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'args' && detail && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Custom Queue Arguments (x-arguments)
              </h3>
              {detail.arguments && Object.keys(detail.arguments).length > 0 ? (
                <div className="p-4 rounded-xl bg-[#0c1017] border border-[#1e2530] font-mono text-xs text-rose-300 overflow-x-auto">
                  <pre>{JSON.stringify(detail.arguments, null, 2)}</pre>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-gray-500 rounded-xl bg-[#0e131b] border border-[#1e2530]">
                  No custom arguments declared for this queue.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1e2530] bg-[#0c1017] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onPurge && (
              <button
                onClick={() => onPurge(vhost, queueName)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-lg transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Purge</span>
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => onDelete(vhost, queueName)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <button
            onClick={() => {
              onNavigateToMessages(queueName);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Inspect Messages</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
