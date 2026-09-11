import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Code2,
  FileText,
  Binary,
  Layers,
  Clock,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Send,
  RotateCcw,
  Tag,
  CheckCircle2,
  WrapText,
} from 'lucide-react';
import { sqsmanager } from '../../../wailsjs/go/models';
import {
  DeleteSQSMessage,
  ChangeSQSMessageVisibility,
} from '../../../wailsjs/go/main/App';

interface SQSMessageInspectorProps {
  message: sqsmanager.SQSMessage | null;
  onClose: () => void;
  onMessageDeleted: (messageId: string) => void;
  onResend?: (message: sqsmanager.SQSMessage) => void;
}

function generateHexDump(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const hexParts: string[] = [];
    let asciiPart = '';
    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        const b = chunk[j];
        hexParts.push(b.toString(16).padStart(2, '0'));
        asciiPart += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
      } else {
        hexParts.push('  ');
      }
    }
    const offsetStr = i.toString(16).padStart(8, '0');
    const firstHalf = hexParts.slice(0, 8).join(' ');
    const secondHalf = hexParts.slice(8, 16).join(' ');
    lines.push(`${offsetStr}:  ${firstHalf}  ${secondHalf}  |${asciiPart}|`);
  }
  return lines.join('\n');
}

export const SQSMessageInspector: React.FC<SQSMessageInspectorProps> = ({
  message,
  onClose,
  onMessageDeleted,
  onResend,
}) => {
  const [activeTab, setActiveTab] = useState<'json' | 'text' | 'hex' | 'base64'>('json');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [wrapText, setWrapText] = useState(true);

  // Actions
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const formattedJson = useMemo(() => {
    if (!message?.body) return '';
    try {
      const parsed = JSON.parse(message.body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return null;
    }
  }, [message?.body]);

  const hexDump = useMemo(() => {
    if (!message?.body) return '';
    return generateHexDump(message.body);
  }, [message?.body]);

  const base64Content = useMemo(() => {
    if (!message?.body) return '';
    try {
      return btoa(unescape(encodeURIComponent(message.body)));
    } catch {
      return message.body;
    }
  }, [message?.body]);

  if (!message) return null;

  const handleCopy = (text: string, type: 'payload' | 'id' | 'handle') => {
    navigator.clipboard.writeText(text);
    if (type === 'payload') {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } else if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    }
  };

  const handleDeleteMessage = async () => {
    if (!message.receiptHandle || !message.queueUrl) {
      setActionError('Receipt handle or queue URL missing');
      return;
    }

    setIsDeleting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await DeleteSQSMessage(message.queueUrl, message.receiptHandle);
      setActionSuccess('Message deleted from queue');
      setTimeout(() => {
        onMessageDeleted(message.messageId);
        onClose();
      }, 750);
    } catch (err: any) {
      setActionError(String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReleaseMessage = async () => {
    if (!message.receiptHandle || !message.queueUrl) {
      setActionError('Receipt handle or queue URL missing');
      return;
    }

    setIsReleasing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      // Set visibility timeout to 0 so other consumers immediately see this message
      await ChangeSQSMessageVisibility(message.queueUrl, message.receiptHandle, 0);
      setActionSuccess('Message returned to queue (Visibility Timeout = 0s)');
      setTimeout(() => {
        setActionSuccess(null);
      }, 3000);
    } catch (err: any) {
      setActionError(String(err));
    } finally {
      setIsReleasing(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts || ts === 0) return 'N/A';
    return new Date(ts).toLocaleString();
  };

  const bodySizeBytes = new TextEncoder().encode(message.body || '').length;

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex justify-end select-none animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#090d13] border-l border-[#1e2530] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white font-mono truncate max-w-xs">
                  {message.messageId}
                </h2>
                <button
                  onClick={() => handleCopy(message.messageId, 'id')}
                  title="Copy Message ID"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {message.messageGroupId && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 font-mono">
                    Group: {message.messageGroupId}
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-medium">
                  {message.receiveCount} {message.receiveCount === 1 ? 'Receive' : 'Receives'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Queue: {message.queueName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action feedback banners */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Payload View Container */}
          <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
            {/* Tab Bar */}
            <div className="px-4 py-2.5 border-b border-[#1e2530] bg-[#090d13] flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === 'json'
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  JSON
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === 'text'
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Text
                </button>
                <button
                  onClick={() => setActiveTab('hex')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === 'hex'
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Binary className="w-3.5 h-3.5" />
                  Hex
                </button>
                <button
                  onClick={() => setActiveTab('base64')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'base64'
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Base64
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500 font-mono">
                  {bodySizeBytes.toLocaleString()} bytes
                </span>
                <button
                  onClick={() => setWrapText(!wrapText)}
                  title="Toggle Word Wrap"
                  className={`p-1 rounded text-xs transition-colors ${
                    wrapText ? 'text-orange-400 bg-orange-500/10' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  <WrapText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCopy(message.body, 'payload')}
                  title="Copy Raw Body"
                  className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px]"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPayload ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Payload Code Window */}
            <div className="p-4 overflow-x-auto max-h-72">
              <pre
                className={`font-mono text-xs text-gray-200 leading-relaxed ${
                  wrapText ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                }`}
              >
                {activeTab === 'json' && (formattedJson || message.body)}
                {activeTab === 'text' && message.body}
                {activeTab === 'hex' && hexDump}
                {activeTab === 'base64' && base64Content}
              </pre>
            </div>
          </div>

          {/* Message Attributes */}
          <div className="border border-[#1e2530] rounded-xl overflow-hidden bg-[#0c1017]">
            <div className="px-4 py-2.5 border-b border-[#1e2530] flex items-center justify-between">
              <span className="font-semibold text-gray-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-orange-400" />
                Message Attributes ({Object.keys(message.messageAttributes || {}).length})
              </span>
            </div>

            {message.messageAttributes && Object.keys(message.messageAttributes).length > 0 ? (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#090d13] text-gray-500 border-b border-[#1e2530]">
                  <tr>
                    <th className="py-2 px-4">Name</th>
                    <th className="py-2 px-4">Type</th>
                    <th className="py-2 px-4">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2530]">
                  {Object.entries(message.messageAttributes).map(([k, attr]) => (
                    <tr key={k} className="hover:bg-[#121822]">
                      <td className="py-2 px-4 text-orange-300">{k}</td>
                      <td className="py-2 px-4 text-gray-400">{attr.dataType}</td>
                      <td className="py-2 px-4 text-white break-all">
                        {attr.stringValue || attr.binaryValue || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-center text-gray-500 text-[11px]">
                No user message attributes attached to this message.
              </div>
            )}
          </div>

          {/* System Metadata & Identifiers */}
          <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3">
            <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              Delivery & Metadata
            </h3>

            <div className="grid grid-cols-2 gap-y-3 gap-x-6">
              <div>
                <span className="text-gray-500 block text-[11px]">Sent Timestamp</span>
                <span className="text-gray-200 font-mono text-[11px]">
                  {formatTimestamp(message.sentTimestamp)}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[11px]">First Receive Timestamp</span>
                <span className="text-gray-200 font-mono text-[11px]">
                  {formatTimestamp(message.firstReceiveTimestamp)}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[11px]">Receive Count</span>
                <span className="text-orange-400 font-mono font-medium">
                  {message.receiveCount}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[11px]">MD5 of Body</span>
                <span className="text-gray-300 font-mono text-[11px] truncate block">
                  {message.md5OfBody || 'N/A'}
                </span>
              </div>

              {message.messageDeduplicationId && (
                <div>
                  <span className="text-gray-500 block text-[11px]">Deduplication ID</span>
                  <span className="text-gray-300 font-mono text-[11px]">
                    {message.messageDeduplicationId}
                  </span>
                </div>
              )}

              {message.sequenceNumber && (
                <div>
                  <span className="text-gray-500 block text-[11px]">Sequence Number</span>
                  <span className="text-gray-300 font-mono text-[11px]">
                    {message.sequenceNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Receipt Handle with Copy */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500 text-[11px]">Receipt Handle</span>
                <button
                  onClick={() => handleCopy(message.receiptHandle, 'handle')}
                  className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px]"
                >
                  {copiedHandle ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copiedHandle ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-2 bg-[#090d13] border border-[#1e2530] rounded-lg font-mono text-[10px] text-gray-400 break-all select-all max-h-16 overflow-y-auto">
                {message.receiptHandle || 'N/A'}
              </div>
            </div>
          </div>

          {/* Actions Toolbar */}
          <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3">
            <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[10px]">
              Message Actions
            </h3>

            <div className="flex flex-wrap gap-2.5">
              {/* Release immediately */}
              <button
                type="button"
                onClick={handleReleaseMessage}
                disabled={isReleasing}
                title="Reset visibility timeout to 0 so other consumers immediately see this message"
                className="px-3.5 py-2 rounded-xl bg-[#151b23] border border-[#222d3d] text-orange-400 hover:bg-[#1a2230] font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isReleasing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Return to Queue (Visibility = 0)
              </button>

              {/* Resend / Clone */}
              {onResend && (
                <button
                  type="button"
                  onClick={() => onResend(message)}
                  className="px-3.5 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 font-medium text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Resend / Clone Message...
                </button>
              )}

              {/* Delete */}
              <button
                type="button"
                onClick={handleDeleteMessage}
                disabled={isDeleting}
                title="Permanently remove message from the queue using its receipt handle"
                className="px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete from Queue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
