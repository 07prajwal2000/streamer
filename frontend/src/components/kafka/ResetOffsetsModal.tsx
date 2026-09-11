import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  AlertTriangle,
  Clock,
  FastForward,
  Rewind,
  Hash,
  Check,
  RefreshCw,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { ResetKafkaConsumerGroupOffsets } from '../../../wailsjs/go/main/App';

interface ResetOffsetsModalProps {
  isOpen: boolean;
  group: string;
  groupState?: string;
  topics: string[];
  onClose: () => void;
  onReset: () => void;
}

export const ResetOffsetsModal: React.FC<ResetOffsetsModalProps> = ({
  isOpen,
  group,
  groupState,
  topics,
  onClose,
  onReset,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [partitionInput, setPartitionInput] = useState<string>('');
  const [strategy, setStrategy] = useState<'earliest' | 'latest' | 'timestamp' | 'offset'>('earliest');
  const [timestampValue, setTimestampValue] = useState<string>('');
  const [offsetValue, setOffsetValue] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTopic(topics.length === 1 ? topics[0] : '');
      setPartitionInput('');
      setStrategy('earliest');
      setTimestampValue(new Date().toISOString().slice(0, 16));
      setOffsetValue('0');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isActiveGroup = groupState && groupState.toLowerCase() === 'stable';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let partitionsList: number[] = [];
      if (partitionInput.trim()) {
        partitionsList = partitionInput
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n >= 0);
      }

      let parsedTimestamp = 0;
      if (strategy === 'timestamp') {
        const parsed = new Date(timestampValue).getTime();
        if (isNaN(parsed) || parsed <= 0) {
          throw new Error('Please enter a valid date and time.');
        }
        parsedTimestamp = parsed;
      }

      let parsedOffset = 0;
      if (strategy === 'offset') {
        parsedOffset = parseInt(offsetValue, 10);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
          throw new Error('Please enter a valid non-negative offset number.');
        }
      }

      const params = new kafkamanager.ResetOffsetsParams({
        group,
        topic: selectedTopic.trim(),
        partitions: partitionsList,
        strategy,
        timestamp: parsedTimestamp,
        offset: parsedOffset,
      });

      await ResetKafkaConsumerGroupOffsets(params);
      onReset();
      onClose();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f141d] border border-[#222d3d] w-full max-w-lg rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2736] flex items-center justify-between bg-[#131a26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Reset Consumer Group Offsets</h2>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate max-w-xs">{group}</p>
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

          {/* Active Consumers Warning */}
          {isActiveGroup && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-1">
                <span className="font-semibold text-amber-200">Active Consumer Group Warning:</span>
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  This group currently has active consumers (state: <strong>{groupState}</strong>).
                  Offset resets should only be performed when consumers are stopped (<code className="text-amber-200">Empty</code> or <code className="text-amber-200">Dead</code> state), otherwise active consumers may immediately overwrite the reset offsets.
                </p>
              </div>
            </div>
          )}

          {/* Target Topic Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Target Topic
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs text-white focus:outline-none focus:border-orange-500/50"
            >
              <option value="">All Topics Committed by Group</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Partitions */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Specific Partitions <span className="text-gray-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 0, 1, 2 (leave empty for all partitions)"
              value={partitionInput}
              onChange={(e) => setPartitionInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          {/* Strategy Options */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Offset Reset Strategy
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStrategy('earliest')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  strategy === 'earliest'
                    ? 'bg-orange-500/15 border-orange-500/50 text-white'
                    : 'bg-[#0c1017] border-[#1e2736] text-gray-400 hover:text-gray-200'
                }`}
              >
                <Rewind className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-white">To Earliest</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Rewind to start offset (replay all data)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('latest')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  strategy === 'latest'
                    ? 'bg-orange-500/15 border-orange-500/50 text-white'
                    : 'bg-[#0c1017] border-[#1e2736] text-gray-400 hover:text-gray-200'
                }`}
              >
                <FastForward className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-white">To Latest</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Skip backlog directly to end offset</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('timestamp')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  strategy === 'timestamp'
                    ? 'bg-orange-500/15 border-orange-500/50 text-white'
                    : 'bg-[#0c1017] border-[#1e2736] text-gray-400 hover:text-gray-200'
                }`}
              >
                <Clock className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-white">By Timestamp</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Seek to specific date and time</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('offset')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  strategy === 'offset'
                    ? 'bg-orange-500/15 border-orange-500/50 text-white'
                    : 'bg-[#0c1017] border-[#1e2736] text-gray-400 hover:text-gray-200'
                }`}
              >
                <Hash className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-white">Specific Offset</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Explicit numerical offset target</div>
                </div>
              </button>
            </div>
          </div>

          {/* Strategy Details: Timestamp */}
          {strategy === 'timestamp' && (
            <div className="p-3 bg-[#0c1017] border border-[#1e2736] rounded-xl space-y-2">
              <label className="block text-xs font-medium text-gray-300">
                Seek Timestamp
              </label>
              <input
                type="datetime-local"
                value={timestampValue}
                onChange={(e) => setTimestampValue(e.target.value)}
                className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2736] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-orange-500/50"
                required
              />
            </div>
          )}

          {/* Strategy Details: Explicit Offset */}
          {strategy === 'offset' && (
            <div className="p-3 bg-[#0c1017] border border-[#1e2736] rounded-xl space-y-2">
              <label className="block text-xs font-medium text-gray-300">
                Target Offset Number
              </label>
              <input
                type="number"
                min={0}
                value={offsetValue}
                onChange={(e) => setOffsetValue(e.target.value)}
                className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2736] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-orange-500/50"
                required
              />
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-[#1e2736] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1f2937] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Resetting Offsets...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Execute Reset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
