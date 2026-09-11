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
  Layers,
  Clock,
  Tag,
} from 'lucide-react';
import { sqsmanager } from '../../../wailsjs/go/models';
import { SendSQSMessage } from '../../../wailsjs/go/main/App';

interface ProduceMessageModalProps {
  isOpen: boolean;
  selectedQueueUrl?: string;
  availableQueues: sqsmanager.SQSQueueSummary[];
  onClose: () => void;
  onProduced?: (result: sqsmanager.SendSQSMessageResult) => void;
}

export const ProduceMessageModal: React.FC<ProduceMessageModalProps> = ({
  isOpen,
  selectedQueueUrl,
  availableQueues,
  onClose,
  onProduced,
}) => {
  const [queueUrl, setQueueUrl] = useState<string>('');
  const [body, setBody] = useState<string>('{\n  "message": "Hello from Streamer",\n  "timestamp": ' + Date.now() + '\n}');
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [messageGroupId, setMessageGroupId] = useState<string>('default-group');
  const [messageDeduplicationId, setMessageDeduplicationId] = useState<string>('');
  const [attributes, setAttributes] = useState<{ key: string; dataType: string; value: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<sqsmanager.SendSQSMessageResult | null>(null);

  const activeQueue = availableQueues.find((q) => q.queueUrl === queueUrl);
  const isFIFO = activeQueue?.isFifo || queueUrl.endsWith('.fifo');

  useEffect(() => {
    if (isOpen) {
      const initialUrl = selectedQueueUrl || (availableQueues.length > 0 ? availableQueues[0].queueUrl : '');
      setQueueUrl(initialUrl);
      setDelaySeconds(0);
      setMessageGroupId('default-group');
      setMessageDeduplicationId('');
      setError(null);
      setSuccessResult(null);
      setLoading(false);
    }
  }, [isOpen, selectedQueueUrl]);

  if (!isOpen) return null;

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(body);
      setBody(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      setError('Message body is not valid JSON and cannot be formatted.');
    }
  };

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: '', dataType: 'String', value: '' }]);
  };

  const handleUpdateAttribute = (index: number, field: string, val: string) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: val };
    setAttributes(updated);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueUrl.trim()) {
      setError('Please select a target queue');
      return;
    }
    if (!body.trim()) {
      setError('Message body cannot be empty');
      return;
    }
    if (isFIFO && !messageGroupId.trim()) {
      setError('Message Group ID is required for FIFO queues');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const attrMap: Record<string, sqsmanager.SQSMessageAttribute> = {};
      for (const a of attributes) {
        if (a.key.trim()) {
          attrMap[a.key.trim()] = new sqsmanager.SQSMessageAttribute({
            dataType: a.dataType,
            stringValue: a.value,
          });
        }
      }

      const params = new sqsmanager.SendSQSMessageParams({
        queueUrl: queueUrl.trim(),
        body,
        delaySeconds: isFIFO ? 0 : Number(delaySeconds),
        messageGroupId: isFIFO ? messageGroupId.trim() : undefined,
        messageDeduplicationId: isFIFO && messageDeduplicationId.trim() ? messageDeduplicationId.trim() : undefined,
        messageAttributes: attrMap,
      });

      const res = await SendSQSMessage(params);
      setSuccessResult(res);
      if (onProduced) onProduced(res);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const bodySizeBytes = new TextEncoder().encode(body).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="bg-[#090d13] border border-[#1e2530] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Produce SQS Message</h2>
              <p className="text-xs text-gray-500">Publish a test payload to an Amazon SQS queue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {successResult && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3 text-green-400">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">Message published successfully!</p>
                <div className="text-[11px] font-mono text-gray-300">
                  <span>Message ID: </span>
                  <span className="text-green-300">{successResult.messageId}</span>
                </div>
                {successResult.sequenceNumber && (
                  <div className="text-[11px] font-mono text-gray-300">
                    <span>Sequence Number: </span>
                    <span className="text-green-300">{successResult.sequenceNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Queue Selection */}
          <div>
            <label className="block text-gray-300 font-medium mb-1.5">
              Target Queue <span className="text-red-400">*</span>
            </label>
            <select
              value={queueUrl}
              onChange={(e) => setQueueUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0f141c] border border-[#1e2530] rounded-xl text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50"
            >
              {availableQueues.map((q) => (
                <option key={q.queueUrl} value={q.queueUrl}>
                  {q.queueName} {q.isFifo ? '(FIFO)' : '(Standard)'}
                </option>
              ))}
            </select>
          </div>

          {/* FIFO Fields (Conditional) */}
          {isFIFO && (
            <div className="p-4 bg-orange-500/[0.04] border border-orange-500/20 rounded-xl space-y-3">
              <h4 className="font-semibold text-orange-400 uppercase tracking-wider text-[10px]">
                FIFO Queue Parameters
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">
                    Message Group ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={messageGroupId}
                    onChange={(e) => setMessageGroupId(e.target.value)}
                    placeholder="e.g. order-partition-1"
                    className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono focus:outline-hidden focus:border-orange-500/50"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Messages with same group ID are processed strictly in FIFO order.
                  </span>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1">
                    Message Deduplication ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={messageDeduplicationId}
                    onChange={(e) => setMessageDeduplicationId(e.target.value)}
                    placeholder="Leave blank for content-based hash"
                    className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono focus:outline-hidden focus:border-orange-500/50"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Token used for deduplication of sent messages.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Delay (Standard Queues Only) */}
          {!isFIFO && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-300 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  Delivery Delay (seconds)
                </label>
                <span className="text-orange-400 font-mono">{delaySeconds}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={900}
                step={5}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <span className="text-[10px] text-gray-500">
                Delay delivery of this message for up to 15 minutes (0 - 900s).
              </span>
            </div>
          )}

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-gray-300 font-medium">
                Message Body <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500 font-mono">
                  {bodySizeBytes.toLocaleString()} bytes / 256 KB max
                </span>
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="px-2 py-0.5 rounded bg-[#151b23] border border-[#222d3d] text-orange-400 hover:text-orange-300 hover:bg-[#1a2230] text-[10px] flex items-center gap-1"
                >
                  <FileJson className="w-3 h-3" />
                  Format JSON
                </button>
              </div>
            </div>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter message text, JSON, or XML..."
              className="w-full px-3.5 py-2.5 bg-[#0f141c] border border-[#1e2530] rounded-xl text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50 resize-y leading-relaxed"
            />
          </div>

          {/* Message Attributes */}
          <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
            <div className="px-4 py-2.5 border-b border-[#1e2530] flex items-center justify-between">
              <span className="font-semibold text-gray-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-orange-400" />
                Message Attributes ({attributes.length})
              </span>
              <button
                type="button"
                onClick={handleAddAttribute}
                className="px-2.5 py-1 rounded-lg bg-[#151b23] border border-[#222d3d] text-orange-400 hover:bg-[#1a2230] text-[10px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Attribute
              </button>
            </div>

            {attributes.length > 0 ? (
              <div className="p-4 space-y-2.5">
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={attr.key}
                      onChange={(e) => handleUpdateAttribute(idx, 'key', e.target.value)}
                      placeholder="Name (e.g. ContentType)"
                      className="flex-1 px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono text-xs"
                    />
                    <select
                      value={attr.dataType}
                      onChange={(e) => handleUpdateAttribute(idx, 'dataType', e.target.value)}
                      className="w-28 px-2 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-lg text-white text-xs"
                    >
                      <option value="String">String</option>
                      <option value="Number">Number</option>
                      <option value="Binary">Binary</option>
                    </select>
                    <input
                      type="text"
                      value={attr.value}
                      onChange={(e) => handleUpdateAttribute(idx, 'value', e.target.value)}
                      placeholder="Value (e.g. application/json)"
                      className="flex-1 px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(idx)}
                      className="p-1.5 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-[11px]">
                No custom message attributes defined. Click "Add Attribute" to add custom metadata.
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
              className="px-5 py-2 rounded-xl bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-xs shadow-lg shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Send SQS Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
