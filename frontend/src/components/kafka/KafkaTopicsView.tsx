import React, { useState, useEffect, useMemo } from 'react';
import {
  HardDrive,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Layers,
  Shield,
  Eye,
  EyeOff,
  Filter,
  ArrowRight,
  Database,
  ExternalLink,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { ListKafkaTopics } from '../../../wailsjs/go/main/App';
import { CreateTopicModal } from './CreateTopicModal';
import { TopicDetailDrawer } from './TopicDetailDrawer';

interface KafkaTopicsViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
}

function formatRetention(retentionMsStr?: string): string {
  if (!retentionMsStr) return '-';
  const ms = parseInt(retentionMsStr, 10);
  if (isNaN(ms)) return retentionMsStr;
  if (ms === -1) return 'Infinite';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  const days = Math.round(ms / 86400000);
  return `${days}d`;
}

export const KafkaTopicsView: React.FC<KafkaTopicsViewProps> = ({
  isConnected,
  isActiveTab,
}) => {
  const [topics, setTopics] = useState<kafkamanager.TopicSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInternal, setShowInternal] = useState(false);

  // Modals & drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const loadTopics = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ListKafkaTopics(showInternal);
      setTopics(data || []);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadTopics();
    }
  }, [isConnected, isActiveTab, showInternal]);

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      if (!showInternal && t.isInternal) return false;
      if (!search.trim()) return true;
      return t.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [topics, showInternal, search]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    let totalPartitions = 0;
    let totalMessages = 0;
    let underReplicatedCount = 0;
    let internalCount = 0;

    for (const t of topics) {
      totalPartitions += t.partitionsCount;
      totalMessages += t.totalMessages;
      if (t.underReplicatedCount > 0) {
        underReplicatedCount += t.underReplicatedCount;
      }
      if (t.isInternal) {
        internalCount++;
      }
    }

    return {
      totalTopics: topics.length,
      userTopics: topics.length - internalCount,
      internalCount,
      totalPartitions,
      totalMessages,
      underReplicatedCount,
    };
  }, [topics]);

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-[#090d13]">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4">
          <HardDrive className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Kafka Disconnected</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">
          Connect to a Kafka cluster or compatible streaming broker (Redpanda, WarpStream, AWS MSK) to manage topics and inspect partitions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d13] select-none min-w-0 overflow-hidden">
      {/* Top Header */}
      <div className="h-14 px-6 border-b border-[#1e2530] flex items-center justify-between bg-[#0c1017]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Topics & Partitions</h1>
            <p className="text-[11px] text-gray-400">Manage Kafka topics, inspect offsets, and alter partitions</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTopics}
            disabled={loading}
            title="Refresh Topics"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] border border-transparent hover:border-[#1e2530] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Topic</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="p-6 pb-4 grid grid-cols-4 gap-4 bg-[#0c1017]/40 border-b border-[#1e2530]">
        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Total Topics</span>
            <HardDrive className="w-4 h-4 text-orange-400/80" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {stats.totalTopics}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {stats.userTopics} user &bull; {stats.internalCount} internal
          </div>
        </div>

        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Total Partitions</span>
            <Layers className="w-4 h-4 text-blue-400/80" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {stats.totalPartitions}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Distributed across cluster
          </div>
        </div>

        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Total Messages</span>
            <Database className="w-4 h-4 text-emerald-400/80" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {stats.totalMessages.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Available across all partitions
          </div>
        </div>

        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Under-Replicated</span>
            <AlertTriangle className={`w-4 h-4 ${stats.underReplicatedCount > 0 ? 'text-red-400' : 'text-gray-500'}`} />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              stats.underReplicatedCount > 0 ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {stats.underReplicatedCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {stats.underReplicatedCount > 0 ? 'Requires attention' : 'All partitions in-sync'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics by name..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInternal}
              onChange={(e) => setShowInternal(e.target.checked)}
              className="rounded bg-[#090d13] border-[#1e2530] text-orange-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
            />
            <span>Show internal topics</span>
          </label>
        </div>
      </div>

      {/* Main Topics Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-xs text-red-400 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#111722] border-b border-[#1e2530] text-gray-400 font-medium">
                <th className="py-3 px-4 font-medium">Topic Name</th>
                <th className="py-3 px-3 font-medium text-center">Partitions</th>
                <th className="py-3 px-3 font-medium text-center">Replicas</th>
                <th className="py-3 px-3 font-medium text-right">Messages</th>
                <th className="py-3 px-3 font-medium">Cleanup Policy</th>
                <th className="py-3 px-3 font-medium">Retention</th>
                <th className="py-3 px-3 font-medium text-center">Health</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171e2a]">
              {loading && topics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-400 mb-2" />
                    <span className="text-xs">Fetching Kafka topics...</span>
                  </td>
                </tr>
              ) : filteredTopics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-sans">
                    <HardDrive className="w-8 h-8 mx-auto text-gray-600 mb-2 opacity-40" />
                    <p className="text-sm font-medium text-gray-400">No topics found</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {search
                        ? 'No topics match the current search filter.'
                        : 'Create your first Kafka topic to get started.'}
                    </p>
                    {!search && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-3 px-3 py-1.5 bg-orange-600/20 text-orange-300 border border-orange-500/30 rounded-lg text-xs hover:bg-orange-500/30 transition-colors"
                      >
                        + Create Topic
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTopics.map((topic) => {
                  const isHealthy = topic.underReplicatedCount === 0;
                  return (
                    <tr
                      key={topic.name}
                      onClick={() => setSelectedTopic(topic.name)}
                      className="hover:bg-[#131a26] transition-colors cursor-pointer group"
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium font-mono text-white group-hover:text-orange-300 transition-colors">
                            {topic.name}
                          </span>
                          {topic.isInternal && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-sans font-medium">
                              Internal
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Partitions */}
                      <td className="py-3 px-3 text-center font-mono text-gray-300">
                        {topic.partitionsCount}
                      </td>

                      {/* Replication Factor */}
                      <td className="py-3 px-3 text-center font-mono text-gray-400">
                        {topic.replicationFactor}x
                      </td>

                      {/* Messages */}
                      <td className="py-3 px-3 text-right font-mono text-orange-400 font-medium">
                        {topic.totalMessages.toLocaleString()}
                      </td>

                      {/* Cleanup Policy */}
                      <td className="py-3 px-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#151b23] border border-[#222d3d] text-gray-300 font-mono">
                          {topic.cleanupPolicy || 'delete'}
                        </span>
                      </td>

                      {/* Retention */}
                      <td className="py-3 px-3 text-gray-400 font-mono text-xs">
                        {formatRetention(topic.retentionMs)}
                      </td>

                      {/* Health */}
                      <td className="py-3 px-3 text-center">
                        {isHealthy ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Healthy</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{topic.underReplicatedCount} Under-replicated</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTopic(topic.name);
                          }}
                          className="px-2 py-1 text-xs text-gray-400 group-hover:text-orange-300 bg-[#151b23] group-hover:bg-orange-500/15 border border-[#222d3d] group-hover:border-orange-500/30 rounded-md transition-all flex items-center gap-1 ml-auto"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Topic Modal */}
      {showCreateModal && (
        <CreateTopicModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadTopics}
        />
      )}

      {/* Topic Detail Drawer */}
      {selectedTopic && (
        <TopicDetailDrawer
          isOpen={Boolean(selectedTopic)}
          topicName={selectedTopic}
          onClose={() => setSelectedTopic(null)}
          onTopicDeleted={() => {
            setSelectedTopic(null);
            loadTopics();
          }}
          onTopicUpdated={loadTopics}
        />
      )}
    </div>
  );
};
