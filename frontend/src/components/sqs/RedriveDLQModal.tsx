import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Inbox,
} from 'lucide-react';
import { sqsmanager } from '../../../wailsjs/go/models';
import { RedriveDLQ } from '../../../wailsjs/go/main/App';

interface RedriveDLQModalProps {
  isOpen: boolean;
  sourceQueueUrl: string;
  availableQueues: sqsmanager.SQSQueueSummary[];
  onClose: () => void;
  onRedriveComplete: () => void;
}

export const RedriveDLQModal: React.FC<RedriveDLQModalProps> = ({
  isOpen,
  sourceQueueUrl,
  availableQueues,
  onClose,
  onRedriveComplete,
}) => {
  const [targetQueueUrl, setTargetQueueUrl] = useState<string>('');
  const [maxMessages, setMaxMessages] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<sqsmanager.RedriveDLQResult | null>(null);

  const sourceQueue = availableQueues.find((q) => q.queueUrl === sourceQueueUrl);
  const isSourceFIFO = sourceQueue?.isFifo || sourceQueueUrl.endsWith('.fifo');

  // Candidate destination queues (matching FIFO type, excluding source)
  const candidateQueues = availableQueues.filter(
    (q) => q.queueUrl !== sourceQueueUrl && q.isFifo === isSourceFIFO
  );

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setResult(null);
      setLoading(false);
      setMaxMessages(100);
      if (candidateQueues.length > 0) {
        setTargetQueueUrl(candidateQueues[0].queueUrl);
      } else {
        setTargetQueueUrl('');
      }
    }
  }, [isOpen, sourceQueueUrl]);

  if (!isOpen) return null;

  const handleStartRedrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetQueueUrl.trim()) {
      setError('Please select a destination queue');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await RedriveDLQ(
        new sqsmanager.RedriveDLQParams({
          sourceQueueUrl,
          targetQueueUrl: targetQueueUrl.trim(),
          maxMessages: Number(maxMessages),
        })
      );
      setResult(res);
      onRedriveComplete();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="bg-[#090d13] border border-[#1e2530] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Redrive Dead-Letter Queue</h2>
              <p className="text-xs text-gray-500">Move unprocessable messages back to main queue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleStartRedrive} className="p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {result && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3 text-green-400">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{result.statusMessage}</p>
                <div className="text-[11px] text-gray-300">
                  Messages Moved: <span className="text-green-300 font-bold">{result.messagesMoved}</span>
                  {result.errorsCount > 0 && (
                    <span className="text-red-400 ml-3">Errors: {result.errorsCount}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Source DLQ */}
          <div>
            <label className="block text-gray-400 mb-1">Source Dead-Letter Queue</label>
            <div className="p-3 bg-[#0c1017] border border-[#1e2530] rounded-xl flex items-center justify-between font-mono">
              <span className="text-white font-semibold">{sourceQueue?.queueName || 'DLQ'}</span>
              <span className="text-purple-400 font-medium text-[11px]">
                {sourceQueue?.approximateNumberOfMessages ?? 0} messages available
              </span>
            </div>
          </div>

          {/* Destination Queue */}
          <div>
            <label className="block text-gray-300 font-medium mb-1.5">
              Destination Target Queue <span className="text-red-400">*</span>
            </label>
            {candidateQueues.length > 0 ? (
              <select
                value={targetQueueUrl}
                onChange={(e) => setTargetQueueUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0f141c] border border-[#1e2530] rounded-xl text-white font-mono text-xs focus:outline-hidden focus:border-purple-500/50"
              >
                {candidateQueues.map((q) => (
                  <option key={q.queueUrl} value={q.queueUrl}>
                    {q.queueName} {q.isFifo ? '(FIFO)' : '(Standard)'}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-[#0c1017] border border-amber-500/30 rounded-xl text-amber-400 text-xs">
                No matching destination queues found in this account with the same type ({isSourceFIFO ? 'FIFO' : 'Standard'}).
              </div>
            )}
          </div>

          {/* Max Messages to move */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-300 font-medium">Max Messages to Redrive</label>
              <span className="text-purple-400 font-mono">{maxMessages} messages</span>
            </div>
            <div className="flex gap-2">
              {[25, 50, 100, 500].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setMaxMessages(count)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    maxMessages === count
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-[#0f141c] border-[#1e2530] text-gray-400 hover:text-white'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#0c1017] border border-[#1e2530] rounded-xl text-[11px] text-gray-400 leading-relaxed">
            Note: Redrive safely fetches messages from the DLQ, publishes them to the destination queue preserving message bodies and attributes, and deletes them from the DLQ upon successful transfer.
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading || candidateQueues.length === 0}
              className="px-5 py-2 rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Start Redrive
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
