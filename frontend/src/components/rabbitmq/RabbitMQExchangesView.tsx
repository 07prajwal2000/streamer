import React, { useState, useEffect, useMemo } from 'react';
import {
  GitFork,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Link,
  Send,
  Database,
  Layers,
  Activity,
  Boxes,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import {
  ListRabbitMQExchanges,
  ListRabbitMQVHosts,
  ListRabbitMQQueues,
  DeleteRabbitMQExchange,
} from '../../../wailsjs/go/main/App';
import { CreateExchangeModal } from './CreateExchangeModal';
import { ExchangeDetailDrawer } from './ExchangeDetailDrawer';
import { BindingModal } from './BindingModal';

interface RabbitMQExchangesViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
  onNavigateToPublish?: (exchange: string) => void;
}

export const RabbitMQExchangesView: React.FC<RabbitMQExchangesViewProps> = ({
  isConnected,
  isActiveTab,
  onNavigateToPublish,
}) => {
  const [exchanges, setExchanges] = useState<rabbitmqmanager.RMQExchangeSummary[]>([]);
  const [vhosts, setVhosts] = useState<string[]>(['/']);
  const [selectedVhost, setSelectedVhost] = useState<string>(''); // empty string = all vhosts
  const [queues, setQueues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'fanout' | 'topic' | 'headers' | 'internal'>('all');

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDrawerExchange, setSelectedDrawerExchange] = useState<{ vhost: string; name: string } | null>(null);
  const [bindingSourceExchange, setBindingSourceExchange] = useState<string | null>(null);

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState<rabbitmqmanager.RMQExchangeSummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const [exData, vhData, qData] = await Promise.all([
        ListRabbitMQExchanges(selectedVhost),
        ListRabbitMQVHosts().catch(() => []),
        ListRabbitMQQueues(selectedVhost).catch(() => []),
      ]);

      setExchanges(exData || []);
      if (vhData && vhData.length > 0) {
        setVhosts(vhData.map((v) => v.name));
      }
      if (qData) {
        setQueues(qData.map((q) => q.name));
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

  const filteredExchanges = useMemo(() => {
    return exchanges.filter((ex) => {
      // Type filter
      if (typeFilter === 'direct' && ex.type !== 'direct') return false;
      if (typeFilter === 'fanout' && ex.type !== 'fanout') return false;
      if (typeFilter === 'topic' && ex.type !== 'topic') return false;
      if (typeFilter === 'headers' && ex.type !== 'headers') return false;
      if (typeFilter === 'internal' && !ex.internal) return false;

      // Search filter
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const displayName = ex.name === '' ? '(amqp default)' : ex.name.toLowerCase();
      return (
        displayName.includes(term) ||
        ex.type.toLowerCase().includes(term) ||
        (ex.vhost && ex.vhost.toLowerCase().includes(term))
      );
    });
  }, [exchanges, typeFilter, search]);

  const stats = useMemo(() => {
    let directCount = 0;
    let fanoutCount = 0;
    let topicCount = 0;
    let headersCount = 0;

    for (const ex of exchanges) {
      if (ex.type === 'direct') directCount++;
      else if (ex.type === 'fanout') fanoutCount++;
      else if (ex.type === 'topic') topicCount++;
      else if (ex.type === 'headers') headersCount++;
    }

    return {
      total: exchanges.length,
      directCount,
      fanoutCount,
      topicCount,
      headersCount,
    };
  }, [exchanges]);

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await DeleteRabbitMQExchange(deleteTarget.vhost, deleteTarget.name, false);
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
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 text-blue-400">
            <GitFork className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Not Connected to RabbitMQ</h3>
          <p className="text-xs text-gray-500 mb-4">
            Connect to a RabbitMQ broker in the Connections tab to view, declare, and bind exchanges.
          </p>
        </div>
      </div>
    );
  }

  const exchangeNames = exchanges.map((e) => (e.name === '' ? '(AMQP default)' : e.name));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d13] select-none">
      {/* Top Toolbar */}
      <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <GitFork className="w-5 h-5 text-blue-400" />
            Exchanges & Bindings
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage AMQP exchange topologies, routing types, and queue bindings
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
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Exchange</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Banner */}
      <div className="px-6 py-3 border-b border-[#18202c] bg-[#090d13] grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Exchanges</div>
            <div className="text-sm font-mono font-bold text-white">{stats.total}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Direct</div>
            <div className="text-sm font-mono font-bold text-emerald-400">{stats.directCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Topic</div>
            <div className="text-sm font-mono font-bold text-purple-300">{stats.topicCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Fanout</div>
            <div className="text-sm font-mono font-bold text-amber-300">{stats.fanoutCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Headers</div>
            <div className="text-sm font-mono font-bold text-rose-400">{stats.headersCount}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-6 py-3 border-b border-[#18202c] bg-[#0c1017] flex flex-wrap items-center justify-between gap-4">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1 bg-[#131923] p-1 rounded-lg border border-[#232c3d]">
          {[
            { id: 'all', label: `All (${exchanges.length})` },
            { id: 'direct', label: `Direct (${stats.directCount})` },
            { id: 'topic', label: `Topic (${stats.topicCount})` },
            { id: 'fanout', label: `Fanout (${stats.fanoutCount})` },
            { id: 'headers', label: `Headers (${stats.headersCount})` },
            { id: 'internal', label: 'Internal' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                typeFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
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
            placeholder="Search exchange name or type..."
            className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                <th className="py-2.5 px-4 font-medium">Exchange Name</th>
                <th className="py-2.5 px-3 font-medium">Routing Type</th>
                <th className="py-2.5 px-3 font-medium">Virtual Host</th>
                <th className="py-2.5 px-3 font-medium">Durability</th>
                <th className="py-2.5 px-3 font-medium">Auto-Delete</th>
                <th className="py-2.5 px-3 font-medium">Internal</th>
                <th className="py-2.5 px-3 font-medium">Publish Rate</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18202c]">
              {loading && exchanges.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading RabbitMQ exchanges...
                  </td>
                </tr>
              ) : filteredExchanges.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 text-xs">
                    No exchanges match your filters.
                  </td>
                </tr>
              ) : (
                filteredExchanges.map((ex) => {
                  const isDefault = ex.name === '';
                  return (
                    <tr
                      key={`${ex.vhost}/${ex.name}`}
                      className="hover:bg-[#121822] transition-colors group cursor-pointer"
                      onClick={() => setSelectedDrawerExchange({ vhost: ex.vhost, name: ex.name })}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[240px]">
                            {isDefault ? (
                              <span className="text-gray-400 italic">(AMQP default)</span>
                            ) : (
                              ex.name
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                            ex.type === 'direct'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : ex.type === 'topic'
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : ex.type === 'fanout'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {ex.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-400 text-[11px]">{ex.vhost}</td>
                      <td className="py-3 px-3 text-gray-300">
                        {ex.durable ? 'Durable' : 'Transient'}
                      </td>
                      <td className="py-3 px-3 text-gray-400">{ex.autoDelete ? 'Yes' : 'No'}</td>
                      <td className="py-3 px-3">
                        {ex.internal ? (
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                            Internal
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">No</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-white">
                        {ex.messageRates?.publishRate?.toFixed(1) || '0.0'} /s
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {!isDefault && (
                            <button
                              onClick={() => setBindingSourceExchange(ex.name)}
                              title="Add binding from this exchange"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            >
                              <Link className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isDefault && !ex.internal && onNavigateToPublish && (
                            <button
                              onClick={() => onNavigateToPublish(ex.name)}
                              title="Publish message to exchange"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2736] transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isDefault && !ex.name.startsWith('amq.') && (
                            <button
                              onClick={() => {
                                setDeleteTarget(ex);
                                setDeleteConfirmName('');
                                setDeleteError(null);
                              }}
                              title="Delete exchange"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exchange Detail Drawer */}
      {selectedDrawerExchange && (
        <ExchangeDetailDrawer
          isOpen={!!selectedDrawerExchange}
          onClose={() => setSelectedDrawerExchange(null)}
          vhost={selectedDrawerExchange.vhost}
          exchangeName={selectedDrawerExchange.name}
          onOpenBindingModal={(source) => {
            setBindingSourceExchange(source);
            setSelectedDrawerExchange(null);
          }}
          onDelete={(vh, name) => {
            const target = exchanges.find((e) => e.vhost === vh && e.name === name);
            if (target) {
              setDeleteTarget(target);
              setDeleteConfirmName('');
              setDeleteError(null);
            }
            setSelectedDrawerExchange(null);
          }}
          onPublishToExchange={(ex) => {
            if (onNavigateToPublish) onNavigateToPublish(ex);
            setSelectedDrawerExchange(null);
          }}
        />
      )}

      {/* Create Exchange Modal */}
      {showCreateModal && (
        <CreateExchangeModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadData}
          vhosts={vhosts}
          currentVhost={selectedVhost || '/'}
        />
      )}

      {/* Binding Modal */}
      {bindingSourceExchange !== null && (
        <BindingModal
          isOpen={bindingSourceExchange !== null}
          onClose={() => setBindingSourceExchange(null)}
          onCreated={loadData}
          vhost={selectedVhost || '/'}
          initialSourceExchange={bindingSourceExchange}
          availableExchanges={exchangeNames}
          availableQueues={queues}
        />
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
                <h3 className="text-sm font-semibold text-white">Delete Exchange</h3>
                <p className="text-xs text-gray-500 font-mono">{deleteTarget.name}</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to delete exchange <code className="text-rose-400 font-mono">{deleteTarget.name}</code>?
              All associated bindings from and to this exchange will be automatically removed.
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
                <span>Delete Exchange</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
