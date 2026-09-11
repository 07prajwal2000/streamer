import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  HardDrive,
  Layers,
  Sliders,
  Trash2,
  Eraser,
  Copy,
  Check,
  AlertTriangle,
  Search,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import {
  GetKafkaTopicDetails,
  DeleteKafkaTopic,
  PurgeKafkaTopic,
} from '../../../wailsjs/go/main/App';
import { AlterPartitionsModal } from './AlterPartitionsModal';
import { EditTopicConfigModal } from './EditTopicConfigModal';

interface TopicDetailDrawerProps {
  isOpen: boolean;
  topicName: string | null;
  onClose: () => void;
  onTopicDeleted: () => void;
  onTopicUpdated: () => void;
}

export const TopicDetailDrawer: React.FC<TopicDetailDrawerProps> = ({
  isOpen,
  topicName,
  onClose,
  onTopicDeleted,
  onTopicUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'partitions' | 'configs'>('partitions');
  const [details, setDetails] = useState<kafkamanager.TopicDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Search in configs
  const [configSearch, setConfigSearch] = useState('');
  const [configFilter, setConfigFilter] = useState<'all' | 'dynamic' | 'default'>('all');

  // Modal states
  const [showAlterPartitions, setShowAlterPartitions] = useState(false);
  const [showEditConfigs, setShowEditConfigs] = useState(false);

  // Confirmation prompts
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDetails = async () => {
    if (!topicName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await GetKafkaTopicDetails(topicName);
      setDetails(data);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && topicName) {
      loadDetails();
      setActiveTab('partitions');
      setShowDeleteConfirm(false);
      setShowPurgeConfirm(false);
    }
  }, [isOpen, topicName]);

  if (!isOpen || !topicName) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePurge = async () => {
    setActionLoading(true);
    try {
      await PurgeKafkaTopic(topicName);
      setShowPurgeConfirm(false);
      await loadDetails();
      onTopicUpdated();
    } catch (err: any) {
      alert(`Failed to purge messages: ${err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await DeleteKafkaTopic(topicName);
      setShowDeleteConfirm(false);
      onTopicDeleted();
      onClose();
    } catch (err: any) {
      alert(`Failed to delete topic: ${err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredConfigs = (details?.configs || []).filter((cfg) => {
    const matchesSearch =
      cfg.name.toLowerCase().includes(configSearch.toLowerCase()) ||
      (cfg.value && cfg.value.toLowerCase().includes(configSearch.toLowerCase()));

    if (!matchesSearch) return false;
    if (configFilter === 'dynamic') return cfg.source.toLowerCase().includes('dynamic');
    if (configFilter === 'default') return cfg.source.toLowerCase().includes('default');
    return true;
  });

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex justify-end select-none animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-[#090d13] border-l border-[#1e2530] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white font-mono">{topicName}</h2>
                <button
                  onClick={() => handleCopy(topicName)}
                  title="Copy Topic Name"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {details?.isInternal && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-medium">
                    Internal
                  </span>
                )}
                {details && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                      details.underReplicatedCount > 0
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : 'bg-green-500/15 border-green-500/30 text-green-400'
                    }`}
                  >
                    {details.underReplicatedCount > 0
                      ? `${details.underReplicatedCount} Under-replicated`
                      : 'Healthy'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Topic Details, Partitions & Configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDetails}
              disabled={loading}
              title="Refresh Topic Details"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title="Close Drawer"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Overview Stat Cards */}
        {details && (
          <div className="p-6 pb-2 border-b border-[#1e2530] bg-[#0c1017]/50 grid grid-cols-4 gap-3">
            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Partitions</div>
              <div className="text-xl font-semibold font-mono text-white mt-1">
                {details.partitionsCount}
              </div>
            </div>

            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Replication Factor</div>
              <div className="text-xl font-semibold font-mono text-white mt-1">
                {details.replicationFactor}x
              </div>
            </div>

            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Total Messages</div>
              <div className="text-xl font-semibold font-mono text-orange-400 mt-1">
                {details.totalMessages.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Under-Replicated</div>
              <div
                className={`text-xl font-semibold font-mono mt-1 ${
                  details.underReplicatedCount > 0 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {details.underReplicatedCount}
              </div>
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="px-6 py-2.5 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('partitions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'partitions'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Partitions</span>
              <span className="text-[10px] bg-[#1a212d] px-1.5 py-0.2 rounded-full text-gray-300">
                {details?.partitionsCount || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('configs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'configs'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configuration</span>
              <span className="text-[10px] bg-[#1a212d] px-1.5 py-0.2 rounded-full text-gray-300">
                {details?.configs?.length || 0}
              </span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAlterPartitions(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#151b23] hover:bg-[#1f2733] border border-[#222d3d] flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-orange-400" />
              <span>Expand Partitions</span>
            </button>

            <button
              onClick={() => setShowEditConfigs(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#151b23] hover:bg-[#1f2733] border border-[#222d3d] flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-orange-400" />
              <span>Alter Configs</span>
            </button>

            <button
              onClick={() => setShowPurgeConfirm(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1.5 transition-colors"
              title="Purge all messages in topic by advancing start offset"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Purge</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1.5 transition-colors"
              title="Permanently delete topic"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Confirmation Banner for Purge */}
        {showPurgeConfirm && (
          <div className="p-4 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-300">
                  Are you sure you want to purge messages in "{topicName}"?
                </p>
                <p className="text-[11px] text-amber-300/70 mt-0.5">
                  This advances the start offset of each partition to the current end offset. Historical messages will be discarded.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPurgeConfirm(false)}
                disabled={actionLoading}
                className="px-3 py-1 rounded-lg text-xs text-gray-300 hover:text-white bg-[#151b23] border border-[#222d3d]"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                disabled={actionLoading}
                className="px-3 py-1 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
                <span>Confirm Purge</span>
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Banner for Delete */}
        {showDeleteConfirm && (
          <div className="p-4 bg-red-950/40 border-b border-red-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-300">
                  Permanently delete topic "{topicName}"?
                </p>
                <p className="text-[11px] text-red-300/70 mt-0.5">
                  This action cannot be undone. All topic metadata, partitions, and stored records will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading}
                className="px-3 py-1 rounded-lg text-xs text-gray-300 hover:text-white bg-[#151b23] border border-[#222d3d]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-3 py-1 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-500 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-xs text-red-400 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {loading && !details && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin text-orange-400 mb-3" />
              <span className="text-xs">Loading topic details...</span>
            </div>
          )}

          {/* TAB 1: PARTITIONS */}
          {activeTab === 'partitions' && details && (
            <div className="space-y-4">
              <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#111722] border-b border-[#1e2530] text-gray-400 font-medium">
                      <th className="py-2.5 px-4 font-medium">Partition</th>
                      <th className="py-2.5 px-3 font-medium">Leader</th>
                      <th className="py-2.5 px-3 font-medium">Replicas</th>
                      <th className="py-2.5 px-3 font-medium">ISR (In-Sync)</th>
                      <th className="py-2.5 px-3 font-medium">Start Offset</th>
                      <th className="py-2.5 px-3 font-medium">End Offset</th>
                      <th className="py-2.5 px-3 font-medium text-right">Messages</th>
                      <th className="py-2.5 px-4 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171e2a] font-mono">
                    {details.partitions.map((p) => {
                      const isHealthy = !p.isUnderReplicated && p.offlineReplicas.length === 0;
                      return (
                        <tr
                          key={p.partition}
                          className="hover:bg-[#131a26] transition-colors"
                        >
                          <td className="py-2.5 px-4 font-medium text-white flex items-center gap-2">
                            <span>#{p.partition}</span>
                            {p.isPreferredLeader && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-sans"
                                title="Current leader is the preferred leader"
                              >
                                Preferred
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-300">
                            {p.leader >= 0 ? (
                              <span className="px-2 py-0.5 rounded bg-[#161f2d] text-orange-300 border border-[#233147]">
                                Node {p.leader}
                              </span>
                            ) : (
                              <span className="text-red-400">None (-1)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400">
                            [{p.replicas.join(', ')}]
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`${
                                p.isr.length < p.replicas.length
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-gray-300'
                              }`}
                            >
                              [{p.isr.join(', ')}]
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-400">
                            {p.startOffset.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400">
                            {p.endOffset.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-orange-400 font-medium">
                            {p.messageCount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-center font-sans">
                            {isHealthy ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>OK</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Under-replicated</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGS */}
          {activeTab === 'configs' && details && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={configSearch}
                    onChange={(e) => setConfigSearch(e.target.value)}
                    placeholder="Search configuration properties..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#0c1017] border border-[#1e2530] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#0c1017] p-1 border border-[#1e2530] rounded-xl text-xs">
                  <button
                    onClick={() => setConfigFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      configFilter === 'all'
                        ? 'bg-[#1e2736] text-white font-medium'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    All ({details.configs.length})
                  </button>
                  <button
                    onClick={() => setConfigFilter('dynamic')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      configFilter === 'dynamic'
                        ? 'bg-orange-500/20 text-orange-300 font-medium'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Dynamic
                  </button>
                  <button
                    onClick={() => setConfigFilter('default')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      configFilter === 'default'
                        ? 'bg-[#1e2736] text-white font-medium'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Default
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#111722] border-b border-[#1e2530] text-gray-400 font-medium">
                      <th className="py-2.5 px-4 font-medium">Property Name</th>
                      <th className="py-2.5 px-3 font-medium">Value</th>
                      <th className="py-2.5 px-3 font-medium">Source</th>
                      <th className="py-2.5 px-3 font-medium text-center">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171e2a] font-mono">
                    {filteredConfigs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500 font-sans">
                          No configuration properties matched your search.
                        </td>
                      </tr>
                    ) : (
                      filteredConfigs.map((cfg) => {
                        const isDynamic = cfg.source.toLowerCase().includes('dynamic');
                        return (
                          <tr
                            key={cfg.name}
                            className={`hover:bg-[#131a26] transition-colors ${
                              isDynamic ? 'bg-orange-500/[0.03]' : ''
                            }`}
                          >
                            <td className="py-2.5 px-4 font-medium text-gray-200">
                              <span className={isDynamic ? 'text-orange-300' : ''}>
                                {cfg.name}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-white break-all max-w-xs">
                              {cfg.isSensitive ? (
                                <span className="text-gray-500 italic font-sans">[sensitive]</span>
                              ) : cfg.value === '' || cfg.value === null ? (
                                <span className="text-gray-600 italic font-sans">[empty]</span>
                              ) : (
                                cfg.value
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                  isDynamic
                                    ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                                    : 'bg-[#151b23] border-[#222d3d] text-gray-400'
                                }`}
                              >
                                {cfg.source}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              {cfg.isReadOnly && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700">
                                  Read-Only
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alter Partitions Modal */}
      {showAlterPartitions && details && (
        <AlterPartitionsModal
          isOpen={showAlterPartitions}
          topic={topicName}
          currentPartitions={details.partitionsCount}
          onClose={() => setShowAlterPartitions(false)}
          onUpdated={() => {
            loadDetails();
            onTopicUpdated();
          }}
        />
      )}

      {/* Edit Topic Configs Modal */}
      {showEditConfigs && details && (
        <EditTopicConfigModal
          isOpen={showEditConfigs}
          topic={topicName}
          existingConfigs={details.configs}
          onClose={() => setShowEditConfigs(false)}
          onUpdated={() => {
            loadDetails();
            onTopicUpdated();
          }}
        />
      )}
    </div>
  );
};
