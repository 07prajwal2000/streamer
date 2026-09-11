import React, { useState } from 'react';
import { X, Plus, HardDrive, Sliders, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { CreateKafkaTopic } from '../../../wailsjs/go/main/App';

interface CreateTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateTopicModal: React.FC<CreateTopicModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [topicName, setTopicName] = useState('');
  const [partitions, setPartitions] = useState(3);
  const [replicationFactor, setReplicationFactor] = useState(1);
  const [cleanupPolicy, setCleanupPolicy] = useState('delete');
  const [retentionPreset, setRetentionPreset] = useState('7d');
  const [retentionMs, setRetentionMs] = useState(7 * 24 * 3600 * 1000); // 7 days
  const [minISR, setMinISR] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customConfigs, setCustomConfigs] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRetentionPreset = (preset: string) => {
    setRetentionPreset(preset);
    switch (preset) {
      case '1h':
        setRetentionMs(3600 * 1000);
        break;
      case '24h':
        setRetentionMs(24 * 3600 * 1000);
        break;
      case '7d':
        setRetentionMs(7 * 24 * 3600 * 1000);
        break;
      case '30d':
        setRetentionMs(30 * 24 * 3600 * 1000);
        break;
      case 'infinite':
        setRetentionMs(-1);
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
    if (!topicName.trim()) {
      setError('Topic name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const customMap: Record<string, string> = {};
      for (const item of customConfigs) {
        if (item.key.trim() && item.value.trim()) {
          customMap[item.key.trim()] = item.value.trim();
        }
      }

      const params = new kafkamanager.CreateTopicParams({
        topic: topicName.trim(),
        partitions: Number(partitions),
        replicationFactor: Number(replicationFactor),
        cleanupPolicy,
        retentionMs: Number(retentionMs),
        minInSyncReplicas: Number(minISR),
        customConfigs: customMap,
      });

      await CreateKafkaTopic(params);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f141d] border border-[#222d3d] w-full max-w-xl rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2736] flex items-center justify-between bg-[#131a26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Create Kafka Topic</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Define partitions, replication factor, and retention parameters
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Topic Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">
              Topic Name <span className="text-orange-400">*</span>
            </label>
            <input
              type="text"
              required
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="e.g. orders.v1, user-events, payments.audit"
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-orange-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-gray-500">
              Allowed: Alphanumeric characters, dots (.), underscores (_), and dashes (-).
            </p>
          </div>

          {/* Partitions & Replication */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Partitions Count</label>
              <input
                type="number"
                min={1}
                max={1000}
                required
                value={partitions}
                onChange={(e) => setPartitions(parseInt(e.target.value) || 1)}
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-orange-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
              <p className="text-[10px] text-gray-500">Can be increased later, but cannot be decreased.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Replication Factor</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={replicationFactor}
                onChange={(e) => setReplicationFactor(parseInt(e.target.value) || 1)}
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-orange-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
              <p className="text-[10px] text-gray-500">Cannot exceed the number of live brokers.</p>
            </div>
          </div>

          {/* Cleanup Policy */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Cleanup Policy</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'delete', label: 'Delete (TTL Retention)' },
                { id: 'compact', label: 'Compact (Key Deduplication)' },
                { id: 'compact,delete', label: 'Compact & Delete' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCleanupPolicy(item.id)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    cleanupPolicy === item.id
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Retention Period Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Message Retention Time</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: '1h', label: '1 Hour' },
                { id: '24h', label: '24 Hours' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'infinite', label: 'Infinite (-1)' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleRetentionPreset(preset.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    retentionPreset === preset.id
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Configurations Toggle */}
          <div className="pt-2 border-t border-[#1c2432]">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Advanced Configs' : 'Show Advanced Configs (min.insync.replicas, custom)'}</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-[#1c2432]/60 animate-in fade-in duration-100">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Min In-Sync Replicas (min.insync.replicas)</label>
                <input
                  type="number"
                  min={1}
                  max={replicationFactor}
                  value={minISR}
                  onChange={(e) => setMinISR(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#131923] border border-[#232c3d] focus:border-orange-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              {/* Custom Topic Configs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Custom Config Overrides</span>
                  <button
                    type="button"
                    onClick={handleAddCustomConfig}
                    className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Config</span>
                  </button>
                </div>

                {customConfigs.map((cfg, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. segment.bytes"
                      value={cfg.key}
                      onChange={(e) => handleUpdateCustomConfig(idx, e.target.value, cfg.value)}
                      className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={cfg.value}
                      onChange={(e) => handleUpdateCustomConfig(idx, cfg.key, e.target.value)}
                      className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomConfig(idx)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 border-t border-[#1e2736] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !topicName.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{loading ? 'Creating...' : 'Create Topic'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
