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
  Trash2,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import { CreateRabbitMQQueue } from '../../../wailsjs/go/main/App';

interface CreateQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  vhosts?: string[];
  currentVhost?: string;
}

export const CreateQueueModal: React.FC<CreateQueueModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  vhosts = ['/'],
  currentVhost = '/',
}) => {
  const [name, setName] = useState('');
  const [vhost, setVhost] = useState(currentVhost || '/');
  const [type, setType] = useState<'classic' | 'quorum' | 'stream'>('classic');
  const [durable, setDurable] = useState(true);
  const [autoDelete, setAutoDelete] = useState(false);
  const [exclusive, setExclusive] = useState(false);

  // Expiration & Sizing
  const [messageTtl, setMessageTtl] = useState<string>('');
  const [autoExpire, setAutoExpire] = useState<string>('');
  const [maxLength, setMaxLength] = useState<string>('');
  const [maxLengthBytes, setMaxLengthBytes] = useState<string>('');
  const [maxPriority, setMaxPriority] = useState<string>('');
  const [overflow, setOverflow] = useState<string>('drop-head');
  const [deliveryLimit, setDeliveryLimit] = useState<string>('');

  // Dead Lettering (DLX)
  const [enableDlx, setEnableDlx] = useState(false);
  const [dlxExchange, setDlxExchange] = useState('');
  const [dlxRoutingKey, setDlxRoutingKey] = useState('');

  // Custom x- arguments
  const [customArgs, setCustomArgs] = useState<{ key: string; value: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setVhost(currentVhost || '/');
      setType('classic');
      setDurable(true);
      setAutoDelete(false);
      setExclusive(false);
      setMessageTtl('');
      setAutoExpire('');
      setMaxLength('');
      setMaxLengthBytes('');
      setMaxPriority('');
      setOverflow('drop-head');
      setDeliveryLimit('');
      setEnableDlx(false);
      setDlxExchange('');
      setDlxRoutingKey('');
      setCustomArgs([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, currentVhost]);

  if (!isOpen) return null;

  const handleAddCustomArg = () => {
    setCustomArgs((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveCustomArg = (index: number) => {
    setCustomArgs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCustomArg = (index: number, field: 'key' | 'value', val: string) => {
    setCustomArgs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Queue name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const argsMap: Record<string, any> = {};
      for (const item of customArgs) {
        if (item.key.trim()) {
          // Attempt numeric parse if purely digits
          const num = Number(item.value.trim());
          if (!isNaN(num) && item.value.trim() !== '') {
            argsMap[item.key.trim()] = num;
          } else if (item.value.trim() === 'true') {
            argsMap[item.key.trim()] = true;
          } else if (item.value.trim() === 'false') {
            argsMap[item.key.trim()] = false;
          } else {
            argsMap[item.key.trim()] = item.value.trim();
          }
        }
      }

      const params = new rabbitmqmanager.CreateQueueParams({
        name: name.trim(),
        vhost: vhost.trim() || '/',
        type: type,
        durable: type === 'quorum' || type === 'stream' ? true : durable,
        autoDelete: type === 'quorum' || type === 'stream' ? false : autoDelete,
        exclusive: type === 'quorum' || type === 'stream' ? false : exclusive,
        messageTtl: messageTtl ? parseInt(messageTtl, 10) : undefined,
        autoExpire: autoExpire ? parseInt(autoExpire, 10) : undefined,
        maxLength: maxLength ? parseInt(maxLength, 10) : undefined,
        maxLengthBytes: maxLengthBytes ? parseInt(maxLengthBytes, 10) : undefined,
        maxPriority: maxPriority && type === 'classic' ? parseInt(maxPriority, 10) : undefined,
        deadLetterExchange: enableDlx && dlxExchange.trim() ? dlxExchange.trim() : undefined,
        deadLetterRoutingKey: enableDlx && dlxRoutingKey.trim() ? dlxRoutingKey.trim() : undefined,
        overflow: overflow || undefined,
        deliveryLimit: deliveryLimit && type === 'quorum' ? parseInt(deliveryLimit, 10) : undefined,
        customArguments: Object.keys(argsMap).length > 0 ? argsMap : undefined,
      });

      await CreateRabbitMQQueue(params);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto select-none">
      <div className="w-full max-w-xl bg-[#0c1017] border border-[#1e2530] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Declare RabbitMQ Queue</h2>
              <p className="text-xs text-gray-500">Configure queue type, durability, DLX, and TTL limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          {/* Queue Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Queue Architecture / Type</label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setType('classic')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  type === 'classic'
                    ? 'bg-rose-500/15 border-rose-500/40 text-white shadow-sm'
                    : 'bg-[#121822] border-[#222c3c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="text-xs font-semibold text-white">Classic</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Standard non-replicated queue, priority & transient support</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType('quorum');
                  setDurable(true);
                  setAutoDelete(false);
                  setExclusive(false);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  type === 'quorum'
                    ? 'bg-rose-500/15 border-rose-500/40 text-white shadow-sm'
                    : 'bg-[#121822] border-[#222c3c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="text-xs font-semibold text-white">Quorum (HA)</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Raft consensus, distributed HA, data-safety focus</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType('stream');
                  setDurable(true);
                  setAutoDelete(false);
                  setExclusive(false);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  type === 'stream'
                    ? 'bg-rose-500/15 border-rose-500/40 text-white shadow-sm'
                    : 'bg-[#121822] border-[#222c3c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="text-xs font-semibold text-white">Stream</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Append-only log, high-throughput replayable log</div>
              </button>
            </div>
          </div>

          {/* Name & Virtual Host */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Queue Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. orders.process or dlq.notifications"
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Virtual Host</label>
              <select
                value={vhost}
                onChange={(e) => setVhost(e.target.value)}
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg px-2.5 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
              >
                {vhosts.map((vh) => (
                  <option key={vh} value={vh}>
                    {vh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Durability & Lifecycle Checkboxes (for Classic Queues) */}
          {type === 'classic' && (
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#111722] border border-[#1e2736]">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={durable}
                  onChange={(e) => setDurable(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
                />
                <span>Durable</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={autoDelete}
                  onChange={(e) => setAutoDelete(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
                />
                <span>Auto-Delete</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={exclusive}
                  onChange={(e) => setExclusive(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
                />
                <span>Exclusive</span>
              </label>
            </div>
          )}

          {/* Quorum / Stream Info */}
          {type !== 'classic' && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300 flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0 text-blue-400" />
              <span>
                {type === 'quorum' ? 'Quorum queues' : 'Streams'} are strictly durable and cannot be exclusive or auto-deleted.
              </span>
            </div>
          )}

          {/* Dead Letter Exchange (DLX) Section */}
          <div className="p-3.5 rounded-xl bg-[#111722] border border-[#1e2736] space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-200">
                <input
                  type="checkbox"
                  checked={enableDlx}
                  onChange={(e) => setEnableDlx(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
                />
                <span>Configure Dead Letter Exchange (DLX)</span>
              </label>
              <span className="text-[10px] text-gray-500">x-dead-letter-exchange</span>
            </div>

            {enableDlx && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-gray-300">DLX Target Exchange *</label>
                  <input
                    type="text"
                    value={dlxExchange}
                    onChange={(e) => setDlxExchange(e.target.value)}
                    placeholder="e.g. dlx.exchange or amq.direct"
                    className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    required={enableDlx}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-gray-300">DLX Routing Key (Optional)</label>
                  <input
                    type="text"
                    value={dlxRoutingKey}
                    onChange={(e) => setDlxRoutingKey(e.target.value)}
                    placeholder="Defaults to message routing key"
                    className="w-full bg-[#131923] border border-[#232c3d] focus:border-rose-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* TTL, Expiration & Quorum Delivery Limits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvanced ? 'Hide Advanced Queue Arguments' : 'Show Advanced Queue Arguments (TTL, Limits, Overflow)'}</span>
              </button>
            </div>

            {showAdvanced && (
              <div className="space-y-4 p-4 rounded-xl bg-[#111722] border border-[#1e2736]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Message TTL (ms)</label>
                    <input
                      type="number"
                      value={messageTtl}
                      onChange={(e) => setMessageTtl(e.target.value)}
                      placeholder="e.g. 60000 (1 min)"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Auto Expire (ms)</label>
                    <input
                      type="number"
                      value={autoExpire}
                      onChange={(e) => setAutoExpire(e.target.value)}
                      placeholder="e.g. 86400000 (1 day)"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Max Length (msgs)</label>
                    <input
                      type="number"
                      value={maxLength}
                      onChange={(e) => setMaxLength(e.target.value)}
                      placeholder="e.g. 10000"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Max Bytes</label>
                    <input
                      type="number"
                      value={maxLengthBytes}
                      onChange={(e) => setMaxLengthBytes(e.target.value)}
                      placeholder="e.g. 10485760 (10MB)"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Overflow Mode</label>
                    <select
                      value={overflow}
                      onChange={(e) => setOverflow(e.target.value)}
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="drop-head">drop-head</option>
                      <option value="reject-publish">reject-publish</option>
                      <option value="reject-publish-dlx">reject-publish-dlx</option>
                    </select>
                  </div>
                </div>

                {type === 'quorum' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Delivery Limit (Poison pill redelivery count)</label>
                    <input
                      type="number"
                      value={deliveryLimit}
                      onChange={(e) => setDeliveryLimit(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                )}

                {type === 'classic' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-300">Max Priority (0-255)</label>
                    <input
                      type="number"
                      value={maxPriority}
                      onChange={(e) => setMaxPriority(e.target.value)}
                      placeholder="e.g. 10"
                      min={1}
                      max={255}
                      className="w-full bg-[#131923] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                )}

                {/* Arbitrary Key-Value arguments */}
                <div className="space-y-2 pt-2 border-t border-[#1e2736]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-300">Custom AMQP Arguments (x-*)</span>
                    <button
                      type="button"
                      onClick={handleAddCustomArg}
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Argument</span>
                    </button>
                  </div>

                  {customArgs.map((arg, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={arg.key}
                        onChange={(e) => handleUpdateCustomArg(idx, 'key', e.target.value)}
                        placeholder="x-argument-name"
                        className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={arg.value}
                        onChange={(e) => handleUpdateCustomArg(idx, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomArg(idx)}
                        className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e2530]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#141a24] hover:bg-[#1a2332] text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-[#232c3d] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>Declare Queue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
