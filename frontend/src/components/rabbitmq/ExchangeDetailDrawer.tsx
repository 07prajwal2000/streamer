import React, { useState, useEffect } from 'react';
import {
  X,
  GitFork,
  Link,
  Plus,
  Trash2,
  Send,
  RefreshCw,
  Activity,
  Layers,
  Shield,
  Unlink,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import {
  GetRabbitMQExchangeDetails,
  DeleteRabbitMQBinding,
} from '../../../wailsjs/go/main/App';

interface ExchangeDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vhost: string;
  exchangeName: string;
  onOpenBindingModal: (sourceExchange: string) => void;
  onDelete?: (vhost: string, name: string) => void;
  onPublishToExchange?: (exchange: string) => void;
}

export const ExchangeDetailDrawer: React.FC<ExchangeDetailDrawerProps> = ({
  isOpen,
  onClose,
  vhost,
  exchangeName,
  onOpenBindingModal,
  onDelete,
  onPublishToExchange,
}) => {
  const [detail, setDetail] = useState<rabbitmqmanager.RMQExchangeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unbindingKey, setUnbindingKey] = useState<string | null>(null);

  const loadDetails = async () => {
    if (!vhost) return;
    setLoading(true);
    setError(null);
    try {
      const data = await GetRabbitMQExchangeDetails(vhost, exchangeName);
      setDetail(data);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && vhost) {
      loadDetails();
    }
  }, [isOpen, vhost, exchangeName]);

  const handleUnbind = async (binding: rabbitmqmanager.RMQBindingInfo) => {
    setUnbindingKey(`${binding.source}->${binding.destination}`);
    try {
      const params = new rabbitmqmanager.CreateBindingParams({
        vhost: binding.vhost,
        source: binding.source,
        destination: binding.destination,
        destinationType: binding.destinationType,
        routingKey: binding.routingKey,
        arguments: binding.arguments,
      });
      await DeleteRabbitMQBinding(params);
      await loadDetails();
    } catch (err: any) {
      alert(`Unbind failed: ${err}`);
    } finally {
      setUnbindingKey(null);
    }
  };

  if (!isOpen) return null;

  const isDefaultExchange = exchangeName === '' || exchangeName === '(AMQP default)';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm select-none">
      <div className="w-full max-w-2xl bg-[#090d13] border-l border-[#1e2530] flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <GitFork className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white truncate font-mono">
                  {exchangeName === '' ? '(AMQP default)' : exchangeName}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#18202c] text-blue-300 border border-[#222c3c]">
                  {detail?.type || 'direct'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono">vhost: {vhost}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDetails}
              disabled={loading}
              title="Refresh details"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a212d] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}

          {/* Properties & Rate */}
          {detail && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530] space-y-2 text-xs">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Specification</span>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Durability:</span>
                  <span className="font-mono text-white">{detail.durable ? 'Durable' : 'Transient'}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Auto-Delete:</span>
                  <span className="font-mono text-white">{detail.autoDelete ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Internal Only:</span>
                  <span className="font-mono text-white">{detail.internal ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0e131b] border border-[#1e2530] space-y-2 text-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Publish Throughput</span>
                  <div className="text-xl font-mono font-bold text-white mt-1">
                    {detail.messageRates?.publishRate?.toFixed(1) || '0.0'} /s
                  </div>
                </div>
                <div className="text-[10px] text-gray-500">
                  Incoming messages routed through this exchange
                </div>
              </div>
            </div>
          )}

          {/* Outbound Bindings (Source -> Destination Queues/Exchanges) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Link className="w-3.5 h-3.5 text-blue-400" />
                Bound Destinations ({detail?.bindingsSource?.length || 0})
              </h3>

              {!isDefaultExchange && (
                <button
                  onClick={() => onOpenBindingModal(exchangeName)}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Binding</span>
                </button>
              )}
            </div>

            <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                    <th className="py-2.5 px-3 font-medium">Type</th>
                    <th className="py-2.5 px-3 font-medium">Destination</th>
                    <th className="py-2.5 px-3 font-medium">Routing Key</th>
                    <th className="py-2.5 px-3 font-medium">Arguments</th>
                    <th className="py-2.5 px-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202c]">
                  {!detail?.bindingsSource || detail.bindingsSource.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 text-xs">
                        {isDefaultExchange
                          ? 'Default exchange automatically routes to all queues with queue name as routing key'
                          : 'No bindings declared for this exchange'}
                      </td>
                    </tr>
                  ) : (
                    detail.bindingsSource.map((b, idx) => (
                      <tr key={idx} className="hover:bg-[#121822]">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                              b.destinationType === 'queue'
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-blue-500/15 text-blue-400'
                            }`}
                          >
                            {b.destinationType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-white font-medium">
                          {b.destination}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-blue-300">
                          {b.routingKey || '(empty)'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-400 text-[11px]">
                          {b.arguments && Object.keys(b.arguments).length > 0
                            ? JSON.stringify(b.arguments)
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleUnbind(b)}
                            disabled={unbindingKey === `${b.source}->${b.destination}`}
                            title="Remove binding"
                            className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inbound Bindings (Destination <- Other Exchanges) */}
          {detail?.bindingsDestination && detail.bindingsDestination.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <GitFork className="w-3.5 h-3.5 text-purple-400" />
                Inbound Exchanges Routing Here ({detail.bindingsDestination.length})
              </h3>

              <div className="rounded-xl border border-[#1e2530] bg-[#0c1017] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px]">
                      <th className="py-2 px-3 font-medium">Source Exchange</th>
                      <th className="py-2 px-3 font-medium">Routing Key</th>
                      <th className="py-2 px-3 font-medium">Arguments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#18202c]">
                    {detail.bindingsDestination.map((b, idx) => (
                      <tr key={idx} className="hover:bg-[#121822]">
                        <td className="py-2.5 px-3 font-mono text-white">{b.source}</td>
                        <td className="py-2.5 px-3 font-mono text-purple-300">{b.routingKey || '(empty)'}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-400 text-[11px]">
                          {b.arguments ? JSON.stringify(b.arguments) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1e2530] bg-[#0c1017] flex items-center justify-between gap-3">
          <div>
            {!isDefaultExchange && onDelete && (
              <button
                onClick={() => onDelete(vhost, exchangeName)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Exchange</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onPublishToExchange && (
              <button
                onClick={() => {
                  onPublishToExchange(exchangeName);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish to Exchange</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
