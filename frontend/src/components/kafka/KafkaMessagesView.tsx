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
  HardDrive,
  Hash,
  FastForward,
  Rewind,
  ArrowRight,
  Sparkles,
  Eraser,
  X,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import {
  ListKafkaTopics,
  GetKafkaMessages,
  StartKafkaLiveTail,
  StopKafkaLiveTail,
  PurgeKafkaTopic,
  PurgeKafkaPartition,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { ProduceMessageModal } from './ProduceMessageModal';
import { RecordInspectorPanel } from './RecordInspectorPanel';

interface KafkaMessagesViewProps {
  isConnected: boolean;
  isActiveTab: boolean;
}

export const KafkaMessagesView: React.FC<KafkaMessagesViewProps> = ({
  isConnected,
  isActiveTab,
}) => {
  const [topics, setTopics] = useState<kafkamanager.TopicSummary[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedPartition, setSelectedPartition] = useState<number>(-1);

  // Query strategy
  const [strategy, setStrategy] = useState<'latest' | 'earliest' | 'timestamp' | 'offset'>('latest');
  const [limit, setLimit] = useState<number>(50);
  const [timestampValue, setTimestampValue] = useState<string>('');
  const [offsetValue, setOffsetValue] = useState<string>('0');

  // Messages state
  const [records, setRecords] = useState<kafkamanager.KafkaRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<kafkamanager.KafkaRecord | null>(null);

  // Search filter
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Live tail
  const [isTailing, setIsTailing] = useState<boolean>(false);
  const tailUnsubRef = useRef<(() => void) | null>(null);

  // Produce modal
  const [showProduceModal, setShowProduceModal] = useState<boolean>(false);

  // Purge modal & action state
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [purgeSuccessMsg, setPurgeSuccessMsg] = useState<string | null>(null);

  // Load available topics on mount/tab active
  const loadTopics = async () => {
    if (!isConnected) return;
    try {
      const res = await ListKafkaTopics(false);
      const sorted = res || [];
      setTopics(sorted);
      if (sorted.length > 0 && !selectedTopic) {
        setSelectedTopic(sorted[0].name);
      }
    } catch (err: any) {
      console.error('Failed to list topics:', err);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadTopics();
    }
  }, [isConnected, isActiveTab]);

  // Clean up live tail on unmount or tab change
  useEffect(() => {
    return () => {
      if (isTailing) {
        StopKafkaLiveTail();
      }
      if (tailUnsubRef.current) {
        tailUnsubRef.current();
      }
    };
  }, [isTailing]);

  const currentTopicObj = useMemo(() => {
    return topics.find((t) => t.name === selectedTopic);
  }, [topics, selectedTopic]);

  const availableTopicNames = useMemo(() => {
    return topics.map((t) => t.name);
  }, [topics]);

  const handleQuery = async () => {
    if (!selectedTopic) return;
    if (isTailing) {
      handleToggleLiveTail();
    }

    setLoading(true);
    setError(null);

    try {
      let parsedTimestamp = 0;
      if (strategy === 'timestamp') {
        const parsed = new Date(timestampValue).getTime();
        if (isNaN(parsed) || parsed <= 0) {
          throw new Error('Please select a valid date and time for timestamp query.');
        }
        parsedTimestamp = parsed;
      }

      let parsedOffset = 0;
      if (strategy === 'offset') {
        parsedOffset = parseInt(offsetValue, 10);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
          throw new Error('Please enter a valid non-negative offset number.');
        }
      }

      const partitionsList: number[] = selectedPartition >= 0 ? [selectedPartition] : [];

      const params = new kafkamanager.GetKafkaMessagesParams({
        topic: selectedTopic,
        partitions: partitionsList,
        strategy,
        offset: parsedOffset,
        timestamp: parsedTimestamp,
        limit: Number(limit),
      });

      const res = await GetKafkaMessages(params);
      const fetched = res || [];
      setRecords(fetched);
      if (fetched.length > 0) {
        setSelectedRecord(fetched[0]);
      } else {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLiveTail = async () => {
    if (isTailing) {
      await StopKafkaLiveTail();
      if (tailUnsubRef.current) {
        tailUnsubRef.current();
        tailUnsubRef.current = null;
      }
      setIsTailing(false);
    } else {
      if (!selectedTopic) return;
      setError(null);
      try {
        const partitionsList: number[] = selectedPartition >= 0 ? [selectedPartition] : [];
        await StartKafkaLiveTail(selectedTopic, partitionsList);

        // Subscribe to live record events
        const unsub = EventsOn('kafka:live-record', (rec: any) => {
          const kRec = new kafkamanager.KafkaRecord(rec);
          setRecords((prev) => [kRec, ...prev].slice(0, 500));
        });
        tailUnsubRef.current = unsub;
        setIsTailing(true);
      } catch (err: any) {
        setError(`Failed to start live tail: ${err}`);
      }
    }
  };

  const handlePurgeMessages = async () => {
    if (!selectedTopic) return;
    setIsPurging(true);
    setError(null);
    try {
      if (selectedPartition >= 0) {
        await PurgeKafkaPartition(selectedTopic, selectedPartition);
        setPurgeSuccessMsg(`Successfully purged Partition #${selectedPartition} of topic "${selectedTopic}".`);
      } else {
        await PurgeKafkaTopic(selectedTopic);
        setPurgeSuccessMsg(`Successfully purged all messages in topic "${selectedTopic}".`);
      }
      setShowPurgeModal(false);
      setRecords([]);
      setSelectedRecord(null);
      setTimeout(() => setPurgeSuccessMsg(null), 4000);
      // Re-query topic to update table view
      await handleQuery();
    } catch (err: any) {
      setError(`Failed to purge messages: ${err}`);
    } finally {
      setIsPurging(false);
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchFilter.trim()) return records;
    const term = searchFilter.toLowerCase();
    return records.filter((r) => {
      if (r.key && r.key.toLowerCase().includes(term)) return true;
      if (r.payload && r.payload.toLowerCase().includes(term)) return true;
      if (r.headers) {
        for (const [k, v] of Object.entries(r.headers)) {
          if (k.toLowerCase().includes(term) || v.toLowerCase().includes(term)) {
            return true;
          }
        }
      }
      return false;
    });
  }, [records, searchFilter]);

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-[#090d13]">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Kafka Disconnected</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">
          Connect to a Kafka cluster or compatible streaming broker to query records and produce messages.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d13] select-none min-w-0 overflow-hidden">
      {/* Top Header & Query Toolbar */}
      <div className="border-b border-[#1e2530] bg-[#0c1017]">
        {/* Title Bar */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-[#1e2530]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Kafka Messages</h1>
              <p className="text-[11px] text-gray-400">Explore records, live tail partitions, and publish messages</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowProduceModal(true)}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Produce Message</span>
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-[#0c1017]/80">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Topic Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">Topic:</span>
              <select
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setSelectedPartition(-1);
                  setRecords([]);
                  setSelectedRecord(null);
                }}
                className="px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500/50"
              >
                {topics.length === 0 && <option value="">No Topics Found</option>}
                {topics.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.partitionsCount}p)
                  </option>
                ))}
              </select>
            </div>

            {/* Partition Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">Partition:</span>
              <select
                value={selectedPartition}
                onChange={(e) => setSelectedPartition(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value={-1}>All Partitions</option>
                {currentTopicObj &&
                  Array.from({ length: currentTopicObj.partitionsCount }, (_, i) => (
                    <option key={i} value={i}>
                      Partition #{i}
                    </option>
                  ))}
              </select>
            </div>

            {/* Strategy Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">Seek:</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value="latest">Latest Messages</option>
                <option value="earliest">From Beginning</option>
                <option value="timestamp">By Timestamp</option>
                <option value="offset">By Offset</option>
              </select>
            </div>

            {/* Strategy Options */}
            {strategy === 'latest' && (
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="px-2.5 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value={25}>Limit 25</option>
                <option value={50}>Limit 50</option>
                <option value={100}>Limit 100</option>
                <option value={250}>Limit 250</option>
                <option value={500}>Limit 500</option>
              </select>
            )}

            {strategy === 'timestamp' && (
              <input
                type="datetime-local"
                value={timestampValue}
                onChange={(e) => setTimestampValue(e.target.value)}
                className="px-2.5 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500/50"
              />
            )}

            {strategy === 'offset' && (
              <input
                type="number"
                min={0}
                placeholder="Offset"
                value={offsetValue}
                onChange={(e) => setOffsetValue(e.target.value)}
                className="w-24 px-2.5 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500/50"
              />
            )}

            {/* Execute Query Button */}
            <button
              onClick={handleQuery}
              disabled={loading || !selectedTopic}
              className="px-3 py-1.5 bg-[#151b23] hover:bg-[#1f2733] text-gray-200 hover:text-white border border-[#222d3d] rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
              <span>Query</span>
            </button>
          </div>

          {/* Live Tail Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleLiveTail}
              disabled={!selectedTopic}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border ${
                isTailing
                  ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25'
                  : 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20'
              }`}
            >
              {isTailing ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop Live Tail</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Live Tail</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter and Stats Bar */}
        <div className="px-6 py-2 border-t border-[#1c2432] bg-[#090d13] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by key, payload text, or header..."
              className="w-full pl-8 pr-3 py-1 bg-[#0c1017] border border-[#1e2530] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>
              Showing <strong className="text-white font-mono">{filteredRecords.length}</strong> of{' '}
              <strong className="text-white font-mono">{records.length}</strong> records
            </span>

            {/* Clear View (Client-side display clear only) */}
            {records.length > 0 && (
              <button
                onClick={() => {
                  setRecords([]);
                  setSelectedRecord(null);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-[#151b23] hover:bg-[#1f2733] text-gray-400 hover:text-gray-200 border border-[#222d3d] rounded-lg text-xs transition-colors"
                title="Clear table view (does not delete messages from Kafka broker)"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear View</span>
              </button>
            )}

            {/* Real Delete / Purge Messages from Kafka */}
            <button
              onClick={() => setShowPurgeModal(true)}
              disabled={!selectedTopic || isPurging}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              title={
                selectedPartition >= 0
                  ? `Permanently delete all messages in Partition #${selectedPartition} from Kafka broker`
                  : `Permanently delete all messages in topic "${selectedTopic}" from Kafka broker`
              }
            >
              {isPurging ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>
                {selectedPartition >= 0 ? `Delete P#${selectedPartition} Msgs` : 'Delete Topic Msgs'}
              </span>
            </button>
          </div>
        </div>

        {/* Purge Success Banner */}
        {purgeSuccessMsg && (
          <div className="px-6 py-2 bg-emerald-500/10 border-t border-emerald-500/30 text-xs text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{purgeSuccessMsg}</span>
            </div>
            <button onClick={() => setPurgeSuccessMsg(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Split View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Records Table */}
        <div className="flex-1 overflow-y-auto flex flex-col min-w-0 border-r border-[#1e2530]">
          {error && (
            <div className="m-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-all">{error}</div>
            </div>
          )}

          {loading && records.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin text-orange-400 mb-2" />
              <span className="text-xs">Fetching records from topic...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto text-gray-600 mb-2 opacity-40" />
              <p className="text-xs font-medium text-gray-400">No records found</p>
              <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                {searchFilter
                  ? 'No records match the active search filter.'
                  : 'Click "Query" to fetch historical messages, or "Start Live Tail" to stream incoming records.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#111722] border-b border-[#1e2530] text-gray-400 font-medium sticky top-0 z-10">
                  <th className="py-2.5 px-3 font-medium">Time</th>
                  <th className="py-2.5 px-2 font-medium text-center">Partition</th>
                  <th className="py-2.5 px-2 font-medium text-right">Offset</th>
                  <th className="py-2.5 px-3 font-medium">Key</th>
                  <th className="py-2.5 px-3 font-medium">Payload Preview</th>
                  <th className="py-2.5 px-3 font-medium text-center">Headers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171e2a] font-mono">
                {filteredRecords.map((r, idx) => {
                  const isSelected =
                    selectedRecord &&
                    selectedRecord.partition === r.partition &&
                    selectedRecord.offset === r.offset;
                  const headersCount = r.headers ? Object.keys(r.headers).length : 0;
                  const dateObj = new Date(r.timestamp);
                  const timeStr = `${dateObj.toLocaleTimeString()}.${String(dateObj.getMilliseconds()).padStart(3, '0')}`;

                  return (
                    <tr
                      key={`${r.partition}-${r.offset}-${idx}`}
                      onClick={() => setSelectedRecord(r)}
                      className={`hover:bg-[#131a26] transition-colors cursor-pointer ${
                        isSelected ? 'bg-orange-500/15 border-l-2 border-orange-500' : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="py-2 px-3 text-gray-400 whitespace-nowrap text-[11px]">
                        {timeStr}
                      </td>

                      {/* Partition */}
                      <td className="py-2 px-2 text-center">
                        <span className="px-1.5 py-0.2 rounded bg-[#161f2d] text-orange-300 border border-[#233147] text-[10px]">
                          #{r.partition}
                        </span>
                      </td>

                      {/* Offset */}
                      <td className="py-2 px-2 text-right text-blue-300 text-[11px]">
                        {r.offset.toLocaleString()}
                      </td>

                      {/* Key */}
                      <td className="py-2 px-3 text-gray-300 max-w-[120px] truncate text-[11px]">
                        {r.key ? (
                          <span className="text-white font-medium">{r.key}</span>
                        ) : (
                          <span className="text-gray-600 italic">null</span>
                        )}
                      </td>

                      {/* Payload Preview */}
                      <td className="py-2 px-3 text-gray-400 max-w-sm truncate text-[11px]">
                        {r.payload}
                      </td>

                      {/* Headers */}
                      <td className="py-2 px-3 text-center">
                        {headersCount > 0 ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 border border-gray-700">
                            {headersCount}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: Record Inspector Panel */}
        <div className="w-[440px] h-full flex flex-col shrink-0">
          <RecordInspectorPanel
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onRecordDeleted={handleQuery}
          />
        </div>
      </div>

      {/* Produce Message Modal */}
      {showProduceModal && (
        <ProduceMessageModal
          isOpen={showProduceModal}
          currentTopic={selectedTopic}
          availableTopics={availableTopicNames}
          onClose={() => setShowProduceModal(false)}
          onProduced={() => {
            // Auto refresh or acknowledge
            handleQuery();
          }}
        />
      )}

      {/* Purge Messages Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0d121a] border border-[#222d3d] rounded-2xl shadow-2xl p-6 select-none animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {selectedPartition >= 0 ? 'Delete Partition Messages' : 'Delete Topic Messages'}
                </h3>
                <p className="text-xs text-gray-400">Permanently purge messages on Kafka broker</p>
              </div>
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 space-y-2 mb-5">
              <p className="font-semibold text-red-200">
                Are you sure you want to delete all messages in topic{' '}
                <span className="font-mono text-white bg-red-950/60 px-1.5 py-0.5 rounded">
                  {selectedTopic}
                </span>
                {selectedPartition >= 0 && (
                  <>
                    {' '}
                    (Partition <span className="font-mono text-white">#{selectedPartition}</span>)
                  </>
                )}
                ?
              </p>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                Kafka will advance the partition start offsets (low watermark) to the latest high-watermark offset.
                All existing messages in this partition/topic will be permanently deleted and cannot be recovered.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                disabled={isPurging}
                className="px-4 py-2 bg-[#161f2d] hover:bg-[#202c3f] text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeMessages}
                disabled={isPurging}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-red-950/40 transition-all flex items-center gap-2"
              >
                {isPurging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Messages...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {selectedPartition >= 0
                        ? `Yes, Delete Partition #${selectedPartition} Msgs`
                        : 'Yes, Delete All Topic Messages'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
