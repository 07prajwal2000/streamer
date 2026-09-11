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
  Inbox,
  ExternalLink,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { sqsmanager } from '../../../wailsjs/go/models';
import {
  ListSQSQueues,
  PollSQSMessages,
  StartSQSLivePoll,
  StopSQSLivePoll,
  DeleteSQSMessage,
  ChangeSQSMessageVisibility,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { ProduceMessageModal } from './ProduceMessageModal';
import { SQSMessageInspector } from './SQSMessageInspector';
import { RedriveDLQModal } from './RedriveDLQModal';

interface SQSMessagesViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
  initialQueueUrl?: string | null;
  onClearInitialQueue?: () => void;
}

export const SQSMessagesView: React.FC<SQSMessagesViewProps> = ({
  isConnected,
  isActiveTab,
  initialQueueUrl,
  onClearInitialQueue,
}) => {
  const [queues, setQueues] = useState<sqsmanager.SQSQueueSummary[]>([]);
  const [selectedQueueUrl, setSelectedQueueUrl] = useState<string>('');

  // Mode & Polling config
  const [mode, setMode] = useState<'peek' | 'consumer'>('peek');
  const [autoDelete, setAutoDelete] = useState<boolean>(false);
  const [waitTimeSeconds, setWaitTimeSeconds] = useState<number>(5);
  const [visibilityTimeout, setVisibilityTimeout] = useState<number>(30);
  const [maxMessages, setMaxMessages] = useState<number>(10);

  // Messages state
  const [messages, setMessages] = useState<sqsmanager.SQSMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Live polling state
  const [isLivePolling, setIsLivePolling] = useState<boolean>(false);
  const livePollUnsubRef = useRef<(() => void) | null>(null);

  // Modals & Inspector
  const [selectedMessage, setSelectedMessage] = useState<sqsmanager.SQSMessage | null>(null);
  const [showProduceModal, setShowProduceModal] = useState<boolean>(false);
  const [showRedriveModal, setShowRedriveModal] = useState<boolean>(false);

  // Load available queues
  const loadQueues = async () => {
    if (!isConnected) return;
    try {
      const data = await ListSQSQueues('');
      const qList = data || [];
      setQueues(qList);

      if (initialQueueUrl && qList.some((q) => q.queueUrl === initialQueueUrl)) {
        setSelectedQueueUrl(initialQueueUrl);
        if (onClearInitialQueue) onClearInitialQueue();
      } else if (!selectedQueueUrl && qList.length > 0) {
        setSelectedQueueUrl(qList[0].queueUrl);
      }
    } catch (err: any) {
      console.error('Failed to load SQS queues for messages view:', err);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadQueues();
    }
  }, [isConnected, isActiveTab, initialQueueUrl]);

  // Clean up live poller on unmount or tab change
  useEffect(() => {
    return () => {
      if (isLivePolling) {
        StopSQSLivePoll();
        setIsLivePolling(false);
      }
      if (livePollUnsubRef.current) {
        livePollUnsubRef.current();
        livePollUnsubRef.current = null;
      }
    };
  }, [isActiveTab, isLivePolling]);

  const activeQueue = useMemo(() => {
    return queues.find((q) => q.queueUrl === selectedQueueUrl);
  }, [queues, selectedQueueUrl]);

  // Poll Once (Batch Fetch)
  const handlePollOnce = async () => {
    if (!selectedQueueUrl) return;
    setLoading(true);
    setError(null);

    try {
      const params = new sqsmanager.PollSQSMessagesParams({
        queueUrl: selectedQueueUrl,
        mode,
        maxMessages: Number(maxMessages),
        waitTimeSeconds: Number(waitTimeSeconds),
        visibilityTimeout: Number(visibilityTimeout),
        autoDelete: mode === 'consumer' ? autoDelete : false,
      });

      const fetched = await PollSQSMessages(params);
      if (fetched && fetched.length > 0) {
        setMessages((prev) => {
          // Prepend new messages, avoid duplicate message IDs in table
          const existingIds = new Set(prev.map((m) => m.messageId));
          const newUnique = fetched.filter((m) => !existingIds.has(m.messageId));
          return [...newUnique, ...prev].slice(0, 500); // Buffer up to 500
        });
      }
      // Refresh queue counts
      loadQueues();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Toggle Continuous Live Polling
  const handleToggleLivePolling = async () => {
    if (isLivePolling) {
      // Stop
      try {
        await StopSQSLivePoll();
      } finally {
        setIsLivePolling(false);
        if (livePollUnsubRef.current) {
          livePollUnsubRef.current();
          livePollUnsubRef.current = null;
        }
      }
    } else {
      // Start
      if (!selectedQueueUrl) return;
      setError(null);
      try {
        const params = new sqsmanager.PollSQSMessagesParams({
          queueUrl: selectedQueueUrl,
          mode,
          maxMessages: Number(maxMessages),
          waitTimeSeconds: Number(waitTimeSeconds) > 0 ? Number(waitTimeSeconds) : 5,
          visibilityTimeout: Number(visibilityTimeout),
          autoDelete: mode === 'consumer' ? autoDelete : false,
        });

        // Register event listener for incoming messages
        const unsub = EventsOn('sqs:message', (rawMsg: any) => {
          const msg = new sqsmanager.SQSMessage(rawMsg);
          setMessages((prev) => {
            if (prev.some((m) => m.messageId === msg.messageId)) return prev;
            return [msg, ...prev].slice(0, 500);
          });
        });
        livePollUnsubRef.current = unsub;

        await StartSQSLivePoll(params);
        setIsLivePolling(true);
      } catch (err: any) {
        setError(String(err));
      }
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  const handleMessageDeleted = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    loadQueues();
  };

  const filteredMessages = useMemo(() => {
    if (!searchFilter.trim()) return messages;
    const term = searchFilter.toLowerCase();
    return messages.filter(
      (m) =>
        m.messageId.toLowerCase().includes(term) ||
        (m.body && m.body.toLowerCase().includes(term)) ||
        (m.messageGroupId && m.messageGroupId.toLowerCase().includes(term))
    );
  }, [messages, searchFilter]);

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 select-none">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4 text-orange-400">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Not Connected to SQS</h3>
          <p className="text-xs text-gray-500">
            Connect to an Amazon SQS endpoint or local emulator in the Connection tab to poll and produce messages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d13] select-none">
      {/* Top Controls Bar */}
      <div className="px-6 py-3.5 border-b border-[#1e2530] bg-[#0c1017] flex flex-wrap items-center justify-between gap-4">
        {/* Left: Queue Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-semibold text-white">Queue:</span>
          </div>
          <select
            value={selectedQueueUrl}
            onChange={(e) => {
              if (isLivePolling) {
                handleToggleLivePolling();
              }
              setSelectedQueueUrl(e.target.value);
            }}
            className="px-3 py-1.5 bg-[#0f141c] border border-[#1e2530] rounded-xl text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50 max-w-xs"
          >
            {queues.map((q) => (
              <option key={q.queueUrl} value={q.queueUrl}>
                {q.queueName} {q.isFifo ? '(FIFO)' : ''}{' '}
                {q.isDeadLetterQueue ? '(DLQ)' : ''}
              </option>
            ))}
          </select>

          {activeQueue?.isFifo && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 font-mono font-medium">
              FIFO
            </span>
          )}
          {activeQueue?.isDeadLetterQueue && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 font-medium">
              DLQ
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          {activeQueue?.isDeadLetterQueue && (
            <button
              onClick={() => setShowRedriveModal(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Redrive DLQ
            </button>
          )}

          <button
            onClick={() => setShowProduceModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Produce Message
          </button>
        </div>
      </div>

      {/* Mode & Polling Options Bar */}
      <div className="px-6 py-2.5 border-b border-[#1e2530] bg-[#0a0e14] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#0f141c] p-0.5 border border-[#1e2530] rounded-xl">
            <button
              onClick={() => setMode('peek')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === 'peek'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Peek Mode (Safe)
            </button>
            <button
              onClick={() => setMode('consumer')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === 'consumer'
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Consumer Mode
            </button>
          </div>

          {mode === 'peek' ? (
            <span className="text-[11px] text-gray-500 hidden sm:inline">
              Visibility = 0s (Messages remain untouched on queue)
            </span>
          ) : (
            <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={autoDelete}
                onChange={(e) => setAutoDelete(e.target.checked)}
                className="rounded text-blue-500 focus:ring-0 bg-[#0f141c] border-gray-700"
              />
              <span>Auto-Acknowledge (Delete on receipt)</span>
            </label>
          )}
        </div>

        {/* Right: Poller Controls */}
        <div className="flex items-center gap-3">
          {/* Long polling wait time */}
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <select
              value={waitTimeSeconds}
              onChange={(e) => setWaitTimeSeconds(Number(e.target.value))}
              className="px-2 py-1 bg-[#0f141c] border border-[#1e2530] rounded-lg text-white text-[11px]"
            >
              <option value={0}>0s (Short Poll)</option>
              <option value={5}>5s Long Poll</option>
              <option value={10}>10s Long Poll</option>
              <option value={20}>20s Long Poll (Max)</option>
            </select>
          </div>

          {/* Poll Once Button */}
          <button
            onClick={handlePollOnce}
            disabled={loading || isLivePolling}
            className="px-3 py-1.5 rounded-lg bg-[#151b23] border border-[#222d3d] text-gray-200 hover:text-white hover:bg-[#1a2230] text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Poll Once
          </button>

          {/* Live Tail Toggle Button */}
          <button
            onClick={handleToggleLivePolling}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isLivePolling
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {isLivePolling ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop Poller
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Live Stream
              </>
            )}
          </button>

          {/* Clear Buffer */}
          {messages.length > 0 && (
            <button
              onClick={handleClearMessages}
              title="Clear Message Table"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#151b23] transition-colors"
            >
              <Eraser className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="px-6 py-2.5 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between text-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-500 text-[11px]">Available on Queue: </span>
            <span className="font-mono font-bold text-orange-400">
              {activeQueue?.approximateNumberOfMessages?.toLocaleString() ?? 0}
            </span>
          </div>
          <div>
            <span className="text-gray-500 text-[11px]">In-Flight: </span>
            <span className="font-mono font-medium text-blue-400">
              {activeQueue?.approximateNumberOfNotVisible?.toLocaleString() ?? 0}
            </span>
          </div>
          <div>
            <span className="text-gray-500 text-[11px]">Polled in Session: </span>
            <span className="font-mono font-medium text-white">{messages.length}</span>
          </div>
        </div>

        {/* Live status dot */}
        <div className="flex items-center gap-2 text-[11px]">
          {isLivePolling ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Poller Active
            </span>
          ) : (
            <span className="text-gray-500">Poller Idle</span>
          )}
        </div>
      </div>

      {/* Search / Filter Bar */}
      <div className="px-6 py-2 border-b border-[#1e2530] bg-[#090d13]">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter polled messages by ID, group, or payload text..."
            className="w-full pl-9 pr-4 py-1.5 bg-[#0f141c] border border-[#1e2530] rounded-xl text-white text-xs placeholder-gray-600 focus:outline-hidden focus:border-orange-500/50"
          />
        </div>
      </div>

      {/* Messages Table Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400 text-xs mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {filteredMessages.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-[#151b23] border border-[#222d3d] flex items-center justify-center mx-auto mb-3 text-gray-500">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-300 mb-1">
              {messages.length === 0 ? 'No messages received yet' : 'No messages match search filter'}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              {messages.length === 0
                ? 'Click "Poll Once" to fetch available messages, or start "Live Stream" for real-time background consumption.'
                : 'Try clearing your search query to view all polled messages.'}
            </p>
            {messages.length === 0 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={handlePollOnce}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Poll Now
                </button>
                <button
                  onClick={() => setShowProduceModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#151b23] border border-[#222d3d] text-gray-300 hover:text-white text-xs font-medium"
                >
                  Produce Test Message
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-[#1e2530] rounded-2xl overflow-hidden bg-[#0c1017]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090d13] text-gray-400 border-b border-[#1e2530]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Sent Time</th>
                  <th className="py-3 px-4 font-semibold">Message ID</th>
                  {activeQueue?.isFifo && <th className="py-3 px-4 font-semibold">Group ID</th>}
                  <th className="py-3 px-4 font-semibold">Payload Preview</th>
                  <th className="py-3 px-4 font-semibold text-center">Receives</th>
                  <th className="py-3 px-4 font-semibold text-right">Size</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2530]">
                {filteredMessages.map((msg) => (
                  <tr
                    key={msg.messageId}
                    onClick={() => setSelectedMessage(msg)}
                    className="hover:bg-[#121822] transition-colors cursor-pointer group"
                  >
                    {/* Sent Timestamp */}
                    <td className="py-2.5 px-4 font-mono text-gray-400 whitespace-nowrap text-[11px]">
                      {msg.sentTimestamp ? new Date(msg.sentTimestamp).toLocaleTimeString() : 'N/A'}
                    </td>

                    {/* Message ID */}
                    <td className="py-2.5 px-4 font-mono font-medium text-orange-300 truncate max-w-xs group-hover:text-orange-200">
                      {msg.messageId}
                    </td>

                    {/* Group ID for FIFO */}
                    {activeQueue?.isFifo && (
                      <td className="py-2.5 px-4 font-mono text-gray-300 whitespace-nowrap">
                        {msg.messageGroupId || '-'}
                      </td>
                    )}

                    {/* Payload Preview */}
                    <td className="py-2.5 px-4 font-mono text-gray-300 truncate max-w-sm">
                      {msg.body}
                    </td>

                    {/* Receives */}
                    <td className="py-2.5 px-4 text-center font-mono">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          msg.receiveCount > 3
                            ? 'bg-red-500/15 border-red-500/30 text-red-400'
                            : 'bg-[#151b23] border-[#222d3d] text-blue-400'
                        }`}
                      >
                        {msg.receiveCount}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="py-2.5 px-4 text-right font-mono text-gray-400">
                      {new TextEncoder().encode(msg.body || '').length} B
                    </td>

                    {/* Actions */}
                    <td
                      className="py-2.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedMessage(msg)}
                          title="Inspect Message"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={async () => {
                            if (msg.receiptHandle && msg.queueUrl) {
                              try {
                                await DeleteSQSMessage(msg.queueUrl, msg.receiptHandle);
                                handleMessageDeleted(msg.messageId);
                              } catch (e: any) {
                                setError(String(e));
                              }
                            }
                          }}
                          title="Delete from Queue"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-[#1a2230] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Produce Modal */}
      {showProduceModal && (
        <ProduceMessageModal
          isOpen={showProduceModal}
          selectedQueueUrl={selectedQueueUrl}
          availableQueues={queues}
          onClose={() => setShowProduceModal(false)}
          onProduced={() => {
            loadQueues();
          }}
        />
      )}

      {/* Redrive DLQ Modal */}
      {showRedriveModal && (
        <RedriveDLQModal
          isOpen={showRedriveModal}
          sourceQueueUrl={selectedQueueUrl}
          availableQueues={queues}
          onClose={() => setShowRedriveModal(false)}
          onRedriveComplete={() => {
            loadQueues();
          }}
        />
      )}

      {/* Message Inspector Drawer */}
      {selectedMessage && (
        <SQSMessageInspector
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onMessageDeleted={handleMessageDeleted}
          onResend={(msg) => {
            setSelectedMessage(null);
            setShowProduceModal(true);
          }}
        />
      )}
    </div>
  );
};
