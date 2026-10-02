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
  Send,
  RotateCcw,
  Tag,
  CheckCircle2,
  WrapText,
  AlertTriangle,
  Boxes,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';

interface RabbitMQMessageInspectorProps {
  message: rabbitmqmanager.RMQMessage | null;
  onClose: () => void;
  onResend?: (message: rabbitmqmanager.RMQMessage) => void;
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

export const RabbitMQMessageInspector: React.FC<RabbitMQMessageInspectorProps> = ({
  message,
  onClose,
  onResend,
}) => {
  const [activeTab, setActiveTab] = useState<'json' | 'text' | 'hex' | 'base64'>('json');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [wrapText, setWrapText] = useState(true);

  const formattedJson = useMemo(() => {
    if (!message?.payload) return '';
    try {
      const parsed = JSON.parse(message.payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return null;
    }
  }, [message?.payload]);

  const hexDump = useMemo(() => {
    if (!message?.payload) return '';
    return generateHexDump(message.payload);
  }, [message?.payload]);

  const base64Content = useMemo(() => {
    if (!message?.payload) return '';
    try {
      return btoa(unescape(encodeURIComponent(message.payload)));
    } catch {
      return message.payload;
    }
  }, [message?.payload]);

  if (!message) return null;

  const handleCopyPayload = () => {
    if (!message.payload) return;
    navigator.clipboard.writeText(
      activeTab === 'json' && formattedJson ? formattedJson : message.payload
    );
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyId = () => {
    if (!message.messageId) return;
    navigator.clipboard.writeText(message.messageId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const dateStr =
    message.timestamp && message.timestamp > 0
      ? new Date(message.timestamp).toLocaleString()
      : 'Not specified';

  // Check for DLQ x-death headers
  const xDeath = message.headers && message.headers['x-death'];

  return (
    <div className="flex flex-col h-full bg-[#0a0e15] border-l border-[#1e2530] text-gray-200 select-none overflow-hidden">
      {/* Top Header */}
      <div className="h-14 px-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
              <span>Message Inspector</span>
              {message.redelivered && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 text-[9px] font-semibold border border-amber-500/25">
                  REDELIVERED
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-gray-500 truncate flex items-center gap-2">
              <span>Tag #{message.deliveryTag}</span>
              {message.queueName && <span>· Queue: {message.queueName}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onResend && (
            <button
              onClick={() => onResend(message)}
              title="Clone message to Publisher modal"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            title="Close inspector"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dead Letter Notice if x-death is present */}
        {xDeath && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Dead-Lettered Message (x-death detected)</span>
            </div>
            <div className="text-[11px] text-gray-300 font-mono overflow-x-auto bg-[#0a0e15]/60 p-2 rounded border border-amber-500/20">
              <pre>{JSON.stringify(xDeath, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Payload Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-[#131923] p-0.5 rounded-lg border border-[#232c3d]">
              <button
                onClick={() => setActiveTab('json')}
                disabled={!formattedJson}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeTab === 'json'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : formattedJson
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                <Code2 className="w-3 h-3" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeTab === 'text'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Text</span>
              </button>
              <button
                onClick={() => setActiveTab('hex')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeTab === 'hex'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Binary className="w-3 h-3" />
                <span>Hex</span>
              </button>
              <button
                onClick={() => setActiveTab('base64')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeTab === 'base64'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>B64</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWrapText(!wrapText)}
                title={wrapText ? 'Disable wrap' : 'Enable wrap'}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  wrapText
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-white'
                }`}
              >
                <WrapText className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCopyPayload}
                title="Copy payload"
                className="flex items-center gap-1 px-2.5 py-1 bg-[#131923] hover:bg-[#1a2332] text-gray-300 hover:text-white rounded-lg border border-[#232c3d] text-xs transition-colors"
              >
                {copiedPayload ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Payload View Box */}
          <div className="rounded-xl border border-[#1e2530] bg-[#070a0f] p-3 font-mono text-xs max-h-[280px] overflow-auto">
            {activeTab === 'json' && formattedJson ? (
              <pre className={wrapText ? 'whitespace-pre-wrap break-all text-rose-200' : 'whitespace-pre text-rose-200'}>
                {formattedJson}
              </pre>
            ) : activeTab === 'hex' ? (
              <pre className="whitespace-pre text-emerald-400/90 text-[11px] leading-tight">
                {hexDump}
              </pre>
            ) : activeTab === 'base64' ? (
              <pre className={wrapText ? 'whitespace-pre-wrap break-all text-amber-200' : 'whitespace-pre text-amber-200'}>
                {base64Content}
              </pre>
            ) : (
              <pre className={wrapText ? 'whitespace-pre-wrap break-all text-gray-200' : 'whitespace-pre text-gray-200'}>
                {message.payload || '<empty payload>'}
              </pre>
            )}
          </div>
        </div>

        {/* AMQP Standard Properties */}
        <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530] space-y-2.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">
            AMQP Message Properties
          </span>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono">
            <div>
              <span className="text-gray-500 block text-[10px]">Exchange</span>
              <span className="text-white">{message.exchange === '' ? '(AMQP default)' : message.exchange}</span>
            </div>

            <div>
              <span className="text-gray-500 block text-[10px]">Routing Key</span>
              <span className="text-rose-300 font-semibold">{message.routingKey || '(none)'}</span>
            </div>

            <div>
              <span className="text-gray-500 block text-[10px]">Delivery Mode</span>
              <span className="text-gray-200">
                {message.deliveryMode === 2 ? 'Persistent (2)' : 'Non-Persistent (1)'}
              </span>
            </div>

            <div>
              <span className="text-gray-500 block text-[10px]">Priority</span>
              <span className="text-gray-200">{message.priority}</span>
            </div>

            <div>
              <span className="text-gray-500 block text-[10px]">Content-Type</span>
              <span className="text-gray-200">{message.contentType || 'text/plain'}</span>
            </div>

            <div>
              <span className="text-gray-500 block text-[10px]">Payload Size</span>
              <span className="text-gray-200">{message.payloadBytes} bytes</span>
            </div>

            <div>
              <span className="text-gray-500 block text-[10px]">Timestamp</span>
              <span className="text-gray-300">{dateStr}</span>
            </div>

            {message.messageId && (
              <div className="col-span-2">
                <span className="text-gray-500 block text-[10px]">Message ID</span>
                <span className="text-white truncate block">{message.messageId}</span>
              </div>
            )}

            {message.correlationId && (
              <div className="col-span-2">
                <span className="text-gray-500 block text-[10px]">Correlation ID</span>
                <span className="text-rose-300 truncate block">{message.correlationId}</span>
              </div>
            )}

            {message.replyTo && (
              <div>
                <span className="text-gray-500 block text-[10px]">Reply-To</span>
                <span className="text-gray-200">{message.replyTo}</span>
              </div>
            )}

            {message.expiration && (
              <div>
                <span className="text-gray-500 block text-[10px]">Expiration</span>
                <span className="text-gray-200">{message.expiration} ms</span>
              </div>
            )}

            {message.userId && (
              <div>
                <span className="text-gray-500 block text-[10px]">User ID</span>
                <span className="text-gray-200">{message.userId}</span>
              </div>
            )}

            {message.appId && (
              <div>
                <span className="text-gray-500 block text-[10px]">App ID</span>
                <span className="text-gray-200">{message.appId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Custom AMQP Headers */}
        {message.headers && Object.keys(message.headers).length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1e2530] space-y-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">
              Headers & Metadata ({Object.keys(message.headers).length})
            </span>

            <div className="rounded-lg border border-[#1e2530] bg-[#070a0f] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[10px]">
                    <th className="py-2 px-3 font-medium">Header Key</th>
                    <th className="py-2 px-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202c] font-mono text-[11px]">
                  {Object.entries(message.headers).map(([k, v]) => (
                    <tr key={k} className="hover:bg-[#121822]">
                      <td className="py-2 px-3 text-rose-300 font-semibold">{k}</td>
                      <td className="py-2 px-3 text-gray-300 break-all">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
