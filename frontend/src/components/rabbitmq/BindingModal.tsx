import React, { useState, useEffect } from 'react';
import {
  X,
  Link,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  GitFork,
  Layers,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import { CreateRabbitMQBinding } from '../../../wailsjs/go/main/App';

interface BindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  vhost: string;
  initialSourceExchange?: string;
  availableExchanges?: string[];
  availableQueues?: string[];
}

export const BindingModal: React.FC<BindingModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  vhost,
  initialSourceExchange = '',
  availableExchanges = [],
  availableQueues = [],
}) => {
  const [source, setSource] = useState(initialSourceExchange);
  const [destinationType, setDestinationType] = useState<'queue' | 'exchange'>('queue');
  const [destination, setDestination] = useState('');
  const [routingKey, setRoutingKey] = useState('');
  const [argumentsList, setArgumentsList] = useState<{ key: string; value: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSource(initialSourceExchange);
      setDestinationType('queue');
      setDestination(availableQueues.length > 0 ? availableQueues[0] : '');
      setRoutingKey('');
      setArgumentsList([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialSourceExchange]);

  if (!isOpen) return null;

  const handleAddArg = () => {
    setArgumentsList((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveArg = (index: number) => {
    setArgumentsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateArg = (index: number, field: 'key' | 'value', val: string) => {
    setArgumentsList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError('Destination queue or exchange is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const argsMap: Record<string, any> = {};
      for (const item of argumentsList) {
        if (item.key.trim()) {
          const num = Number(item.value.trim());
          if (!isNaN(num) && item.value.trim() !== '') {
            argsMap[item.key.trim()] = num;
          } else {
            argsMap[item.key.trim()] = item.value.trim();
          }
        }
      }

      const params = new rabbitmqmanager.CreateBindingParams({
        vhost: vhost || '/',
        source: source.trim(),
        destination: destination.trim(),
        destinationType: destinationType,
        routingKey: routingKey.trim(),
        arguments: Object.keys(argsMap).length > 0 ? argsMap : undefined,
      });

      await CreateRabbitMQBinding(params);
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
              <Link className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Create AMQP Binding</h2>
              <p className="text-xs text-gray-500">Route messages from exchange to queue or another exchange</p>
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

          {/* Source Exchange */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">From Exchange (Source)</label>
            <input
              type="text"
              list="binding-source-exchanges"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. amq.topic or my-exchange"
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
            />
            <datalist id="binding-source-exchanges">
              {availableExchanges.map((ex) => (
                <option key={ex} value={ex} />
              ))}
            </datalist>
          </div>

          {/* Destination Type & Destination */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">To Destination</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDestinationType('queue');
                  if (availableQueues.length > 0) setDestination(availableQueues[0]);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  destinationType === 'queue'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-[#121822] border-[#222c3c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>To Queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDestinationType('exchange');
                  if (availableExchanges.length > 0) setDestination(availableExchanges[0]);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  destinationType === 'exchange'
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-[#121822] border-[#222c3c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>To Exchange (E2E)</span>
              </button>
            </div>

            <input
              type="text"
              list="binding-destinations"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={destinationType === 'queue' ? 'Queue name' : 'Exchange name'}
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
              required
            />
            <datalist id="binding-destinations">
              {(destinationType === 'queue' ? availableQueues : availableExchanges).map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          {/* Routing Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Routing Key / Binding Key</label>
            <input
              type="text"
              value={routingKey}
              onChange={(e) => setRoutingKey(e.target.value)}
              placeholder="e.g. orders.*, user.created, or exact string"
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
            />
            <p className="text-[11px] text-gray-500">
              For topic exchanges, use * (one word) and # (zero or more words). For direct exchanges, enter the exact key.
            </p>
          </div>

          {/* Binding Arguments */}
          <div className="space-y-2 pt-2 border-t border-[#1e2530]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-300">Arguments (Headers Exchange Filtering)</span>
              <button
                type="button"
                onClick={handleAddArg}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3 h-3" />
                <span>Add Argument</span>
              </button>
            </div>

            {argumentsList.map((arg, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={arg.key}
                  onChange={(e) => handleUpdateArg(idx, 'key', e.target.value)}
                  placeholder="key (e.g. x-match, format)"
                  className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={arg.value}
                  onChange={(e) => handleUpdateArg(idx, 'value', e.target.value)}
                  placeholder="value (e.g. all, json)"
                  className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveArg(idx)}
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
              disabled={loading || !destination.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>Bind</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
