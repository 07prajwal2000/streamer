import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  RotateCcw, 
  Search, 
  Filter, 
  Layers, 
  Clock, 
  Repeat, 
  ChevronRight,
  Radio,
  Share2
} from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';
import { 
  Subscribe, 
  Unsubscribe, 
  GetActiveSubscriptions 
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { DataPayloadViewer } from '../DataPayloadViewer';
import { PublisherPanel } from './PublisherPanel';
import { ResizableSplit } from '../common/ResizableSplit';

export const PubSubView: React.FC = () => {
  // Subscription management
  const [subscriptions, setSubscriptions] = useState<natsmanager.SubscriptionInfo[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [newQueue, setNewQueue] = useState('');
  const [showSubModal, setShowSubModal] = useState(false);

  // Message streaming
  const [messages, setMessages] = useState<natsmanager.PubSubMessage[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Filters & Search
  const [filterQuery, setFilterQuery] = useState('');
  const [filterSubId, setFilterSubId] = useState<string | 'all'>('all');

  // Re-publish state
  const [republishData, setRepublishData] = useState<{ subject: string; payload: string } | null>(null);

  const loadSubs = async () => {
    try {
      const subs = await GetActiveSubscriptions();
      setSubscriptions(subs || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSubs();

    // Listen for incoming live messages from NATS
    const cancelMsgEvent = EventsOn('nats:message', (data: any) => {
      if (isPausedRef.current) return;

      const msg = new natsmanager.PubSubMessage(data);
      setMessages((prev) => {
        // Keep a ring buffer of last 500 messages to prevent memory bloat
        const updated = [msg, ...prev];
        return updated.length > 500 ? updated.slice(0, 500) : updated;
      });
    });

    return () => {
      if (cancelMsgEvent) cancelMsgEvent();
    };
  }, []);

  const handleSubscribe = async () => {
    if (!newSubject.trim()) return;
    try {
      const id = `sub-${crypto.randomUUID().slice(0, 8)}`;
      const subInfo = await Subscribe(id, newSubject.trim(), newQueue.trim());
      setSubscriptions((prev) => [...prev, subInfo]);
      setNewSubject('');
      setNewQueue('');
      setShowSubModal(false);
    } catch (err) {
      alert(`Subscribe error: ${err}`);
    }
  };

  const handleUnsubscribe = async (id: string) => {
    try {
      await Unsubscribe(id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      if (filterSubId === id) setFilterSubId('all');
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    setSelectedMsgId(null);
  };

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    if (filterSubId !== 'all' && msg.subId !== filterSubId) return false;
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return msg.subject.toLowerCase().includes(q) || msg.data.toLowerCase().includes(q);
  });

  const selectedMsg = messages.find((m) => m.id === selectedMsgId) || (filteredMessages.length > 0 ? filteredMessages[0] : null);

  const handleRepublish = (msg: natsmanager.PubSubMessage) => {
    setRepublishData({
      subject: msg.subject,
      payload: msg.data,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden select-none">
      {/* Top Controls Header */}
      <div className="h-12 px-4 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter by subject or payload content..."
              className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 focus:outline-none"
            />
          </div>

          <select
            value={filterSubId}
            onChange={(e) => setFilterSubId(e.target.value)}
            className="bg-[#131923] border border-[#232c3d] rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
          >
            <option value="all">All Topics ({messages.length})</option>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Resume Stream */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isPaused
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-[#151b24] border-[#222b3a] text-gray-300 hover:text-white'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Clear Buffer */}
          <button
            onClick={handleClearMessages}
            title="Clear Stream"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1c2433] border border-[#222b3a] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Add Subscription Button */}
          <button
            onClick={() => setShowSubModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/30 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Subscribe Topic</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Active Subs & Stream | Right Message Details */}
      <div className="flex-1 flex min-h-0">
        <ResizableSplit
          direction="horizontal"
          initialPercent={60}
          minPercent={30}
          maxPercent={80}
          storageKey="pubsub_layout"
          first={
            <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0a0e14]">
              {/* Active Subscriptions Pills Bar */}
              <div className="px-3 py-2 border-b border-[#1a222e] bg-[#0c1017] flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-[10px] uppercase font-bold text-gray-500 shrink-0">Subs:</span>
                {subscriptions.length === 0 ? (
                  <span className="text-[11px] text-gray-600 italic">
                    No active subscriptions. Click "+ Subscribe Topic" above.
                  </span>
                ) : (
                  subscriptions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#141b26] border border-[#212b3c] text-xs shrink-0"
                    >
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span className="font-mono text-gray-200 text-[11px]">{s.subject}</span>
                      {s.queueGroup && (
                        <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1 rounded">
                          {s.queueGroup}
                        </span>
                      )}
                      <button
                        onClick={() => handleUnsubscribe(s.id)}
                        className="p-0.5 text-gray-500 hover:text-rose-400 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Messages Table Header */}
              <div className="grid grid-cols-12 px-3 py-1.5 bg-[#0e131b] border-b border-[#1c2432] text-[10px] font-semibold uppercase tracking-wider text-gray-500 shrink-0">
                <span className="col-span-2">Time</span>
                <span className="col-span-4">Subject</span>
                <span className="col-span-2 text-right">Size</span>
                <span className="col-span-4 pl-3">Payload Snippet</span>
              </div>

              {/* Messages Stream List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#151c27]">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-600 space-y-1">
                    <div>No messages received yet.</div>
                    <div className="text-[11px] text-gray-700">
                      Publish to a subscribed subject or wait for inbound traffic.
                    </div>
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isSelected = selectedMsg?.id === msg.id;
                    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <div
                        key={msg.id}
                        onClick={() => setSelectedMsgId(msg.id)}
                        className={`p-2.5 text-xs font-mono cursor-pointer transition-colors space-y-1 ${
                          isSelected
                            ? 'bg-blue-600/15 text-white font-medium border-l-2 border-blue-500'
                            : 'hover:bg-[#111720] text-gray-300'
                        }`}
                      >
                        {/* Line 1: Subject full line with time badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-blue-500 dark:text-blue-400 truncate text-[12px]">
                            {msg.subject}
                          </span>
                          <span className="text-[10px] text-gray-500 shrink-0 font-sans">
                            {timeStr}
                          </span>
                        </div>

                        {/* Line 2: Size and Payload snippet */}
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span className="text-[10px] bg-black/10 dark:bg-[#141b26] px-1.5 py-0.2 rounded border border-[#212b3c] text-gray-500 shrink-0">
                            {msg.size} B
                          </span>
                          <span className="truncate text-gray-500 dark:text-gray-400">
                            {msg.isBinary ? '[Binary Data]' : msg.data.replace(/\s+/g, ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          }
          second={
            <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0d1117]">
              {selectedMsg ? (
                <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
                  {/* Message Header Bar */}
                  <div className="p-2.5 rounded-lg bg-[#111722] border border-[#1e2736] space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Subject:</span>
                        <span className="font-mono text-xs text-blue-400 font-semibold truncate">
                          {selectedMsg.subject}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRepublish(selectedMsg)}
                        title="Load into Publisher"
                        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#18212e] hover:bg-[#202c3d] border border-[#243042] transition-colors shrink-0"
                      >
                        <Repeat className="w-3 h-3 text-emerald-400" />
                        <span>Re-publish</span>
                      </button>
                    </div>

                    {selectedMsg.reply && (
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Reply-To:</span>
                        <span className="text-purple-400 text-[11px] truncate">{selectedMsg.reply}</span>
                      </div>
                    )}

                    {/* Headers Display */}
                    {selectedMsg.headers && Object.keys(selectedMsg.headers).length > 0 && (
                      <div className="pt-1.5 border-t border-[#1c2432] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Headers:</span>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(selectedMsg.headers).map(([k, vals]) => (
                            <span
                              key={k}
                              className="px-1.5 py-0.5 rounded bg-[#18212e] text-[10px] font-mono text-cyan-300 border border-[#232f42]"
                            >
                              <span className="text-gray-400">{k}:</span> {(vals as string[]).join(', ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Collapsible JSON / Hex / Text Payload Viewer */}
                  <div className="flex-1 min-h-0">
                    <DataPayloadViewer data={selectedMsg.data} isBinary={selectedMsg.isBinary} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-xs text-gray-600 space-y-1">
                  <div>No message selected.</div>
                  <div className="text-[11px] text-gray-700">
                    Click any message from the stream on the left to inspect its payload and headers.
                  </div>
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* Docked Publisher Panel at Bottom */}
      <PublisherPanel
        initialSubject={republishData?.subject}
        initialPayload={republishData?.payload}
        onMessageSent={(msg) => {
          // If request-reply received a response, push it right into the stream
          setMessages((prev) => [msg, ...prev]);
        }}
      />

      {/* Subscribe Topic Modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-[#111722] border border-[#1f2838] rounded-xl p-5 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-sm font-semibold text-white">Subscribe to Topic</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Support for exact subjects or wildcards (<code className="text-gray-300">*</code> single token,{' '}
                <code className="text-gray-300">&gt;</code> multi token).
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Subject</label>
                <input
                  type="text"
                  autoFocus
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. orders.*.created or telemetry.>"
                  className="w-full bg-[#151c27] border border-[#242e3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Queue Group <span className="text-gray-500 font-normal">(Optional for load balancing)</span>
                </label>
                <input
                  type="text"
                  value={newQueue}
                  onChange={(e) => setNewQueue(e.target.value)}
                  placeholder="e.g. worker-pool-1"
                  className="w-full bg-[#151c27] border border-[#242e3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSubModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubscribe}
                disabled={!newSubject.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
