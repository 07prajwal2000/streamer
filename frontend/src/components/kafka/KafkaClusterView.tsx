import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Cpu, 
  Crown, 
  Activity, 
  Layers, 
  Search, 
  RefreshCw, 
  Sliders, 
  HardDrive, 
  ShieldCheck,
  Radio,
  FileText
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { GetKafkaBrokers, GetKafkaClusterStatus } from '../../../wailsjs/go/main/App';
import { BrokerConfigModal } from './BrokerConfigModal';

interface KafkaClusterViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
}

export const KafkaClusterView: React.FC<KafkaClusterViewProps> = ({
  isConnected,
  isActiveTab,
}) => {
  const [clusterStatus, setClusterStatus] = useState<kafkamanager.KafkaClusterStatus | null>(null);
  const [brokers, setBrokers] = useState<kafkamanager.BrokerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrokerForConfig, setSelectedBrokerForConfig] = useState<{
    nodeId: number;
    host: string;
  } | null>(null);

  const loadData = async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const [status, brokerList] = await Promise.all([
        GetKafkaClusterStatus(),
        GetKafkaBrokers(),
      ]);
      setClusterStatus(status);
      setBrokers(brokerList || []);
    } catch (err) {
      console.error('Failed to load Kafka cluster metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadData();
    }
  }, [isConnected, isActiveTab]);

  const filteredBrokers = brokers.filter(
    (b) =>
      b.nodeId.toString().includes(search) ||
      b.host.toLowerCase().includes(search.toLowerCase()) ||
      (b.rack && b.rack.toLowerCase().includes(search.toLowerCase())) ||
      b.port.toString().includes(search)
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-y-auto select-none">
      {/* Top Header */}
      <div className="h-14 px-6 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]/70 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <span>Cluster & Brokers Explorer</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Kafka Protocol
              </span>
            </h1>
            <p className="text-[11px] text-gray-500">
              Live nodes topology, controller broker, and configuration parameters
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading || !isConnected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Cluster Telemetry Stats */}
        <div className="grid grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Radio className="w-3 h-3 text-orange-400" /> Cluster ID
            </span>
            <div className="text-xs font-mono font-medium text-gray-200 truncate" title={clusterStatus?.clusterId || 'N/A'}>
              {clusterStatus?.clusterId || 'Standard Cluster'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-400" /> Active Controller
            </span>
            <div className="text-xs font-mono font-semibold text-amber-300 flex items-center gap-1.5">
              <span>Node #{clusterStatus?.controllerId ?? -1}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Server className="w-3 h-3 text-blue-400" /> Total Brokers
            </span>
            <div className="text-xs font-mono font-medium text-gray-200">
              {brokers.length} {brokers.length === 1 ? 'Node' : 'Nodes'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-400" /> Topics & Partitions
            </span>
            <div className="text-xs font-mono font-medium text-purple-300">
              {clusterStatus?.topicsCount ?? 0} topics / {clusterStatus?.partitionsCount ?? 0} parts
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" /> Latency (RTT)
            </span>
            <div className="text-xs font-mono font-medium text-emerald-400">
              {(clusterStatus?.rttMs || 0).toFixed(2)} ms
            </div>
          </div>
        </div>

        {/* Phase 2 Feature Roadmap Cards Banner */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-blue-500/5 border border-orange-500/20 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-gray-200">Topics & Partitions</div>
              <div className="text-[11px] text-gray-500">Coming in Phase 2: Create, alter & manage topics</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-gray-200">Consumer Groups & Lag</div>
              <div className="text-[11px] text-gray-500">Coming in Phase 3: Lag inspection & offset reset</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-gray-200">Message Browser & Producer</div>
              <div className="text-[11px] text-gray-500">Coming in Phase 3: Live tail & payload viewer</div>
            </div>
          </div>
        </div>

        {/* Brokers Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Cluster Brokers ({filteredBrokers.length})
              </h2>
            </div>

            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter brokers by ID, host, port, rack..."
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-orange-500/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none placeholder:text-gray-600 transition-colors"
              />
            </div>
          </div>

          {/* Brokers Table */}
          <div className="border border-[#1f2838] rounded-xl overflow-hidden bg-[#0f141d]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#121824] border-b border-[#1f2838] text-gray-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Node ID</th>
                  <th className="py-3 px-4">Endpoint (Host:Port)</th>
                  <th className="py-3 px-4">Rack</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18202d] font-mono">
                {filteredBrokers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 font-sans">
                      {brokers.length === 0 ? 'No brokers discovered.' : 'No brokers matching search query.'}
                    </td>
                  </tr>
                ) : (
                  filteredBrokers.map((broker) => (
                    <tr key={broker.nodeId} className="hover:bg-[#141b26] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">#{broker.nodeId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-200 select-text">
                        <span>{broker.host}:{broker.port}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {broker.rack ? (
                          <span className="px-2 py-0.5 rounded bg-[#18212e] text-gray-300 text-[11px]">
                            {broker.rack}
                          </span>
                        ) : (
                          <span className="text-gray-600 font-sans italic text-[11px]">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        {broker.isController ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Crown className="w-3 h-3 text-amber-400" /> Controller
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20">
                            Broker
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Reachable
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() =>
                            setSelectedBrokerForConfig({
                              nodeId: broker.nodeId,
                              host: `${broker.host}:${broker.port}`,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 transition-all"
                        >
                          <Sliders className="w-3 h-3 text-orange-400" />
                          <span>Inspect Configs</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Broker Config Inspector Modal */}
      {selectedBrokerForConfig && (
        <BrokerConfigModal
          isOpen={true}
          nodeId={selectedBrokerForConfig.nodeId}
          brokerHost={selectedBrokerForConfig.host}
          onClose={() => setSelectedBrokerForConfig(null)}
        />
      )}
    </div>
  );
};
