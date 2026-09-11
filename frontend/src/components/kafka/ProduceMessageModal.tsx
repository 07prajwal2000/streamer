import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Code2,
  FileJson,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { ProduceKafkaRecord } from '../../../wailsjs/go/main/App';

interface ProduceMessageModalProps {
  isOpen: boolean;
  currentTopic?: string;
  availableTopics: string[];
  onClose: () => void;
  onProduced: (result: kafkamanager.ProduceRecordResult) => void;
}

export const ProduceMessageModal: React.FC<ProduceMessageModalProps> = ({
  isOpen,
  currentTopic,
  availableTopics,
  onClose,
  onProduced,
}) => {
  const [topic, setTopic] = useState<string>('');
  const [partition, setPartition] = useState<number>(-1);
  const [key, setKey] = useState<string>('');
  const [payload, setPayload] = useState<string>('{\n  "message": "Hello Kafka"\n}');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<kafkamanager.ProduceRecordResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTopic(currentTopic || (availableTopics.length > 0 ? availableTopics[0] : ''));
      setPartition(-1);
      setKey('');
      setError(null);
      setSuccessResult(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(payload);
      setPayload(JSON.stringify(parsed, null, 2));
    } catch {
      setError('Payload is not valid JSON and cannot be formatted.');
    }
  };

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const handleUpdateHeader = (index: number, k: string, v: string) => {
    const updated = [...headers];
    updated[index] = { key: k, value: v };
    setHeaders(updated);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Topic name is required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);

    try {
      const headersMap: Record<string, string> = {};
      for (const h of headers) {
        if (h.key.trim()) {
          headersMap[h.key.trim()] = h.value;
        }
      }

      const params = new kafkamanager.ProduceKafkaRecordParams({
        topic: topic.trim(),
        key: key.trim(),
        payload,
        partition: Number(partition),
        headers: headersMap,
      });

      const res = await ProduceKafkaRecord(params);
      setSuccessResult(res);
      onProduced(res);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f141d] border border-[#222d3d] w-full max-w-2xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2736] flex items-center justify-between bg-[#131a26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Produce Kafka Message</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Publish a record with optional key, partition, and headers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2937] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-all">{error}</div>
            </div>
          )}

          {successResult && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-2.5 text-xs text-green-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-green-300">Message Published Successfully!</span>
                <div className="text-[11px] font-mono text-green-300/80 mt-1">
                  Topic: <strong className="text-white">{successResult.topic}</strong> &bull; Partition: <strong className="text-white">#{successResult.partition}</strong> &bull; Offset: <strong className="text-white">{successResult.offset}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Topic & Partition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Target Topic <span className="text-orange-400">*</span>
              </label>
              {availableTopics.length > 0 ? (
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500/50"
                  required
                >
                  {availableTopics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="topic-name"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500/50"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Target Partition
              </label>
              <select
                value={partition}
                onChange={(e) => setPartition(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value={-1}>Automatic (Default Partitioner / Murmur2)</option>
                {Array.from({ length: 32 }, (_, i) => (
                  <option key={i} value={i}>
                    Partition #{i}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Message Key */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Message Key <span className="text-gray-500 font-normal">(Optional, used for partition hash routing)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. user-12345 or order-id-987"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          {/* Message Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-300">
                Record Headers ({headers.length})
              </label>
              <button
                type="button"
                onClick={handleAddHeader}
                className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Header</span>
              </button>
            </div>

            {headers.length > 0 && (
              <div className="space-y-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Header Key"
                      value={h.key}
                      onChange={(e) => handleUpdateHeader(i, e.target.value, h.value)}
                      className="flex-1 px-3 py-1.5 bg-[#0c1017] border border-[#1e2736] rounded-lg text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                    />
                    <input
                      type="text"
                      placeholder="Header Value"
                      value={h.value}
                      onChange={(e) => handleUpdateHeader(i, h.key, e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[#0c1017] border border-[#1e2736] rounded-lg text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveHeader(i)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payload Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-300">
                Message Payload <span className="text-orange-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#161f2d] border border-[#233147] transition-colors"
                >
                  <FileJson className="w-3 h-3 text-orange-400" />
                  <span>Format JSON</span>
                </button>
              </div>
            </div>
            <textarea
              rows={8}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Enter message body (JSON, Plain Text, or String)..."
              className="w-full px-3 py-2.5 bg-[#0c1017] border border-[#1e2736] rounded-xl text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 resize-y leading-relaxed"
              required
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e2736] bg-[#131a26] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1f2937] rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Publish Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
