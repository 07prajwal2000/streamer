import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Boxes,
  ArrowRight,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import { RedriveRabbitMQDLQ } from '../../../wailsjs/go/main/App';

interface RedriveDLQModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  vhost: string;
  sourceQueue: string;
  initialTargetExchange?: string;
  initialTargetRoutingKey?: string;
}

export const RedriveDLQModal: React.FC<RedriveDLQModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vhost,
  sourceQueue,
  initialTargetExchange = '',
  initialTargetRoutingKey = '',
}) => {
  const [targetExchange, setTargetExchange] = useState(initialTargetExchange);
  const [targetRoutingKey, setTargetRoutingKey] = useState(initialTargetRoutingKey);
  const [maxMessages, setMaxMessages] = useState<number>(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<rabbitmqmanager.RedriveDLQResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetExchange(initialTargetExchange);
      setTargetRoutingKey(initialTargetRoutingKey);
      setMaxMessages(100);
      setError(null);
      setResult(null);
      setLoading(false);
    }
  }, [isOpen, initialTargetExchange, initialTargetRoutingKey]);

  if (!isOpen) return null;

  const handleRedrive = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new rabbitmqmanager.RedriveDLQParams({
        vhost: vhost || '/',
        sourceQueue: sourceQueue.trim(),
        targetExchange: targetExchange.trim(),
        targetRoutingKey: targetRoutingKey.trim(),
        maxMessages: maxMessages || 100,
      });

      const res = await RedriveRabbitMQDLQ(params);
      setResult(res);
      if (res.movedCount > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto select-none">
      <div className="w-full max-w-lg bg-[#0c1017] border border-[#1e2530] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Redrive Dead-Letter Queue</h2>
              <p className="text-xs text-gray-500 font-mono">From DLQ: {sourceQueue}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRedrive} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          {result && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 ${
                result.failedCount === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="flex-1">
                <div className="font-semibold">
                  Redrive Complete: Moved {result.movedCount} message(s)
                </div>
                {result.failedCount > 0 && (
                  <div className="text-rose-400 text-[11px] mt-0.5">
                    Failed to move {result.failedCount} message(s)
                  </div>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div className="text-rose-300 text-[10px] mt-1 font-mono">
                    {result.errors.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-[#111722] border border-[#1e2736] text-xs text-gray-300 space-y-1">
            <p className="font-semibold text-amber-400">Dead-Letter Queue Redrive (Republish & Drain)</p>
            <p className="text-gray-400 leading-relaxed text-[11px]">
              Streamer will consume dead-lettered messages from <code className="text-white font-mono">{sourceQueue}</code> and republish each message to the destination exchange and routing key with original headers preserved.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Target Exchange</label>
            <input
              type="text"
              value={targetExchange}
              onChange={(e) => setTargetExchange(e.target.value)}
              placeholder="Leave empty for default direct exchange"
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Target Routing Key</label>
            <input
              type="text"
              value={targetRoutingKey}
              onChange={(e) => setTargetRoutingKey(e.target.value)}
              placeholder="e.g. original.queue.name or routing key"
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Max Messages to Redrive</label>
            <input
              type="number"
              value={maxMessages}
              onChange={(e) => setMaxMessages(parseInt(e.target.value, 10) || 100)}
              min={1}
              max={10000}
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
            />
            <p className="text-[10px] text-gray-500">Batched transfer limit per redrive invocation.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e2530]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#141a24] hover:bg-[#1a2332] text-gray-300 rounded-lg text-xs font-medium border border-[#232c3d]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Start Redrive</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
