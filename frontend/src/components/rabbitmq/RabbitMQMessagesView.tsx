import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Send,
  Play,
  Square,
  AlertTriangle,
  Clock,
  Layers,
  Filter,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Eraser,
  X,
  Eye,
  EyeOff,
  Boxes,
  RotateCcw,
  Radio,
  Database,
  Sliders,
} from 'lucide-react';
import { rabbitmqmanager } from '../../../wailsjs/go/models';
import {
  ListRabbitMQQueues,
  ListRabbitMQVHosts,
  ListRabbitMQExchanges,
  PeekRabbitMQMessages,
  StartRabbitMQLiveConsume,
  StopRabbitMQLiveConsume,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { PublishMessageModal } from './PublishMessageModal';
import { RabbitMQMessageInspector } from './RabbitMQMessageInspector';
import { RedriveDLQModal } from './RedriveDLQModal';

interface RabbitMQMessagesViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
  initialQueue?: string | null;
  onClearInitialQueue?: () => void;
}

export const RabbitMQMessagesView: React.FC<RabbitMQMessagesViewProps> = ({
  isConnected,
  isActiveTab,
  initialQueue,
  onClearInitialQueue,
}) => {
  const [vhosts, setVhosts] = useState<string[]>(['/']);
  const [selectedVhost, setSelectedVhost] = useState<string>('/');
  const [queues, setQueues] = useState<rabbitmqmanager.RMQQueueSummary[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string>('');
  const [exchanges, setExchanges] = useState<string[]>([]);

  // Mode: Peek vs Live AMQP Push Stream
  const [mode, setMode] = useState<'peek' | 'stream'>('peek');
  const [peekCount, setPeekCount] = useState<number>(10);
  const [requeue, setRequeue] = useState<boolean>(true);

  // Live stream settings
  const [prefetchCount, setPrefetchCount] = useState<number>(100);
  const [autoAck, setAutoAck] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const liveConsumeUnsubRef = useRef<(() => void) | null>(null);

  // Messages list state
  const [messages, setMessages] = useState<rabbitmqmanager.RMQMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modals & Inspector
  const [selectedMessage, setSelectedMessage] = useState<rabbitmqmanager.RMQMessage | null>(null);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [showRedriveModal, setShowRedriveModal] = useState<boolean>(false);
  const [cloneToPublishMsg, setCloneToPublishMsg] = useState<rabbitmqmanager.RMQMessage | null>(null);

  // Load available queues & vhosts
  const loadQueuesAndVHosts = async () => {
    if (!isConnected) return;
    try {
      const [vhList, qList, exList] = await Promise.all([
        ListRabbitMQVHosts().catch(() => []),
        ListRabbitMQQueues(selectedVhost).catch(() => []),
        ListRabbitMQExchanges(selectedVhost).catch(() => []),
      ]);

      if (vhList && vhList.length > 0) {
        setVhosts(vhList.map((v) => v.name));
      }
      const qs = qList || [];
      setQueues(qs);
      if (exList) {
        setExchanges(exList.map((e) => (e.name === '' ? '(AMQP default)' : e.name)));
      }

      if (initialQueue && qs.some((q) => q.name === initialQueue)) {
        setSelectedQueue(initialQueue);
        if (onClearInitialQueue) onClearInitialQueue();
      } else if (!selectedQueue && qs.length > 0) {
        setSelectedQueue(qs[0].name);
      }
    } catch (err: any) {
      console.error('Failed to load queues/vhosts for messages view:', err);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadQueuesAndVHosts();
    }
  }, [isConnected, isActiveTab, selectedVhost, initialQueue]);

  const isStreamingRef = useRef(isStreaming);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Clean up live stream only on unmount
  useEffect(() => {
    return () => {
      if (isStreamingRef.current) {
        StopRabbitMQLiveConsume().catch(console.error);
        if (liveConsumeUnsubRef.current) {
          liveConsumeUnsubRef.current();
          liveConsumeUnsubRef.current = null;
        }
      }
    };
  }, []);

  // Handle Peek Messages
  const handlePeek = async () => {
    if (!selectedQueue) return;
    setLoading(true);
    setError(null);
    try {
      const params = new rabbitmqmanager.PeekRMQMessagesParams({
        vhost: selectedVhost || '/',
        queueName: selectedQueue,
        count: peekCount || 10,
        ackMode: requeue ? 'ack_requeue_true' : 'ack_requeue_false',
        encoding: 'auto',
      });
      const data = await PeekRabbitMQMessages(params);
      setMessages(data || []);
      if (data && data.length > 0) {
        setSelectedMessage(data[0]);
      } else {
        setSelectedMessage(null);
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Toggle Live Consumer Stream
  const toggleLiveStream = async () => {
    if (isStreaming) {
      // Stop
      setIsStreaming(false);
      if (liveConsumeUnsubRef.current) {
        liveConsumeUnsubRef.current();
        liveConsumeUnsubRef.current = null;
      }
      try {
        await StopRabbitMQLiveConsume();
      } catch (err) {
        console.error('Stop consume error:', err);
      }
    } else {
      // Start
      if (!selectedQueue) return;
      setError(null);
      setIsStreaming(true);

      try {
        const unsub = EventsOn('rabbitmq:message', (data: any) => {
          const msg = new rabbitmqmanager.RMQMessage(data);
          setMessages((prev) => {
            const isDup = prev.some((m) => {
              if (msg.messageId && m.messageId) {
                return m.messageId === msg.messageId;
              }
              return (
                m.deliveryTag === msg.deliveryTag &&
                m.payload === msg.payload &&
                m.routingKey === msg.routingKey
              );
            });
            if (isDup) return prev;
            return [msg, ...prev].slice(0, 500);
          });
        });
        liveConsumeUnsubRef.current = unsub;

        const params = new rabbitmqmanager.ConsumeRMQMessagesParams({
          vhost: selectedVhost || '/',
          queueName: selectedQueue,
          prefetchCount: prefetchCount || 100,
          autoAck: autoAck,
          exclusive: false,
        });

        await StartRabbitMQLiveConsume(params);
      } catch (err: any) {
        setError(String(err));
        setIsStreaming(false);
        if (liveConsumeUnsubRef.current) {
          liveConsumeUnsubRef.current();
          liveConsumeUnsubRef.current = null;
        }
      }
    }
  };

  // Filter messages in memory
  const filteredMessages = useMemo(() => {
    if (!searchFilter.trim()) return messages;
    const term = searchFilter.toLowerCase();
    return messages.filter((m) => {
      return (
        m.payload.toLowerCase().includes(term) ||
        (m.messageId && m.messageId.toLowerCase().includes(term)) ||
        (m.routingKey && m.routingKey.toLowerCase().includes(term)) ||
        (m.correlationId && m.correlationId.toLowerCase().includes(term))
      );
    });
  }, [messages, searchFilter]);

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 select-none">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Not Connected to RabbitMQ</h3>
          <p className="text-xs text-gray-500 mb-4">
            Connect to a RabbitMQ broker in the Connections tab to inspect and stream messages.
          </p>
        </div>
      </div>
    );
  }

  const currentQueueSummary = queues.find((q) => q.name === selectedQueue);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d13] select-none">
      {/* Top Toolbar */}
      <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-rose-400" />
            Messages Studio
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Safe non-destructive peeking, push streaming, and AMQP message publishing
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentQueueSummary?.hasDlx && (
            <button
              onClick={() => setShowRedriveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg text-xs font-medium border border-amber-500/30 transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Redrive DLQ</span>
            </button>
          )}

          <button
            onClick={() => {
              setCloneToPublishMsg(null);
              setShowPublishModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish Message</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Queue Selector & Mode Tabs */}
      <div className="px-6 py-3 border-b border-[#18202c] bg-[#090d13] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* VHost Selector */}
          <div className="flex items-center gap-1.5 bg-[#141a24] border border-[#232c3d] rounded-lg px-2.5 py-1.5 text-xs">
            <Database className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedVhost}
              onChange={(e) => setSelectedVhost(e.target.value)}
              className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
            >
              {vhosts.map((vh) => (
                <option key={vh} value={vh} className="bg-[#141a24] text-white">
                  {vh}
                </option>
              ))}
            </select>
          </div>

          {/* Queue Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Queue:</span>
            <select
              value={selectedQueue}
              onChange={(e) => {
                setSelectedQueue(e.target.value);
                setMessages([]);
                setSelectedMessage(null);
              }}
              className="bg-[#141a24] border border-[#232c3d] text-white font-mono text-xs rounded-lg px-3 py-1.5 focus:border-rose-500 focus:outline-none min-w-[200px]"
            >
              {queues.length === 0 ? (
                <option value="">No queues declared</option>
              ) : (
                queues.map((q) => (
                  <option key={q.name} value={q.name} className="bg-[#141a24] text-white font-mono">
                    {q.name} ({q.messagesReady} ready)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#131923] p-1 rounded-lg border border-[#232c3d]">
            <button
              onClick={async () => {
                if (isStreaming) await toggleLiveStream();
                setMode('peek');
              }}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                mode === 'peek'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2332]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Safe Peek</span>
            </button>
            <button
              onClick={() => {
                setMode('stream');
              }}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                mode === 'stream'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2332]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Consumer</span>
            </button>
          </div>
        </div>

        {/* Action Controls for Active Mode */}
        <div className="flex items-center gap-3">
          {mode === 'peek' ? (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requeue}
                  onChange={(e) => setRequeue(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
                />
                <span className="font-medium">Requeue (Safe)</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span>Count:</span>
                <input
                  type="number"
                  value={peekCount}
                  onChange={(e) => setPeekCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 10)))}
                  min={1}
                  max={100}
                  className="w-14 bg-[#141a24] border border-[#232c3d] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <button
                onClick={handlePeek}
                disabled={loading || !selectedQueue}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium shadow-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Peek Messages</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span>QoS Prefetch:</span>
                <input
                  type="number"
                  value={prefetchCount}
                  onChange={(e) => setPrefetchCount(Math.max(1, parseInt(e.target.value, 10) || 100))}
                  className="w-16 bg-[#141a24] border border-[#232c3d] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAck}
                  onChange={(e) => setAutoAck(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-rose-600 focus:ring-0"
                />
                <span>Auto-Ack</span>
              </label>

              <button
                onClick={toggleLiveStream}
                disabled={!selectedQueue}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                  isStreaming
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Stream</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Stream</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 mx-6 mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Pane: Split Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Side: Messages Table */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#1e2530]">
          {/* Sub-toolbar: Search & Clear */}
          <div className="px-4 py-2 border-b border-[#18202c] bg-[#0c1017] flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter messages in buffer..."
                className="w-full bg-[#131923] border border-[#232c3d] rounded-lg pl-7 pr-3 py-1 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 font-mono">
                {filteredMessages.length} message{filteredMessages.length === 1 ? '' : 's'}
              </span>

              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    setSelectedMessage(null);
                  }}
                  title="Clear message buffer"
                  className="p-1 rounded text-gray-500 hover:text-white hover:bg-[#1e2530]"
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1e2530] bg-[#101620] text-gray-400 text-[11px] sticky top-0 z-10">
                  <th className="py-2 px-3 font-medium">Tag</th>
                  <th className="py-2 px-3 font-medium">Routing Key</th>
                  <th className="py-2 px-3 font-medium">Payload Preview</th>
                  <th className="py-2 px-3 font-medium">Size</th>
                  <th className="py-2 px-3 font-medium">Content-Type</th>
                  <th className="py-2 px-3 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18202c]">
                {filteredMessages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-500 text-xs">
                      {isStreaming ? (
                        <div className="flex flex-col items-center gap-2">
                          <Radio className="w-5 h-5 text-rose-400 animate-pulse" />
                          <span>Streaming active... waiting for messages on '{selectedQueue}'</span>
                        </div>
                      ) : (
                        <span>No messages in buffer. Click "Peek Messages" or "Start Stream".</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredMessages.map((msg, idx) => {
                    const isSelected = selectedMessage === msg;
                    const dateStr =
                      msg.timestamp && msg.timestamp > 0
                        ? new Date(msg.timestamp).toLocaleTimeString()
                        : '-';
                    const rowKey = msg.messageId
                      ? `${msg.messageId}-${idx}`
                      : `${msg.deliveryTag}-${msg.timestamp || idx}-${idx}`;

                    return (
                      <tr
                        key={rowKey}
                        onClick={() => setSelectedMessage(msg)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-rose-500/15 text-white'
                            : 'hover:bg-[#121822] text-gray-300'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-gray-400 flex items-center gap-1.5">
                          <span>#{msg.deliveryTag}</span>
                          {msg.redelivered && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Redelivered" />
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-rose-300 max-w-[120px] truncate" title={msg.routingKey}>
                          {msg.routingKey || '(none)'}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-300 max-w-[260px] truncate">
                          {msg.payload || '<empty>'}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-400 text-[11px]">
                          {msg.payloadBytes} B
                        </td>
                        <td className="py-2 px-3 text-gray-400 text-[11px]">
                          {msg.contentType || 'text/plain'}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-400 text-[11px]">
                          {dateStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Message Inspector Pane */}
        <div className="w-[450px] shrink-0 h-full flex flex-col">
          {selectedMessage ? (
            <RabbitMQMessageInspector
              message={selectedMessage}
              onClose={() => setSelectedMessage(null)}
              onResend={(msg) => {
                setCloneToPublishMsg(msg);
                setShowPublishModal(true);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-500">
              <Boxes className="w-8 h-8 opacity-40 mb-2" />
              <div className="text-xs font-medium">No Message Selected</div>
              <p className="text-[11px] text-gray-600 mt-1 max-w-[200px]">
                Click on any row in the message table to inspect properties and headers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <PublishMessageModal
          isOpen={showPublishModal}
          onClose={() => {
            setShowPublishModal(false);
            setCloneToPublishMsg(null);
          }}
          onPublished={() => {
            if (mode === 'peek') handlePeek();
          }}
          vhost={selectedVhost}
          availableExchanges={exchanges}
          initialExchange={cloneToPublishMsg ? cloneToPublishMsg.exchange : ''}
          initialRoutingKey={cloneToPublishMsg ? cloneToPublishMsg.routingKey : selectedQueue}
          initialPayload={cloneToPublishMsg ? cloneToPublishMsg.payload : ''}
          initialHeaders={cloneToPublishMsg ? cloneToPublishMsg.headers : undefined}
        />
      )}

      {/* Redrive Modal */}
      {showRedriveModal && (
        <RedriveDLQModal
          isOpen={showRedriveModal}
          onClose={() => setShowRedriveModal(false)}
          onSuccess={() => {
            handlePeek();
          }}
          vhost={selectedVhost}
          sourceQueue={selectedQueue}
          initialTargetExchange={currentQueueSummary?.dlxTarget || ''}
          initialTargetRoutingKey={currentQueueSummary?.dlxRoutingKey || ''}
        />
      )}
    </div>
  );
};
