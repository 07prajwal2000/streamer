import React, { useState, useEffect } from 'react';
import { X, Layers, AlertTriangle, ArrowUpRight, Check, RefreshCw } from 'lucide-react';
import { UpdateKafkaTopicPartitions } from '../../../wailsjs/go/main/App';

interface AlterPartitionsModalProps {
  isOpen: boolean;
  topic: string;
  currentPartitions: number;
  onClose: () => void;
  onUpdated: () => void;
}

export const AlterPartitionsModal: React.FC<AlterPartitionsModalProps> = ({
  isOpen,
  topic,
  currentPartitions,
  onClose,
  onUpdated,
}) => {
  const [newCount, setNewCount] = useState<number>(currentPartitions + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewCount(currentPartitions + 1);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, currentPartitions]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCount <= currentPartitions) {
      setError(`New partition count must be greater than current count (${currentPartitions})`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await UpdateKafkaTopicPartitions(topic, Number(newCount));
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
      <div className="bg-[#0f141d] border border-[#222d3d] w-full max-w-md rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2736] flex items-center justify-between bg-[#131a26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Expand Partitions</h2>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate max-w-[240px]">
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-all">{error}</div>
            </div>
          )}

          {/* Kafka Warning Alert */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-1">
              <span className="font-semibold text-amber-200">Kafka Partition Rule:</span>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Partitions can <strong>only be increased</strong>, never decreased. Adding partitions does not rebalance existing data and may affect hash-key routing ordering.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Current Partitions
              </label>
              <div className="px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-sm font-mono text-gray-300">
                {currentPartitions}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                New Total Partitions <span className="text-orange-400">*</span>
              </label>
              <input
                type="number"
                min={currentPartitions + 1}
                max={10000}
                value={newCount}
                onChange={(e) => setNewCount(parseInt(e.target.value) || currentPartitions + 1)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1f2937] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || newCount <= currentPartitions}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Expanding...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Expand to {newCount} Partitions</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
