import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  GitFork,
  Sliders,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Boxes,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import { CreateRabbitMQExchange } from '../../../wailsjs/go/main/App';

interface CreateExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  vhosts?: string[];
  currentVhost?: string;
}

export const CreateExchangeModal: React.FC<CreateExchangeModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  vhosts = ['/'],
  currentVhost = '/',
}) => {
  const [name, setName] = useState('');
  const [vhost, setVhost] = useState(currentVhost || '/');
  const [type, setType] = useState<'direct' | 'fanout' | 'topic' | 'headers'>('direct');
  const [durable, setDurable] = useState(true);
  const [autoDelete, setAutoDelete] = useState(false);
  const [internal, setInternal] = useState(false);
  const [alternateExchange, setAlternateExchange] = useState('');
  const [customArgs, setCustomArgs] = useState<{ key: string; value: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setVhost(currentVhost || '/');
      setType('direct');
      setDurable(true);
      setAutoDelete(false);
      setInternal(false);
      setAlternateExchange('');
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
      setError('Exchange name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const argsMap: Record<string, any> = {};
      if (alternateExchange.trim()) {
        argsMap['alternate-exchange'] = alternateExchange.trim();
      }
      for (const item of customArgs) {
        if (item.key.trim()) {
          const num = Number(item.value.trim());
          if (!isNaN(num) && item.value.trim() !== '') {
            argsMap[item.key.trim()] = num;
          } else {
            argsMap[item.key.trim()] = item.value.trim();
          }
        }
      }

      const params = new rabbitmqmanager.CreateExchangeParams({
        name: name.trim(),
        vhost: vhost.trim() || '/',
        type: type,
        durable: durable,
        autoDelete: autoDelete,
        internal: internal,
        customArguments: Object.keys(argsMap).length > 0 ? argsMap : undefined,
      });

      await CreateRabbitMQExchange(params);
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
      <div className="w-full max-w-lg bg-[#0c1017] border border-[#1e2530] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Declare Exchange</h2>
              <p className="text-xs text-gray-500">Configure exchange type, routing strategy, and durability</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          {/* Exchange Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Routing Type</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'direct', label: 'Direct', desc: 'Exact routing key match' },
                { id: 'fanout', label: 'Fanout', desc: 'Broadcast to all bound queues' },
                { id: 'topic', label: 'Topic', desc: 'Wildcard pattern matching (*, #)' },
                { id: 'headers', label: 'Headers', desc: 'Header attributes match (x-match)' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    type === item.id
                      ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-sm'
                      : 'bg-[#121822] border-[#222c3c] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{item.label}</div>
                  <div className="text-[9px] text-gray-500 leading-tight mt-0.5 line-clamp-2">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name & Virtual Host */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Exchange Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. app.events or dlx.exchange"
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Virtual Host</label>
              <select
                value={vhost}
                onChange={(e) => setVhost(e.target.value)}
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-2.5 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
              >
                {vhosts.map((vh) => (
                  <option key={vh} value={vh}>
                    {vh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Durability, AutoDelete, Internal */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#111722] border border-[#1e2736]">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={durable}
                onChange={(e) => setDurable(e.target.checked)}
                className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-blue-600 focus:ring-0"
              />
              <span>Durable</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={autoDelete}
                onChange={(e) => setAutoDelete(e.target.checked)}
                className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-blue-600 focus:ring-0"
              />
              <span>Auto-Delete</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-blue-600 focus:ring-0"
              />
              <span>Internal Only</span>
            </label>
          </div>

          {/* Alternate Exchange */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300 flex items-center justify-between">
              <span>Alternate Exchange (Optional)</span>
              <span className="text-[10px] text-gray-500">alternate-exchange argument</span>
            </label>
            <input
              type="text"
              value={alternateExchange}
              onChange={(e) => setAlternateExchange(e.target.value)}
              placeholder="e.g. unroutable.exchange"
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-gray-500">
              Messages that cannot be routed to any bound queue will be forwarded to this alternate exchange.
            </p>
          </div>

          {/* Custom Arguments */}
          <div className="space-y-2 pt-2 border-t border-[#1e2530]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-300">Custom Arguments</span>
              <button
                type="button"
                onClick={handleAddCustomArg}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
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
                  placeholder="argument-key"
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e2530]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#141a24] hover:bg-[#1a2332] text-gray-300 rounded-lg text-xs font-medium border border-[#232c3d]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>Declare Exchange</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
