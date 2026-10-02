import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Code2,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import { PublishRabbitMQMessage } from '../../../wailsjs/go/main/App';

interface PublishMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: () => void;
  vhost: string;
  availableExchanges?: string[];
  initialExchange?: string;
  initialRoutingKey?: string;
  initialPayload?: string;
  initialHeaders?: Record<string, any>;
}

export const PublishMessageModal: React.FC<PublishMessageModalProps> = ({
  isOpen,
  onClose,
  onPublished,
  vhost,
  availableExchanges = [],
  initialExchange = '',
  initialRoutingKey = '',
  initialPayload = '',
  initialHeaders,
}) => {
  const [exchange, setExchange] = useState(initialExchange || '');
  const [routingKey, setRoutingKey] = useState(initialRoutingKey || '');
  const [payload, setPayload] = useState(initialPayload || '');
  const [contentType, setContentType] = useState(() =>
    initialPayload && initialPayload.trim().startsWith('{') ? 'application/json' : 'text/plain'
  );
  const [deliveryMode, setDeliveryMode] = useState<number>(2); // 2 = persistent
  const [priority, setPriority] = useState<number>(0);

  // Flags
  const [mandatory, setMandatory] = useState<boolean>(false);
  const [waitForConfirm, setWaitForConfirm] = useState<boolean>(true);

  // Advanced properties
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [messageId, setMessageId] = useState<string>(() => crypto.randomUUID());
  const [correlationId, setCorrelationId] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [expiration, setExpiration] = useState('');
  const [messageType, setMessageType] = useState('');

  // Headers
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(() => {
    if (initialHeaders && Object.keys(initialHeaders).length > 0) {
      return Object.entries(initialHeaders).map(([k, v]) => ({
        key: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
      }));
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<rabbitmqmanager.PublishRMQMessageResult | null>(null);

  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setExchange(initialExchange || '');
      setRoutingKey(initialRoutingKey || '');
      setPayload(initialPayload || '');
      setContentType(
        initialPayload && initialPayload.trim().startsWith('{') ? 'application/json' : 'text/plain'
      );
      setDeliveryMode(2);
      setPriority(0);
      setMandatory(false);
      setWaitForConfirm(true);
      setMessageId(crypto.randomUUID());
      setCorrelationId('');
      setReplyTo('');
      setExpiration('');
      setMessageType('');
      setError(null);
      setResult(null);
      setLoading(false);

      if (initialHeaders && Object.keys(initialHeaders).length > 0) {
        setHeaders(
          Object.entries(initialHeaders).map(([k, v]) => ({
            key: k,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          }))
        );
      } else {
        setHeaders([]);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(payload);
      setPayload(JSON.stringify(parsed, null, 2));
      setContentType('application/json');
      setError(null);
    } catch {
      setError('Payload is not valid JSON to format.');
    }
  };

  const handleInsertSample = () => {
    const sample = {
      eventId: crypto.randomUUID(),
      eventType: 'order.placed',
      timestamp: new Date().toISOString(),
      customer: {
        id: 'cust_8472',
        email: 'dev@streamer.app',
      },
      order: {
        total: 149.99,
        currency: 'USD',
        items: [
          { sku: 'STREAM-PRO', qty: 1, price: 149.99 },
        ],
      },
    };
    setPayload(JSON.stringify(sample, null, 2));
    setContentType('application/json');
  };

  const handleAddHeader = () => {
    setHeaders((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateHeader = (index: number, field: 'key' | 'value', val: string) => {
    setHeaders((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const headersMap: Record<string, any> = {};
      for (const h of headers) {
        if (h.key.trim()) {
          const num = Number(h.value.trim());
          if (!isNaN(num) && h.value.trim() !== '') {
            headersMap[h.key.trim()] = num;
          } else {
            headersMap[h.key.trim()] = h.value.trim();
          }
        }
      }

      const params = new rabbitmqmanager.PublishRMQMessageParams({
        vhost: vhost || '/',
        exchange: exchange.trim() === '(AMQP default)' ? '' : exchange.trim(),
        routingKey: routingKey.trim(),
        payload: payload,
        contentType: contentType,
        deliveryMode: deliveryMode,
        priority: priority,
        messageId: messageId.trim() || undefined,
        correlationId: correlationId.trim() || undefined,
        replyTo: replyTo.trim() || undefined,
        expiration: expiration.trim() || undefined,
        type: messageType.trim() || undefined,
        headers: Object.keys(headersMap).length > 0 ? headersMap : undefined,
        mandatory: mandatory,
        waitForConfirm: waitForConfirm,
      });

      const res = await PublishRabbitMQMessage(params);
      setResult(res);
      if (res.success && onPublished) {
        onPublished();
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto select-none">
      <div className="w-full max-w-2xl bg-[#0c1017] border border-[#1e2530] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Publish AMQP Message</h2>
              <p className="text-xs text-gray-500 font-mono">vhost: {vhost || '/'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handlePublish} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          {result && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 ${
                result.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="flex-1">
                <div className="font-semibold">
                  {result.confirmed
                    ? 'Message acknowledged by broker (Publisher Confirmed)'
                    : result.returned
                    ? `Message returned unroutable: ${result.returnReason}`
                    : 'Message dispatched successfully'}
                </div>
                {result.messageId && (
                  <div className="text-[11px] font-mono opacity-80 mt-0.5">
                    ID: {result.messageId}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Target Routing Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Target Exchange</label>
              <input
                type="text"
                list="publish-exchanges-list"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                placeholder="Leave empty for (AMQP default)"
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
              <datalist id="publish-exchanges-list">
                <option value="">(AMQP default)</option>
                {availableExchanges.map((ex) => (
                  <option key={ex} value={ex} />
                ))}
              </datalist>
              <p className="text-[10px] text-gray-500">
                Empty targets default direct exchange routing directly to queue name.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Routing Key</label>
              <input
                type="text"
                value={routingKey}
                onChange={(e) => setRoutingKey(e.target.value)}
                placeholder="e.g. orders.created or queue name"
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
              <p className="text-[10px] text-gray-500">
                Matches binding keys on exchanges, or queue name when using default exchange.
              </p>
            </div>
          </div>

          {/* Payload Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-300">Message Payload</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleInsertSample}
                  className="px-2 py-1 bg-[#131923] hover:bg-[#1a2332] text-gray-300 hover:text-white rounded border border-[#232c3d] text-[11px] flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-rose-400" />
                  <span>Sample</span>
                </button>
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="px-2 py-1 bg-[#131923] hover:bg-[#1a2332] text-gray-300 hover:text-white rounded border border-[#232c3d] text-[11px] flex items-center gap-1"
                >
                  <Code2 className="w-3 h-3" />
                  <span>Format</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayload('')}
                  className="p-1 text-gray-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={7}
              placeholder='{"orderId": "123", "status": "PENDING"}'
              className="w-full bg-[#0a0e15] border border-[#232c3d] focus:border-rose-500 rounded-xl p-3 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Quick Options Row */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#111722] border border-[#1e2736]">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-300">Delivery Mode</label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(parseInt(e.target.value, 10))}
                className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value={2}>Persistent (Mode 2)</option>
                <option value={1}>Non-Persistent (Mode 1)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-300">Content-Type</label>
              <input
                type="text"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                placeholder="application/json"
                className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-300">Priority (0-9)</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                min={0}
                max={9}
                className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Checkboxes: Publisher Confirms & Mandatory */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#111722] border border-[#1e2736]">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={waitForConfirm}
                onChange={(e) => setWaitForConfirm(e.target.checked)}
                className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
              />
              <div>
                <span className="font-semibold text-white">Publisher Confirms</span>
                <p className="text-[10px] text-gray-500">Wait for broker Ack/Nack before completing</p>
              </div>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={mandatory}
                onChange={(e) => setMandatory(e.target.checked)}
                className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
              />
              <div>
                <span className="font-semibold text-white">Mandatory Routing</span>
                <p className="text-[10px] text-gray-500">Return error if message cannot be routed</p>
              </div>
            </label>
          </div>

          {/* Advanced Properties Toggle */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Extended AMQP Properties' : 'Show Extended AMQP Properties (Headers, Correlation ID)'}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 p-4 rounded-xl bg-[#111722] border border-[#1e2736]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Message ID</label>
                    <input
                      type="text"
                      value={messageId}
                      onChange={(e) => setMessageId(e.target.value)}
                      placeholder="UUID"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Correlation ID</label>
                    <input
                      type="text"
                      value={correlationId}
                      onChange={(e) => setCorrelationId(e.target.value)}
                      placeholder="e.g. req-9842"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Reply-To Queue</label>
                    <input
                      type="text"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="amq.gen-..."
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Expiration (ms)</label>
                    <input
                      type="text"
                      value={expiration}
                      onChange={(e) => setExpiration(e.target.value)}
                      placeholder="e.g. 30000"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Type Name</label>
                    <input
                      type="text"
                      value={messageType}
                      onChange={(e) => setMessageType(e.target.value)}
                      placeholder="OrderPlacedEvent"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Headers */}
                <div className="space-y-2 pt-2 border-t border-[#1e2736]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-300">Message Headers</span>
                    <button
                      type="button"
                      onClick={handleAddHeader}
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Header</span>
                    </button>
                  </div>

                  {headers.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => handleUpdateHeader(idx, 'key', e.target.value)}
                        placeholder="header-name"
                        className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={h.value}
                        onChange={(e) => handleUpdateHeader(idx, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(idx)}
                        className="p-1 text-gray-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
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
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Message</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
