import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Layers,
  Sliders,
  AlertTriangle,
  Check,
  RefreshCw,
  Shield,
  Clock,
  ArrowDownToLine,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { sqsmanager } from '../../../wailsjs/go/models';
import { CreateSQSQueue } from '../../../wailsjs/go/main/App';

interface CreateQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingQueues?: sqsmanager.SQSQueueSummary[];
}

export const CreateQueueModal: React.FC<CreateQueueModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  existingQueues = [],
}) => {
  const [queueName, setQueueName] = useState('');
  const [isFIFO, setIsFIFO] = useState(false);

  // Timing & sizing
  const [visibilityTimeout, setVisibilityTimeout] = useState(30);
  const [retentionPreset, setRetentionPreset] = useState('4d');
  const [retentionSeconds, setRetentionSeconds] = useState(345600); // 4 days
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [maxMessageSizeKB, setMaxMessageSizeKB] = useState(256);
  const [receiveWaitTime, setReceiveWaitTime] = useState(0);

  // FIFO settings
  const [contentBasedDedup, setContentBasedDedup] = useState(false);
  const [dedupScope, setDedupScope] = useState<'messageGroup' | 'queue'>('messageGroup');
  const [fifoThroughputLimit, setFifoThroughputLimit] = useState<'perMessageGroupId' | 'perQueue'>('perMessageGroupId');

  // DLQ settings
  const [enableDLQ, setEnableDLQ] = useState(false);
  const [deadLetterTargetArn, setDeadLetterTargetArn] = useState('');
  const [maxReceiveCount, setMaxReceiveCount] = useState(3);

  // Encryption
  const [encryptionType, setEncryptionType] = useState<'SSE-SQS' | 'SSE-KMS' | 'None'>('SSE-SQS');
  const [kmsMasterKeyId, setKmsMasterKeyId] = useState('alias/aws/sqs');

  // Tags
  const [tags, setTags] = useState<{ key: string; value: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQueueName('');
      setIsFIFO(false);
      setVisibilityTimeout(30);
      setRetentionPreset('4d');
      setRetentionSeconds(345600);
      setDelaySeconds(0);
      setMaxMessageSizeKB(256);
      setReceiveWaitTime(0);
      setContentBasedDedup(false);
      setDedupScope('messageGroup');
      setFifoThroughputLimit('perMessageGroupId');
      setEnableDLQ(false);
      setDeadLetterTargetArn('');
      setMaxReceiveCount(3);
      setEncryptionType('SSE-SQS');
      setKmsMasterKeyId('alias/aws/sqs');
      setTags([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRetentionPreset = (preset: string) => {
    setRetentionPreset(preset);
    switch (preset) {
      case '1d':
        setRetentionSeconds(86400);
        break;
      case '4d':
        setRetentionSeconds(345600);
        break;
      case '7d':
        setRetentionSeconds(604800);
        break;
      case '14d':
        setRetentionSeconds(1209600);
        break;
    }
  };

  const handleToggleFIFO = (fifo: boolean) => {
    setIsFIFO(fifo);
    let name = queueName.trim();
    if (fifo) {
      if (!name.endsWith('.fifo')) {
        name = name ? `${name}.fifo` : '';
      }
    } else {
      if (name.endsWith('.fifo')) {
        name = name.slice(0, -5);
      }
    }
    setQueueName(name);
  };

  const handleAddTag = () => {
    setTags([...tags, { key: '', value: '' }]);
  };

  const handleUpdateTag = (index: number, key: string, value: string) => {
    const updated = [...tags];
    updated[index] = { key, value };
    setTags(updated);
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = queueName.trim();
    if (!cleanName) {
      setError('Queue name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tagMap: Record<string, string> = {};
      for (const t of tags) {
        if (t.key.trim()) {
          tagMap[t.key.trim()] = t.value.trim();
        }
      }

      const params = new sqsmanager.CreateQueueParams({
        queueName: cleanName,
        isFifo: isFIFO,
        visibilityTimeout: Number(visibilityTimeout),
        messageRetentionPeriod: Number(retentionSeconds),
        delaySeconds: Number(delaySeconds),
        maximumMessageSize: Number(maxMessageSizeKB) * 1024,
        receiveMessageWaitTimeSeconds: Number(receiveWaitTime),
        contentBasedDeduplication: isFIFO ? contentBasedDedup : false,
        deduplicationScope: isFIFO ? dedupScope : undefined,
        fifoThroughputLimit: isFIFO ? fifoThroughputLimit : undefined,
        enableDlq: enableDLQ,
        deadLetterTargetArn: enableDLQ ? deadLetterTargetArn.trim() : undefined,
        maxReceiveCount: enableDLQ ? Number(maxReceiveCount) : undefined,
        serverSideEncryption: encryptionType,
        kmsMasterKeyId: encryptionType === 'SSE-KMS' ? kmsMasterKeyId.trim() : undefined,
        tags: tagMap,
      });

      await CreateSQSQueue(params);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#090d13] border border-[#1e2530] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] flex items-center justify-between bg-[#0c1017]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create SQS Queue</h2>
              <p className="text-xs text-gray-500">Configure Standard or FIFO queue parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Queue Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Queue Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleToggleFIFO(false)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  !isFIFO
                    ? 'bg-orange-500/10 border-orange-500/40 text-white'
                    : 'bg-[#0f141c] border-[#1e2530] text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-sm">
                  <span>Standard Queue</span>
                  {!isFIFO && <Check className="w-4 h-4 text-orange-400" />}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Unlimited throughput, at-least-once delivery, best-effort message ordering.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleToggleFIFO(true)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  isFIFO
                    ? 'bg-orange-500/10 border-orange-500/40 text-white'
                    : 'bg-[#0f141c] border-[#1e2530] text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-sm">
                  <span>FIFO Queue</span>
                  {isFIFO && <Check className="w-4 h-4 text-orange-400" />}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Strict FIFO ordering, exactly-once processing, requires <code className="text-orange-400 font-mono">.fifo</code> suffix.
                </p>
              </button>
            </div>
          </div>

          {/* Queue Name */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Queue Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={queueName}
                onChange={(e) => {
                  let val = e.target.value;
                  if (isFIFO && !val.endsWith('.fifo') && val.length > 0 && !val.includes('.')) {
                    // Let user type naturally, handled below or on submit
                  }
                  setQueueName(val);
                }}
                onBlur={() => {
                  if (isFIFO && queueName.trim() && !queueName.trim().endsWith('.fifo')) {
                    setQueueName(`${queueName.trim()}.fifo`);
                  }
                }}
                placeholder={isFIFO ? 'e.g. order-processing.fifo' : 'e.g. notifications-queue'}
                className="w-full px-3.5 py-2.5 bg-[#0f141c] border border-[#1e2530] rounded-xl text-white font-mono text-sm placeholder-gray-600 focus:outline-hidden focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
              />
              {isFIFO && !queueName.endsWith('.fifo') && (
                <div className="absolute right-3 top-2.5 text-xs text-orange-400 font-mono">
                  +.fifo
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Alphanumeric characters, hyphens (-), and underscores (_). Up to 80 characters.
            </p>
          </div>

          {/* Timing & Sizing Settings */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              Timing & Delivery Configuration
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Visibility Timeout */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Default Visibility Timeout (seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  max={43200}
                  value={visibilityTimeout}
                  onChange={(e) => setVisibilityTimeout(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500/50"
                />
                <span className="text-[10px] text-gray-500">Period messages stay hidden from consumers (0s - 12h)</span>
              </div>

              {/* Delivery Delay */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Delivery Delay (seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  max={900}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500/50"
                />
                <span className="text-[10px] text-gray-500">Delay before newly added messages can be read (0 - 15m)</span>
              </div>

              {/* Receive Wait Time (Long Polling) */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Receive Message Wait Time (seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={receiveWaitTime}
                  onChange={(e) => setReceiveWaitTime(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500/50"
                />
                <span className="text-[10px] text-gray-500">Wait time for long polling (0 = short poll, 1-20s = long poll)</span>
              </div>

              {/* Max Message Size */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Maximum Message Size (KB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={256}
                  value={maxMessageSizeKB}
                  onChange={(e) => setMaxMessageSizeKB(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500/50"
                />
                <span className="text-[10px] text-gray-500">Maximum payload limit (1 - 256 KB)</span>
              </div>
            </div>

            {/* Message Retention Period */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">Message Retention Period</label>
                <span className="text-xs text-orange-400 font-mono">
                  {Math.round(retentionSeconds / 86400)} days ({retentionSeconds.toLocaleString()}s)
                </span>
              </div>
              <div className="flex gap-2">
                {[
                  { label: '1 Day', key: '1d' },
                  { label: '4 Days (Default)', key: '4d' },
                  { label: '7 Days', key: '7d' },
                  { label: '14 Days (Max)', key: '14d' },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleRetentionPreset(preset.key)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                      retentionPreset === preset.key
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                        : 'bg-[#0f141c] border-[#1e2530] text-gray-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* FIFO Exclusive Options */}
          {isFIFO && (
            <div className="p-4 bg-orange-500/[0.04] border border-orange-500/20 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                FIFO Dedicated Settings
              </h4>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contentBasedDedup}
                  onChange={(e) => setContentBasedDedup(e.target.checked)}
                  className="mt-0.5 rounded text-orange-500 focus:ring-0 bg-[#0f141c] border-gray-700"
                />
                <div>
                  <div className="text-xs font-medium text-white">Content-Based Deduplication</div>
                  <div className="text-[11px] text-gray-400">
                    Automatically computes SHA-256 hash of message body to prevent duplicates within a 5-minute interval.
                  </div>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Deduplication Scope</label>
                  <select
                    value={dedupScope}
                    onChange={(e) => setDedupScope(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-xs"
                  >
                    <option value="messageGroup">Message Group (Recommended)</option>
                    <option value="queue">Entire Queue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">FIFO Throughput Limit</label>
                  <select
                    value={fifoThroughputLimit}
                    onChange={(e) => setFifoThroughputLimit(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-xs"
                  >
                    <option value="perMessageGroupId">Per Message Group ID (High Throughput)</option>
                    <option value="perQueue">Per Queue</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Dead-Letter Queue (DLQ) Section */}
          <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-gray-300">Dead-Letter Queue (DLQ)</h4>
                <p className="text-[11px] text-gray-500">Route unprocessable or failing messages to another queue</p>
              </div>
              <button
                type="button"
                onClick={() => setEnableDLQ(!enableDLQ)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  enableDLQ ? 'bg-orange-500' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    enableDLQ ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {enableDLQ && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Target Dead-Letter Queue ARN</label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={deadLetterTargetArn}
                      onChange={(e) => setDeadLetterTargetArn(e.target.value)}
                      placeholder="arn:aws:sqs:us-east-1:123456789012:my-dlq"
                      className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white text-xs font-mono placeholder-gray-600 focus:outline-hidden focus:border-orange-500/50"
                    />
                    {existingQueues.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center text-[10px] text-gray-400">
                        <span>Select queue:</span>
                        {existingQueues
                          .filter((q) => q.isFifo === isFIFO && q.queueArn)
                          .map((q) => (
                            <button
                              key={q.queueArn}
                              type="button"
                              onClick={() => setDeadLetterTargetArn(q.queueArn)}
                              className="px-2 py-0.5 rounded bg-[#151b23] border border-[#222d3d] text-orange-400 hover:bg-[#1a2230]"
                            >
                              {q.queueName}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Maximum Receives Before DLQ
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={maxReceiveCount}
                    onChange={(e) => setMaxReceiveCount(Number(e.target.value))}
                    className="w-32 px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-lg text-white text-xs focus:outline-hidden focus:border-orange-500/50"
                  />
                  <span className="text-[10px] text-gray-500 ml-2">Times a message can be received before DLQ</span>
                </div>
              </div>
            )}
          </div>

          {/* Encryption Section */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-orange-400" />
              Server-Side Encryption (SSE)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: 'SSE-SQS', label: 'Amazon SQS-SSE', desc: 'Free managed keys (Default)' },
                { type: 'SSE-KMS', label: 'AWS KMS Key', desc: 'Custom or AWS KMS master key' },
                { type: 'None', label: 'Disabled', desc: 'No server-side encryption' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setEncryptionType(item.type as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    encryptionType === item.type
                      ? 'bg-orange-500/10 border-orange-500/40 text-white'
                      : 'bg-[#0f141c] border-[#1e2530] text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="font-medium text-xs text-white">{item.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>

            {encryptionType === 'SSE-KMS' && (
              <div className="mt-3">
                <label className="block text-xs text-gray-400 mb-1">KMS Master Key ID or Alias</label>
                <input
                  type="text"
                  value={kmsMasterKeyId}
                  onChange={(e) => setKmsMasterKeyId(e.target.value)}
                  placeholder="alias/aws/sqs"
                  className="w-full px-3 py-2 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Advanced / Tags Collapsible */}
          <div className="border border-[#1e2530] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 bg-[#0c1017] flex items-center justify-between text-xs font-medium text-gray-300 hover:text-white"
            >
              <span>Resource Tags ({tags.length})</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 bg-[#090d13] space-y-3">
                {tags.map((tag, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={tag.key}
                      onChange={(e) => handleUpdateTag(idx, e.target.value, tag.value)}
                      placeholder="Key (e.g. Environment)"
                      className="flex-1 px-3 py-1.5 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-xs"
                    />
                    <input
                      type="text"
                      value={tag.value}
                      onChange={(e) => handleUpdateTag(idx, tag.key, e.target.value)}
                      placeholder="Value (e.g. Production)"
                      className="flex-1 px-3 py-1.5 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="p-1.5 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 rounded-lg bg-[#151b23] border border-[#222d3d] text-xs text-orange-400 hover:bg-[#1a2230] flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Tag
                </button>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium text-xs shadow-lg shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Create Queue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
