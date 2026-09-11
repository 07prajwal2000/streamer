import React, { useState, useEffect } from 'react';
import { X, Search, Sliders, Shield, Lock, CheckCircle, RefreshCw } from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { GetKafkaBrokerConfigs } from '../../../wailsjs/go/main/App';

interface BrokerConfigModalProps {
  isOpen: boolean;
  nodeId: number;
  brokerHost: string;
  onClose: () => void;
}

export const BrokerConfigModal: React.FC<BrokerConfigModalProps> = ({
  isOpen,
  nodeId,
  brokerHost,
  onClose,
}) => {
  const [configs, setConfigs] = useState<kafkamanager.BrokerConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');

  const loadConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await GetKafkaBrokerConfigs(nodeId);
      setConfigs(res || []);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen, nodeId]);

  if (!isOpen) return null;

  const filteredConfigs = configs.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.value && c.value.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterSource === 'all') return true;
    if (filterSource === 'dynamic') return c.source.toLowerCase().includes('dynamic');
    if (filterSource === 'static') return c.source.toLowerCase().includes('static');
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f141d] border border-[#222d3d] w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2736] flex items-center justify-between bg-[#131a26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Broker #{nodeId} Configuration</span>
                <span className="text-[11px] font-mono text-gray-400 font-normal">({brokerHost})</span>
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Inspect active and dynamic Kafka configuration properties
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadConfigs}
              disabled={loading}
              title="Refresh Configs"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2937] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2937] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-3 border-b border-[#1c2432] bg-[#0c1017] flex items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search config key or value (e.g. retention, partitions)..."
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-orange-500/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none placeholder:text-gray-600 font-mono transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 text-[11px]">Filter:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'dynamic', label: 'Dynamic' },
              { id: 'static', label: 'Static' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterSource(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  filterSource === tab.id
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#161f2c]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="text-[11px] text-gray-500 ml-2 font-mono">
              {filteredConfigs.length} / {configs.length}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin text-orange-400" />
              <span className="text-xs">Loading broker configuration...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <span className="font-semibold">Failed to fetch configurations:</span> {error}
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-gray-500 text-xs">
              No matching configuration properties found.
            </div>
          ) : (
            <div className="border border-[#1f2838] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#121824] border-b border-[#1f2838] text-gray-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-4">Config Key</th>
                    <th className="py-2.5 px-4">Value</th>
                    <th className="py-2.5 px-4">Source</th>
                    <th className="py-2.5 px-4 text-right">Attributes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202d] font-mono">
                  {filteredConfigs.map((cfg) => (
                    <tr key={cfg.name} className="hover:bg-[#141b26] transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-gray-200 select-text">
                        {cfg.name}
                      </td>
                      <td className="py-2.5 px-4 text-gray-300 select-text max-w-xs truncate">
                        {cfg.isSensitive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-sans italic">
                            <Lock className="w-3 h-3" /> Sensitive
                          </span>
                        ) : cfg.value === '' ? (
                          <span className="text-gray-600 italic font-sans">(empty)</span>
                        ) : (
                          cfg.value
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#192230] text-gray-400 border border-[#253245]">
                          {cfg.source}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-sans">
                          {cfg.isReadOnly ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20">
                              Read-Only
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Dynamic
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1e2736] bg-[#0e131b] flex items-center justify-between text-xs text-gray-400">
          <span>Read directly via Kafka Admin API</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1b2230] hover:bg-[#252f42] text-white rounded-lg transition-colors font-medium text-xs border border-[#2b364a]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
