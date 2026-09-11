import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  RefreshCw,
  Users,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Search,
  CheckCircle2,
  Server,
  Layers,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import {
  GetKafkaConsumerGroupDetails,
  DeleteKafkaConsumerGroup,
} from '../../../wailsjs/go/main/App';
import { ResetOffsetsModal } from './ResetOffsetsModal';

interface ConsumerGroupDetailDrawerProps {
  isOpen: boolean;
  groupName: string | null;
  onClose: () => void;
  onGroupDeleted: () => void;
  onGroupUpdated: () => void;
}

export const ConsumerGroupDetailDrawer: React.FC<ConsumerGroupDetailDrawerProps> = ({
  isOpen,
  groupName,
  onClose,
  onGroupDeleted,
  onGroupUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'lag' | 'members'>('lag');
  const [details, setDetails] = useState<kafkamanager.ConsumerGroupDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [topicFilter, setTopicFilter] = useState('');

  // Modals & prompts
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDetails = async () => {
    if (!groupName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await GetKafkaConsumerGroupDetails(groupName);
      setDetails(data);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && groupName) {
      loadDetails();
      setActiveTab('lag');
      setShowDeleteConfirm(false);
      setShowResetModal(false);
    }
  }, [isOpen, groupName]);

  const uniqueTopics = useMemo(() => {
    if (!details?.partitions) return [];
    const set = new Set<string>();
    for (const p of details.partitions) {
      if (p.topic) set.add(p.topic);
    }
    return Array.from(set).sort();
  }, [details]);

  const filteredPartitions = useMemo(() => {
    if (!details?.partitions) return [];
    if (!topicFilter.trim()) return details.partitions;
    return details.partitions.filter((p) =>
      p.topic.toLowerCase().includes(topicFilter.toLowerCase())
    );
  }, [details, topicFilter]);

  if (!isOpen || !groupName) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await DeleteKafkaConsumerGroup(groupName);
      setShowDeleteConfirm(false);
      onGroupDeleted();
      onClose();
    } catch (err: any) {
      alert(`Failed to delete consumer group: ${err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStateBadge = (state: string) => {
    const s = (state || '').toLowerCase();
    if (s === 'stable') {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-500/15 border border-green-500/30 text-green-400">
          Stable
        </span>
      );
    }
    if (s === 'empty') {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-500/15 border border-gray-500/30 text-gray-400">
          Empty
        </span>
      );
    }
    if (s === 'dead') {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/15 border border-red-500/30 text-red-400">
          Dead
        </span>
      );
    }
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/15 border border-amber-500/30 text-amber-400">
        {state || 'Unknown'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex justify-end select-none animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-[#090d13] border-l border-[#1e2530] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white font-mono">{groupName}</h2>
                <button
                  onClick={() => handleCopy(groupName)}
                  title="Copy Group Name"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {details && getStateBadge(details.state)}
                {details && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#161f2d] text-orange-300 border border-[#233147] font-mono">
                    Node {details.coordinator}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Consumer Group Lag & Member Assignments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDetails}
              disabled={loading}
              title="Refresh Details"
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

        {/* Overview Metric Cards */}
        {details && (
          <div className="p-6 pb-2 border-b border-[#1e2530] bg-[#0c1017]/50 grid grid-cols-4 gap-3">
            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Total Lag</div>
              <div
                className={`text-xl font-semibold font-mono mt-1 ${
                  details.totalLag === 0
                    ? 'text-green-400'
                    : details.totalLag > 1000
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {details.totalLag.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Active Members</div>
              <div className="text-xl font-semibold font-mono text-white mt-1">
                {details.members.length}
              </div>
            </div>

            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Assigned Partitions</div>
              <div className="text-xl font-semibold font-mono text-white mt-1">
                {details.partitions.length}
              </div>
            </div>

            <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3">
              <div className="text-[11px] text-gray-400 font-medium">Partition Assignor</div>
              <div className="text-xs font-mono text-gray-300 mt-2 truncate" title={details.protocol}>
                {details.protocol || 'None'}
              </div>
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="px-6 py-2.5 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('lag')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'lag'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Partition Lag</span>
              <span className="text-[10px] bg-[#1a212d] px-1.5 py-0.2 rounded-full text-gray-300">
                {details?.partitions?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#151b23]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Active Members</span>
              <span className="text-[10px] bg-[#1a212d] px-1.5 py-0.2 rounded-full text-gray-300">
                {details?.members?.length || 0}
              </span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetModal(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#151b23] hover:bg-[#1f2733] border border-[#222d3d] flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
              <span>Reset Offsets</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1.5 transition-colors"
              title="Delete inactive consumer group"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Group</span>
            </button>
          </div>
        </div>

        {/* Confirmation Banner for Delete */}
        {showDeleteConfirm && (
          <div className="p-4 bg-red-950/40 border-b border-red-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-300">
                  Delete consumer group "{groupName}"?
                </p>
                <p className="text-[11px] text-red-300/70 mt-0.5">
                  Only Empty or Dead consumer groups can be safely deleted. All committed partition offsets for this group will be discarded.
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

        {/* Content Body */}
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
              <span className="text-xs">Loading consumer group details...</span>
            </div>
          )}

          {/* TAB 1: PARTITION LAG */}
          {activeTab === 'lag' && details && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="relative max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  placeholder="Filter by topic name..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0c1017] border border-[#1e2530] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Table */}
              <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#111722] border-b border-[#1e2530] text-gray-400 font-medium">
                      <th className="py-2.5 px-4 font-medium">Topic</th>
                      <th className="py-2.5 px-3 font-medium">Partition</th>
                      <th className="py-2.5 px-3 font-medium">Consumer Member</th>
                      <th className="py-2.5 px-3 font-medium">Current Offset</th>
                      <th className="py-2.5 px-3 font-medium">End Offset</th>
                      <th className="py-2.5 px-3 font-medium text-right">Lag</th>
                      <th className="py-2.5 px-4 font-medium text-center">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171e2a] font-mono">
                    {filteredPartitions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500 font-sans">
                          No partition lag data available for this consumer group.
                        </td>
                      </tr>
                    ) : (
                      filteredPartitions.map((p) => {
                        const isZeroLag = p.lag === 0;
                        return (
                          <tr key={`${p.topic}-${p.partition}`} className="hover:bg-[#131a26] transition-colors">
                            <td className="py-2.5 px-4 font-medium text-white">{p.topic}</td>
                            <td className="py-2.5 px-3 text-gray-300">#{p.partition}</td>
                            <td className="py-2.5 px-3 text-gray-400 font-sans text-xs">
                              {p.clientId ? (
                                <div className="truncate max-w-[160px]" title={`${p.clientId} (${p.clientHost})`}>
                                  <span className="text-gray-200">{p.clientId}</span>
                                  <span className="text-[10px] text-gray-500 ml-1">({p.clientHost})</span>
                                </div>
                              ) : (
                                <span className="text-gray-600 italic">unassigned</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-gray-400">
                              {p.currentOffset >= 0 ? p.currentOffset.toLocaleString() : 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-400">
                              {p.endOffset >= 0 ? p.endOffset.toLocaleString() : 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`font-semibold ${
                                  isZeroLag
                                    ? 'text-green-400'
                                    : p.lag > 1000
                                    ? 'text-red-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {p.lag >= 0 ? p.lag.toLocaleString() : 'N/A'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center font-sans">
                              {isZeroLag ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>In Sync</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Behind</span>
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

          {/* TAB 2: ACTIVE MEMBERS */}
          {activeTab === 'members' && details && (
            <div className="space-y-4">
              <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#111722] border-b border-[#1e2530] text-gray-400 font-medium">
                      <th className="py-2.5 px-4 font-medium">Client ID</th>
                      <th className="py-2.5 px-3 font-medium">Host Address</th>
                      <th className="py-2.5 px-3 font-medium">Member ID</th>
                      <th className="py-2.5 px-4 font-medium">Assigned Partitions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171e2a]">
                    {details.members.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500 font-sans">
                          No active consumer members currently connected.
                        </td>
                      </tr>
                    ) : (
                      details.members.map((mbr) => (
                        <tr key={mbr.memberId} className="hover:bg-[#131a26] transition-colors">
                          <td className="py-2.5 px-4 font-medium text-white font-mono">{mbr.clientId}</td>
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{mbr.clientHost}</td>
                          <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px] truncate max-w-xs" title={mbr.memberId}>
                            {mbr.memberId}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(mbr.assignedPartitions).map(([t, parts]) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-2 py-0.5 rounded bg-[#161f2d] border border-[#233147] text-orange-300 font-mono"
                                >
                                  {t} [{parts.join(', ')}]
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reset Offsets Modal */}
      {showResetModal && details && (
        <ResetOffsetsModal
          isOpen={showResetModal}
          group={groupName}
          groupState={details.state}
          topics={uniqueTopics}
          onClose={() => setShowResetModal(false)}
          onReset={() => {
            loadDetails();
            onGroupUpdated();
          }}
        />
      )}
    </div>
  );
};
