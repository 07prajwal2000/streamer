import React, { useState, useEffect } from 'react';
import { X, Sliders, AlertTriangle, Plus, Trash2, Check, RefreshCw, Info } from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { UpdateKafkaTopicConfigs } from '../../../wailsjs/go/main/App';

interface EditTopicConfigModalProps {
  isOpen: boolean;
  topic: string;
  existingConfigs: kafkamanager.BrokerConfigEntry[];
  onClose: () => void;
  onUpdated: () => void;
}

interface ConfigRow {
  key: string;
  value: string;
  isExisting: boolean;
}

export const EditTopicConfigModal: React.FC<EditTopicConfigModalProps> = ({
  isOpen,
  topic,
  existingConfigs,
  onClose,
  onUpdated,
}) => {
  // Common topic configs with quick editing
  const [cleanupPolicy, setCleanupPolicy] = useState<string>('delete');
  const [retentionPreset, setRetentionPreset] = useState<string>('custom');
  const [retentionMs, setRetentionMs] = useState<string>('604800000');
  const [retentionBytes, setRetentionBytes] = useState<string>('-1');
  const [maxMessageBytes, setMaxMessageBytes] = useState<string>('1048576');
  const [minISR, setMinISR] = useState<string>('1');

  // Custom key-value pairs
  const [customConfigs, setCustomConfigs] = useState<{ key: string; value: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize values from existingConfigs when opened
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setLoading(false);

    const configMap = new Map<string, string>();
    for (const c of existingConfigs) {
      configMap.set(c.name, c.value);
    }

    const curCleanup = configMap.get('cleanup.policy') || 'delete';
    setCleanupPolicy(curCleanup);

    const curRetention = configMap.get('retention.ms') || '604800000';
    setRetentionMs(curRetention);
    if (curRetention === '3600000') setRetentionPreset('1h');
    else if (curRetention === '86400000') setRetentionPreset('24h');
    else if (curRetention === '604800000') setRetentionPreset('7d');
    else if (curRetention === '2592000000') setRetentionPreset('30d');
    else if (curRetention === '-1') setRetentionPreset('infinite');
    else setRetentionPreset('custom');

    setRetentionBytes(configMap.get('retention.bytes') || '-1');
    setMaxMessageBytes(configMap.get('max.message.bytes') || '1048576');
    setMinISR(configMap.get('min.insync.replicas') || '1');

    // Collect other dynamic/custom configs that are not in the primary list
    const primaryKeys = new Set([
      'cleanup.policy',
      'retention.ms',
      'retention.bytes',
      'max.message.bytes',
      'min.insync.replicas',
    ]);

    const otherCustom: { key: string; value: string }[] = [];
    for (const c of existingConfigs) {
      if (!primaryKeys.has(c.name) && c.source.toLowerCase().includes('dynamic')) {
        otherCustom.push({ key: c.name, value: c.value });
      }
    }
    setCustomConfigs(otherCustom);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRetentionPreset = (preset: string) => {
    setRetentionPreset(preset);
    switch (preset) {
      case '1h':
        setRetentionMs((3600 * 1000).toString());
        break;
      case '24h':
        setRetentionMs((24 * 3600 * 1000).toString());
        break;
      case '7d':
        setRetentionMs((7 * 24 * 3600 * 1000).toString());
        break;
      case '30d':
        setRetentionMs((30 * 24 * 3600 * 1000).toString());
        break;
      case 'infinite':
        setRetentionMs('-1');
        break;
      default:
        break;
    }
  };

  const handleAddCustomConfig = () => {
    setCustomConfigs([...customConfigs, { key: '', value: '' }]);
  };

  const handleUpdateCustomConfig = (index: number, key: string, value: string) => {
    const updated = [...customConfigs];
    updated[index] = { key, value };
    setCustomConfigs(updated);
  };

  const handleRemoveCustomConfig = (index: number) => {
    setCustomConfigs(customConfigs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updateMap: Record<string, string> = {};

      if (cleanupPolicy) updateMap['cleanup.policy'] = cleanupPolicy;
      if (retentionMs) updateMap['retention.ms'] = retentionMs;
      if (retentionBytes) updateMap['retention.bytes'] = retentionBytes;
      if (maxMessageBytes) updateMap['max.message.bytes'] = maxMessageBytes;
      if (minISR) updateMap['min.insync.replicas'] = minISR;

      for (const item of customConfigs) {
        if (item.key.trim()) {
          updateMap[item.key.trim()] = item.value.trim();
        }
      }

      await UpdateKafkaTopicConfigs(topic, updateMap);
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f141d] border border-[#222d3d] w-full max-w-2xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2736] flex items-center justify-between bg-[#131a26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Alter Topic Configuration</h2>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate max-w-sm">
                {topic}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2937] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-all">{error}</div>
            </div>
          )}

          {/* Cleanup Policy & Min ISR */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                cleanup.policy
              </label>
              <select
                value={cleanupPolicy}
                onChange={(e) => setCleanupPolicy(e.target.value)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs text-white focus:outline-none focus:border-orange-500/50 transition-colors"
              >
                <option value="delete">delete (Retention-based cleanup)</option>
                <option value="compact">compact (Log compaction by key)</option>
                <option value="compact,delete">compact,delete (Both)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                min.insync.replicas
              </label>
              <input
                type="number"
                min={1}
                max={32}
                value={minISR}
                onChange={(e) => setMinISR(e.target.value)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="1"
              />
            </div>
          </div>

          {/* Retention Time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-300">
                retention.ms (Retention Period)
              </label>
              <div className="flex items-center gap-1 bg-[#0c1017] p-0.5 border border-[#1e2736] rounded-lg text-[10px]">
                {(['1h', '24h', '7d', '30d', 'infinite'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleRetentionPreset(p)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      retentionPreset === p
                        ? 'bg-orange-500 text-white font-medium'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {p === 'infinite' ? '∞' : p}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={retentionMs}
              onChange={(e) => {
                setRetentionMs(e.target.value);
                setRetentionPreset('custom');
              }}
              placeholder="e.g. 604800000 or -1"
              className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>

          {/* Retention Bytes & Max Message Bytes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                retention.bytes (-1 for unlimited)
              </label>
              <input
                type="text"
                value={retentionBytes}
                onChange={(e) => setRetentionBytes(e.target.value)}
                placeholder="-1"
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                max.message.bytes
              </label>
              <input
                type="text"
                value={maxMessageBytes}
                onChange={(e) => setMaxMessageBytes(e.target.value)}
                placeholder="1048576"
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Additional Dynamic / Custom Configs */}
          <div className="border-t border-[#1e2736] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">
                Additional Topic Overrides ({customConfigs.length})
              </span>
              <button
                type="button"
                onClick={handleAddCustomConfig}
                className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Override</span>
              </button>
            </div>

            {customConfigs.length === 0 ? (
              <p className="text-[11px] text-gray-500 italic">
                No custom configuration overrides set. Click "Add Override" to specify keys like <code className="text-gray-400">segment.bytes</code> or <code className="text-gray-400">compression.type</code>.
              </p>
            ) : (
              <div className="space-y-2">
                {customConfigs.map((cfg, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. segment.bytes"
                      value={cfg.key}
                      onChange={(e) => handleUpdateCustomConfig(idx, e.target.value, cfg.value)}
                      className="flex-1 px-3 py-1.5 bg-[#0c1017] border border-[#1e2736] rounded-lg text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={cfg.value}
                      onChange={(e) => handleUpdateCustomConfig(idx, cfg.key, e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[#0c1017] border border-[#1e2736] rounded-lg text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomConfig(idx)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e2736] bg-[#131a26] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1f2937] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Applying Changes...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Topic Configs</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
