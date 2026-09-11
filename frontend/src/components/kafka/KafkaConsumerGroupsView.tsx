import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowRight,
  Server,
  Layers,
  Database,
  Filter,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { ListKafkaConsumerGroups } from '../../../wailsjs/go/main/App';
import { ConsumerGroupDetailDrawer } from './ConsumerGroupDetailDrawer';

interface KafkaConsumerGroupsViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
}

export const KafkaConsumerGroupsView: React.FC<KafkaConsumerGroupsViewProps> = ({
  isConnected,
  isActiveTab,
}) => {
  const [groups, setGroups] = useState<kafkamanager.ConsumerGroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'stable' | 'empty' | 'dead'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const loadGroups = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ListKafkaConsumerGroups();
      setGroups(data || []);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadGroups();
    }
  }, [isConnected, isActiveTab]);

  const stats = useMemo(() => {
    let stable = 0;
    let empty = 0;
    let dead = 0;
    let totalLag = 0;

    for (const g of groups) {
      const s = (g.state || '').toLowerCase();
      if (s === 'stable') stable++;
      else if (s === 'empty') empty++;
      else if (s === 'dead') dead++;
      totalLag += g.totalLag;
    }

    return {
      total: groups.length,
      stable,
      empty,
      dead,
      totalLag,
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (search.trim() && !g.group.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (stateFilter !== 'all') {
        const s = (g.state || '').toLowerCase();
        if (stateFilter === 'stable' && s !== 'stable') return false;
        if (stateFilter === 'empty' && s !== 'empty') return false;
        if (stateFilter === 'dead' && s !== 'dead') return false;
      }
      return true;
    });
  }, [groups, search, stateFilter]);

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

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-[#090d13]">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Kafka Disconnected</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">
          Connect to a Kafka cluster or compatible streaming broker to monitor consumer groups and partition lag.
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
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Consumer Groups</h1>
            <p className="text-[11px] text-gray-400">Monitor active consumer groups, partition lag, and member assignments</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadGroups}
            disabled={loading}
            title="Refresh Consumer Groups"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] border border-transparent hover:border-[#1e2530] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="p-6 pb-4 grid grid-cols-4 gap-4 bg-[#0c1017]/40 border-b border-[#1e2530]">
        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Total Groups</span>
            <Users className="w-4 h-4 text-orange-400/80" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {stats.total}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Registered on cluster
          </div>
        </div>

        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Active (Stable)</span>
            <CheckCircle2 className="w-4 h-4 text-green-400/80" />
          </div>
          <div className="text-2xl font-bold font-mono text-green-400 mt-1">
            {stats.stable}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Actively consuming records
          </div>
        </div>

        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Inactive (Empty/Dead)</span>
            <Server className="w-4 h-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-300 mt-1">
            {stats.empty + stats.dead}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {stats.empty} empty &bull; {stats.dead} dead
          </div>
        </div>

        <div className="bg-[#0f141d] border border-[#1e2530] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Total Cluster Lag</span>
            <Activity className={`w-4 h-4 ${stats.totalLag > 1000 ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              stats.totalLag === 0
                ? 'text-green-400'
                : stats.totalLag > 1000
                ? 'text-red-400'
                : 'text-amber-400'
            }`}
          >
            {stats.totalLag.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Records behind across all groups
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="px-6 py-3 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search consumer groups by ID..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#090d13] p-1 border border-[#1e2530] rounded-xl text-xs">
          {(['all', 'stable', 'empty', 'dead'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                stateFilter === s
                  ? 'bg-orange-500/20 text-orange-300 font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table Area */}
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
                <th className="py-3 px-4 font-medium">Group ID</th>
                <th className="py-3 px-3 font-medium text-center">State</th>
                <th className="py-3 px-3 font-medium text-center">Protocol / Assignor</th>
                <th className="py-3 px-3 font-medium text-center">Members</th>
                <th className="py-3 px-3 font-medium text-center">Topics</th>
                <th className="py-3 px-3 font-medium text-right">Total Lag</th>
                <th className="py-3 px-3 font-medium text-center">Coordinator</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171e2a]">
              {loading && groups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-400 mb-2" />
                    <span className="text-xs">Discovering consumer groups...</span>
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-sans">
                    <Users className="w-8 h-8 mx-auto text-gray-600 mb-2 opacity-40" />
                    <p className="text-sm font-medium text-gray-400">No consumer groups found</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {search
                        ? 'No consumer groups match the current filter.'
                        : 'Connect active Kafka consumers to this cluster to view consumer groups and lag.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => {
                  const isZeroLag = g.totalLag === 0;
                  return (
                    <tr
                      key={g.group}
                      onClick={() => setSelectedGroup(g.group)}
                      className="hover:bg-[#131a26] transition-colors cursor-pointer group"
                    >
                      {/* Group ID */}
                      <td className="py-3 px-4">
                        <span className="font-medium font-mono text-white group-hover:text-orange-300 transition-colors">
                          {g.group}
                        </span>
                      </td>

                      {/* State */}
                      <td className="py-3 px-3 text-center">
                        {getStateBadge(g.state)}
                      </td>

                      {/* Protocol */}
                      <td className="py-3 px-3 text-center font-mono text-gray-400">
                        {g.protocol || g.protocolType || '-'}
                      </td>

                      {/* Members */}
                      <td className="py-3 px-3 text-center font-mono text-white">
                        {g.membersCount}
                      </td>

                      {/* Topics */}
                      <td className="py-3 px-3 text-center font-mono text-gray-300">
                        {g.topicsCount}
                      </td>

                      {/* Lag */}
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        <span
                          className={
                            isZeroLag
                              ? 'text-green-400'
                              : g.totalLag > 1000
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }
                        >
                          {g.totalLag.toLocaleString()}
                        </span>
                      </td>

                      {/* Coordinator */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-[#161f2d] text-orange-300 border border-[#233147] font-mono text-[11px]">
                          Node {g.coordinator}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGroup(g.group);
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

      {/* Detail Drawer */}
      {selectedGroup && (
        <ConsumerGroupDetailDrawer
          isOpen={Boolean(selectedGroup)}
          groupName={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onGroupDeleted={() => {
            setSelectedGroup(null);
            loadGroups();
          }}
          onGroupUpdated={loadGroups}
        />
      )}
    </div>
  );
};
