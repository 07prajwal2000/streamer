import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Layers, 
  Users, 
  Database, 
  Clock, 
  HardDrive, 
  ShieldAlert, 
  ChevronRight, 
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Flame,
  Search,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  Sliders,
  Sparkles,
  List,
  Filter,
  ArrowDownUp
} from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';
import { 
  ListStreams, 
  CreateStream, 
  UpdateStream,
  DeleteStream, 
  PurgeStream,
  GetStreamMsg,
  GetStreamMsgsBatch,
  DeleteStreamMsg,
  ListConsumers,
  CreateConsumer,
  DeleteConsumer
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { ResizableSplit } from '../common/ResizableSplit';
import { DataPayloadViewer } from '../DataPayloadViewer';
import { StreamModal } from './StreamModal';
import { ConsumerModal } from './ConsumerModal';
import { ScheduleViewer } from './ScheduleViewer';

interface JetStreamViewProps {
  isConnected?: boolean;
  isActiveTab?: boolean;
}

export const JetStreamView: React.FC<JetStreamViewProps> = ({ isConnected = false, isActiveTab = false }) => {
  const [streams, setStreams] = useState<natsmanager.JSStreamInfo[]>([]);
  const [selectedStreamName, setSelectedStreamName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'consumers'>('overview');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateStream, setShowCreateStream] = useState(false);
  const [showEditStream, setShowEditStream] = useState(false);
  const [showCreateConsumer, setShowCreateConsumer] = useState(false);

  // Consumers State
  const [consumers, setConsumers] = useState<natsmanager.JSConsumerInfo[]>([]);
  const [loadingConsumers, setLoadingConsumers] = useState(false);

  // Message Browsing State
  const [currentSeq, setCurrentSeq] = useState<number>(1);
  const [activeMsg, setActiveMsg] = useState<natsmanager.JSStoredMsg | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgNotFound, setMsgNotFound] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);
  const [showRawError, setShowRawError] = useState(false);

  // Message Batch / List View Mode
  const [viewMode, setViewMode] = useState<'single' | 'list'>('list');
  const [batchLimit, setBatchLimit] = useState<number>(100);
  const [batchMessages, setBatchMessages] = useState<natsmanager.JSStoredMsg[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [autoReload, setAutoReload] = useState(false);
  const [msgFilterQuery, setMsgFilterQuery] = useState('');

  const selectedStreamNameRef = useRef(selectedStreamName);
  selectedStreamNameRef.current = selectedStreamName;
  const selectedStream = streams.find((s) => s.name === selectedStreamName);

  const loadStreams = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const list = await ListStreams();
      setStreams(list || []);
      // If no stream is selected or the selected stream is not in the list, default to the first one
      if (list && list.length > 0) {
        if (!selectedStreamNameRef.current || !list.some((s) => s.name === selectedStreamNameRef.current)) {
          setSelectedStreamName(list[0].name);
        }
      } else {
        setSelectedStreamName(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const loadConsumers = async (streamName: string, quiet = false) => {
    if (!quiet) setLoadingConsumers(true);
    try {
      const list = await ListConsumers(streamName);
      setConsumers(list || []);
    } catch (err) {
      console.error(err);
      setConsumers([]);
    } finally {
      if (!quiet) setLoadingConsumers(false);
    }
  };

  const fetchMessage = async (streamName: string, seq: number) => {
    if (seq <= 0) return;
    setMsgLoading(true);
    setMsgNotFound(false);
    setRawError(null);
    setShowRawError(false);

    try {
      const msg = await GetStreamMsg(streamName, seq);
      setActiveMsg(msg);
    } catch (err: any) {
      setActiveMsg(null);
      const errStr = String(err);
      if (errStr.includes('no message found') || errStr.includes('not found') || errStr.includes('10037')) {
        setMsgNotFound(true);
      } else {
        setRawError(errStr);
      }
    } finally {
      setMsgLoading(false);
    }
  };

  const fetchBatchMessages = async (streamName: string, limit: number, quiet = false) => {
    if (!streamName) return;
    if (!quiet) setBatchLoading(true);
    try {
      // Fetch newest messages downwards (reverse=true)
      const list = await GetStreamMsgsBatch(streamName, 0, limit, true);
      setBatchMessages(list || []);
      if (list && list.length > 0 && !activeMsg) {
        setActiveMsg(list[0]);
        setCurrentSeq(list[0].sequence);
      }
    } catch (err) {
      console.error('Failed to fetch batch messages:', err);
    } finally {
      if (!quiet) setBatchLoading(false);
    }
  };

  useEffect(() => {
    // Initial mount check
    if (isConnected) {
      loadStreams(streams.length > 0);
    }

    // Debounced hot-reload listener from NATS Advisories
    let debounceTimer: any = null;
    const cancelHotReload = EventsOn('jetstream:update', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadStreams(true);
        if (selectedStreamNameRef.current) {
          loadConsumers(selectedStreamNameRef.current, true);
          if (viewMode === 'list') {
            fetchBatchMessages(selectedStreamNameRef.current, batchLimit, true);
          }
        }
      }, 400);
    });

    return () => {
      clearTimeout(debounceTimer);
      if (cancelHotReload) cancelHotReload();
    };
  }, [isConnected, viewMode, batchLimit]);

  useEffect(() => {
    if (isConnected && isActiveTab && streams.length === 0) {
      loadStreams();
    }
  }, [isActiveTab, isConnected]);

  // When selected stream name changes, load consumers and initial message
  useEffect(() => {
    if (!selectedStreamName) {
      setConsumers([]);
      setActiveMsg(null);
      setBatchMessages([]);
      return;
    }

    loadConsumers(selectedStreamName);
    const curr = streams.find((s) => s.name === selectedStreamName);
    if (curr) {
      const targetSeq = curr.lastSeq > 0 ? curr.lastSeq : curr.firstSeq;
      setCurrentSeq(targetSeq || 1);
      fetchMessage(curr.name, targetSeq || 1);
      if (viewMode === 'list') {
        fetchBatchMessages(curr.name, batchLimit);
      }
    }
  }, [selectedStreamName, viewMode, batchLimit]);

  // Optional Polling when autoReload is active
  useEffect(() => {
    if (!autoReload || !selectedStreamName || activeTab !== 'messages') return;

    const interval = setInterval(() => {
      if (viewMode === 'list') {
        fetchBatchMessages(selectedStreamName, batchLimit, true);
      } else {
        const curr = streams.find((s) => s.name === selectedStreamName);
        if (curr && curr.lastSeq > 0) {
          setCurrentSeq(curr.lastSeq);
          fetchMessage(selectedStreamName, curr.lastSeq);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [autoReload, selectedStreamName, activeTab, viewMode, batchLimit, streams]);

  const handleCreateStream = async (params: natsmanager.StreamCreateParams) => {
    await CreateStream(params);
    await loadStreams();
    setSelectedStreamName(params.name);
  };

  const handleUpdateStream = async (params: natsmanager.StreamCreateParams) => {
    await UpdateStream(params);
    await loadStreams();
  };

  const handleDeleteStream = async (name: string) => {
    if (!confirm(`Are you sure you want to delete stream "${name}"? This action cannot be undone.`)) return;
    try {
      await DeleteStream(name);
      await loadStreams();
      setSelectedStreamName(null);
    } catch (err) {
      alert(`Failed to delete stream: ${err}`);
    }
  };

  const handlePurgeStream = async (name: string) => {
    if (!confirm(`Purge all messages from stream "${name}"?`)) return;
    try {
      await PurgeStream(name, '', 0);
      await loadStreams();
      if (selectedStreamName) {
        loadConsumers(selectedStreamName);
        setActiveMsg(null);
      }
    } catch (err) {
      alert(`Purge failed: ${err}`);
    }
  };

  const handleDeleteMsg = async (seq: number) => {
    if (!selectedStreamName) return;
    if (!confirm(`Delete message #${seq}?`)) return;
    try {
      await DeleteStreamMsg(selectedStreamName, seq);
      await loadStreams();
      fetchMessage(selectedStreamName, seq + 1);
    } catch (err) {
      alert(`Failed to delete message: ${err}`);
    }
  };

  const handleCreateConsumer = async (params: natsmanager.ConsumerCreateParams) => {
    await CreateConsumer(params);
    if (selectedStreamName) {
      await loadConsumers(selectedStreamName);
    }
  };

  const handleDeleteConsumer = async (consumerName: string) => {
    if (!selectedStreamName) return;
    if (!confirm(`Delete consumer "${consumerName}"?`)) return;
    try {
      await DeleteConsumer(selectedStreamName, consumerName);
      await loadConsumers(selectedStreamName);
    } catch (err) {
      alert(`Failed to delete consumer: ${err}`);
    }
  };

  const filteredStreams = streams.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Left Sidebar: Stream List
  const streamListPane = (
    <div className="flex flex-col h-full bg-[#0a0e14] border-r border-[#1e2530] select-none">
      <div className="p-3 border-b border-[#1e2530] flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search streams..."
            className="w-full bg-[#131923] border border-[#232c3d] rounded-lg pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowCreateStream(true)}
          title="Create Stream"
          className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredStreams.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-600">
            {loading ? 'Loading streams...' : 'No streams found'}
          </div>
        ) : (
          filteredStreams.map((s) => {
            const isSelected = selectedStreamName === s.name;
            return (
              <div
                key={s.name}
                onClick={() => setSelectedStreamName(s.name)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all border text-left ${
                  isSelected
                    ? 'bg-[#151c27] border-purple-500/40 text-white shadow-sm'
                    : 'border-transparent text-gray-300 hover:bg-[#111720] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs tracking-tight truncate uppercase font-mono">
                    {s.name}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {s.msgs.toLocaleString()} msgs
                  </span>
                </div>

                <div className="text-[10px] text-gray-500 truncate font-mono mt-0.5">
                  {s.subjects.join(', ')}
                </div>

                <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                  <span className="px-1 py-0.2 rounded bg-[#1c2330] text-gray-400 uppercase font-medium">
                    {s.storage}
                  </span>
                  <span className="px-1 py-0.2 rounded bg-[#1c2330] text-purple-400 font-medium">
                    {s.retention}
                  </span>
                  {s.allowMsgSchedules && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">
                      Cron
                    </span>
                  )}
                  <span className="text-gray-500 ml-auto font-mono">
                    {(s.bytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t border-[#1e2530] bg-[#0c1017] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Sync</span>
        </div>
        <button
          onClick={() => loadStreams()}
          className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1c2330] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );

  // Center / Main Pane
  const streamContentPane = selectedStream ? (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] min-h-0 select-none overflow-hidden">
      {/* Top Stream Action Bar */}
      <div className="h-14 px-5 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]/70 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight font-mono">
                {selectedStream.name}
              </h2>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-purple-500/15 text-purple-300 border border-purple-500/20">
                {selectedStream.retention}
              </span>
              {selectedStream.allowMsgSchedules && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> Scheduler Enabled
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 truncate font-mono">
              Subjects: {selectedStream.subjects.join(', ')}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditStream(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Edit Stream</span>
          </button>

          <button
            onClick={() => handlePurgeStream(selectedStream.name)}
            disabled={selectedStream.denyPurge}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-colors disabled:opacity-40"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Purge</span>
          </button>

          <button
            onClick={() => handleDeleteStream(selectedStream.name)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-5 pt-3 border-b border-[#1e2530] flex gap-5 bg-[#0e131b] shrink-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`pb-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'messages'
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Message Browser ({selectedStream.msgs.toLocaleString()})
        </button>
        <button
          onClick={() => setActiveTab('consumers')}
          className={`pb-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'consumers'
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Consumers ({consumers.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="p-5 max-w-4xl space-y-5">
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Total Messages
                </span>
                <div className="text-lg font-bold font-mono text-white">
                  {selectedStream.msgs.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Storage Size
                </span>
                <div className="text-lg font-bold font-mono text-purple-400">
                  {(selectedStream.bytes / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Sequence Range
                </span>
                <div className="text-sm font-bold font-mono text-gray-200 mt-1">
                  #{selectedStream.firstSeq} → #{selectedStream.lastSeq}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#111722] border border-[#1e2736] space-y-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Active Consumers
                </span>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {consumers.length}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#111722] border border-[#1e2736] space-y-3">
              <h3 className="text-xs font-semibold text-gray-300">Configuration Parameters</h3>
              <div className="grid grid-cols-3 gap-y-3 gap-x-6 text-xs">
                <div>
                  <span className="text-gray-500 block text-[11px]">Storage Type</span>
                  <span className="font-mono text-gray-200 uppercase">{selectedStream.storage}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Retention Policy</span>
                  <span className="font-mono text-gray-200 capitalize">{selectedStream.retention}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Discard Policy</span>
                  <span className="font-mono text-gray-200 capitalize">{selectedStream.discard}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Max Messages</span>
                  <span className="font-mono text-gray-200">{selectedStream.maxMsgs === -1 ? 'Unlimited' : selectedStream.maxMsgs}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Max Bytes</span>
                  <span className="font-mono text-gray-200">{selectedStream.maxBytes === -1 ? 'Unlimited' : `${(selectedStream.maxBytes / (1024*1024)).toFixed(1)} MB`}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Max Age</span>
                  <span className="font-mono text-gray-200">{selectedStream.maxAgeSec === 0 ? 'Unlimited' : `${selectedStream.maxAgeSec}s`}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Decluttered Message Browser */}
        {activeTab === 'messages' && (
          <div className="flex flex-col h-full min-h-0 p-4 space-y-3">
            {/* Mode Switcher & Tools Toolbar */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1 p-1 bg-[#111722] border border-[#1e2736] rounded-xl text-xs">
                <button
                  onClick={() => {
                    setViewMode('list');
                    if (selectedStream) fetchBatchMessages(selectedStream.name, batchLimit);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Message List</span>
                </button>
                <button
                  onClick={() => setViewMode('single')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    viewMode === 'single'
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Single Sequence</span>
                </button>
              </div>

              {viewMode === 'list' && (
                <div className="flex items-center gap-2">
                  {/* Dropdown for batch size / pagination limit */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                    <span>Limit:</span>
                    <select
                      value={batchLimit}
                      onChange={(e) => {
                        const lim = Number(e.target.value);
                        setBatchLimit(lim);
                        if (selectedStream) fetchBatchMessages(selectedStream.name, lim);
                      }}
                      className="px-2 py-1 bg-[#111722] border border-[#1e2736] rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value={50}>50 msgs</option>
                      <option value={100}>100 msgs</option>
                      <option value={200}>200 msgs</option>
                      <option value={500}>500 msgs</option>
                    </select>
                  </div>

                  {/* Auto Reload / Polling Toggle */}
                  <button
                    onClick={() => setAutoReload(!autoReload)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      autoReload
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-[#111722] text-gray-400 border-[#1e2736] hover:text-gray-200'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${autoReload ? 'animate-spin' : ''}`} />
                    <span>Auto Polling</span>
                  </button>

                  {/* Manual Refresh button */}
                  <button
                    onClick={() => selectedStream && fetchBatchMessages(selectedStream.name, batchLimit)}
                    disabled={batchLoading}
                    title="Refresh message list"
                    className="p-1.5 rounded-lg bg-[#111722] border border-[#1e2736] text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${batchLoading ? 'animate-spin text-purple-400' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Single Sequence Navigator Toolbar */}
            {viewMode === 'single' ? (
              <div className="p-2.5 rounded-xl bg-[#111722] border border-[#1e2736] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  {/* Jump to first */}
                  <button
                    title="First message"
                    disabled={currentSeq <= selectedStream.firstSeq || selectedStream.msgs === 0}
                    onClick={() => {
                      setCurrentSeq(selectedStream.firstSeq);
                      fetchMessage(selectedStream.name, selectedStream.firstSeq);
                    }}
                    className="p-1.5 rounded-lg bg-[#18212e] hover:bg-[#202c3d] text-gray-300 disabled:opacity-30"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Step prev */}
                  <button
                    title="Previous message"
                    disabled={currentSeq <= selectedStream.firstSeq || selectedStream.msgs === 0}
                    onClick={() => {
                      const next = Math.max(selectedStream.firstSeq, currentSeq - 1);
                      setCurrentSeq(next);
                      fetchMessage(selectedStream.name, next);
                    }}
                    className="p-1.5 rounded-lg bg-[#18212e] hover:bg-[#202c3d] text-gray-300 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Direct Sequence Input */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#141b26] border border-[#232d3e] text-xs font-mono">
                    <span className="text-gray-500">Seq:</span>
                    <input
                      type="number"
                      value={currentSeq}
                      onChange={(e) => setCurrentSeq(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchMessage(selectedStream.name, currentSeq);
                      }}
                      className="w-20 bg-transparent text-white font-bold text-center focus:outline-none"
                    />
                    <span className="text-gray-500">/ #{selectedStream.lastSeq}</span>
                  </div>

                  {/* Step next */}
                  <button
                    title="Next message"
                    disabled={currentSeq >= selectedStream.lastSeq || selectedStream.msgs === 0}
                    onClick={() => {
                      const next = Math.min(selectedStream.lastSeq, currentSeq + 1);
                      setCurrentSeq(next);
                      fetchMessage(selectedStream.name, next);
                    }}
                    className="p-1.5 rounded-lg bg-[#18212e] hover:bg-[#202c3d] text-gray-300 disabled:opacity-30"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Jump to last */}
                  <button
                    title="Last message"
                    disabled={currentSeq >= selectedStream.lastSeq || selectedStream.msgs === 0}
                    onClick={() => {
                      setCurrentSeq(selectedStream.lastSeq);
                      fetchMessage(selectedStream.name, selectedStream.lastSeq);
                    }}
                    className="p-1.5 rounded-lg bg-[#18212e] hover:bg-[#202c3d] text-gray-300 disabled:opacity-30"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => fetchMessage(selectedStream.name, currentSeq)}
                    className="px-3 py-1 ml-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                  >
                    Jump
                  </button>
                </div>

                {activeMsg && (
                  <button
                    onClick={() => handleDeleteMsg(activeMsg.sequence)}
                    disabled={selectedStream.denyDelete}
                    className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 disabled:opacity-40"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Msg #{activeMsg.sequence}</span>
                  </button>
                )}
              </div>
            ) : (
              /* Message List Search & Filter Subbar */
              <div className="p-2 rounded-xl bg-[#111722] border border-[#1e2736] flex items-center justify-between gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filter by subject or payload..."
                    value={msgFilterQuery}
                    onChange={(e) => setMsgFilterQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-[#161b22] border border-[#262f3f] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div className="text-xs text-gray-400 font-mono shrink-0 pl-2">
                  Showing {batchMessages.filter((m) => m.subject.toLowerCase().includes(msgFilterQuery.toLowerCase()) || m.data.toLowerCase().includes(msgFilterQuery.toLowerCase())).length} of {batchMessages.length} loaded
                </div>
              </div>
            )}

            {/* Message Body Area */}
            <div className="flex-1 min-h-0 flex flex-col">
              {viewMode === 'list' ? (
                /* List View: Split between Scrollable Message Table & Payload Inspector */
                <div className="flex-1 min-h-0">
                  <ResizableSplit
                    direction="horizontal"
                    initialPercent={42}
                    minPercent={25}
                    maxPercent={65}
                    storageKey="js_msg_list_split"
                    first={
                      <div className="h-full flex flex-col bg-[#0d1117] border-r border-[#1e2530]">
                        <div className="flex-1 overflow-y-auto p-1 space-y-1">
                          {batchLoading && batchMessages.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Loading messages...
                            </div>
                          ) : batchMessages.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-500">
                              No messages found in this stream.
                            </div>
                          ) : (
                            batchMessages
                              .filter(
                                (m) =>
                                  m.subject.toLowerCase().includes(msgFilterQuery.toLowerCase()) ||
                                  m.data.toLowerCase().includes(msgFilterQuery.toLowerCase())
                              )
                              .map((m) => {
                                const isSelected = activeMsg?.sequence === m.sequence;
                                return (
                                  <div
                                    key={m.sequence}
                                    onClick={() => {
                                      setActiveMsg(m);
                                      setCurrentSeq(m.sequence);
                                    }}
                                    className={`px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                                      isSelected
                                        ? 'bg-[#151d2a] border-purple-500/40 text-white shadow-sm'
                                        : 'border-transparent text-gray-300 hover:bg-[#121620] hover:text-white'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="text-xs font-mono font-semibold text-purple-400">
                                        #{m.sequence}
                                      </span>
                                      <span className="text-[10px] text-gray-500 font-mono">
                                        {new Date(m.timestamp).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <div className="text-xs font-mono text-blue-400 truncate mb-1">
                                      {m.subject}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                                      <span className="truncate max-w-[140px]">
                                        {m.isBinary ? 'Binary data' : m.data.slice(0, 35)}
                                      </span>
                                      <span>{m.size} B</span>
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    }
                    second={
                      <div className="h-full flex flex-col bg-[#0b0e14]">
                        {activeMsg ? (
                          <div className="h-full flex flex-col p-3 space-y-2.5 overflow-hidden">
                            {/* Metadata Header */}
                            <div className="p-3 rounded-xl bg-[#111722] border border-[#1e2736] space-y-2 shrink-0">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-400 font-bold">Seq #{activeMsg.sequence}</span>
                                  <span className="text-gray-600">|</span>
                                  <span className="text-blue-400 font-bold">{activeMsg.subject}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 text-[11px]">{activeMsg.size} B</span>
                                  <button
                                    onClick={() => handleDeleteMsg(activeMsg.sequence)}
                                    disabled={selectedStream.denyDelete}
                                    className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                                    title={`Delete msg #${activeMsg.sequence}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Headers Badge List */}
                              {activeMsg.headers && Object.keys(activeMsg.headers).length > 0 && (
                                <div className="pt-2 border-t border-[#1c2432] flex flex-wrap gap-1.5">
                                  {Object.entries(activeMsg.headers).map(([k, vals]) => (
                                    <span
                                      key={k}
                                      className="px-2 py-0.5 rounded bg-[#18212e] text-[10px] font-mono text-cyan-300 border border-[#232f42] flex items-center gap-1"
                                    >
                                      <span className="text-gray-400">{k}:</span>
                                      <span className="font-semibold">{(vals as string[]).join(', ')}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Scheduled Message / Cron Widget if Nats-Schedule headers present */}
                            <ScheduleViewer headers={activeMsg.headers} />

                            {/* Collapsible JSON / Hex Payload Viewer */}
                            <div className="flex-1 min-h-0">
                              <DataPayloadViewer data={activeMsg.data} isBinary={activeMsg.isBinary} />
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-gray-600">
                            Select a message from the list to view its details.
                          </div>
                        )}
                      </div>
                    }
                  />
                </div>
              ) : (
                /* Single Sequence Mode */
                <div className="flex-1 min-h-0 flex flex-col">
                  {msgLoading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
                      Fetching sequence #{currentSeq}...
                    </div>
                  ) : msgNotFound ? (
                    /* Clean Empty Offset UX */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 rounded-xl bg-[#111722]/50 border border-[#1e2736]">
                      <FileText className="w-8 h-8 text-gray-600" />
                      <div className="text-xs font-medium text-gray-300">
                        No message exists at sequence #{currentSeq}
                      </div>
                      <p className="text-[11px] text-gray-500 max-w-sm">
                        This message may have been purged, expired by retention limits, or the sequence number has not yet been allocated.
                      </p>
                    </div>
                  ) : rawError ? (
                    /* Non-fatal Error State with Collapsible Raw Details */
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-rose-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" /> Unable to retrieve sequence #{currentSeq}
                        </span>
                        <button
                          onClick={() => setShowRawError(!showRawError)}
                          className="text-[10px] text-rose-400 underline hover:text-rose-200"
                        >
                          {showRawError ? 'Hide details' : 'Show raw error'}
                        </button>
                      </div>
                      {showRawError && (
                        <pre className="p-2 bg-black/40 rounded font-mono text-[11px] text-rose-300/80 overflow-x-auto">
                          {rawError}
                        </pre>
                      )}
                    </div>
                  ) : activeMsg ? (
                    <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
                      {/* Metadata Header & Headers Viewer */}
                      <div className="p-3 rounded-xl bg-[#111722] border border-[#1e2736] space-y-2 shrink-0">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Subject:</span>
                            <span className="text-blue-400 font-bold">{activeMsg.subject}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-400 text-[11px]">
                            <span>Size: {activeMsg.size} B</span>
                            <span>{new Date(activeMsg.timestamp).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* JetStream Headers Section */}
                        {activeMsg.headers && Object.keys(activeMsg.headers).length > 0 && (
                          <div className="pt-2 border-t border-[#1c2432] space-y-1">
                            <span className="text-[10px] uppercase font-bold text-gray-500 block">
                              Headers ({Object.keys(activeMsg.headers).length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(activeMsg.headers).map(([k, vals]) => (
                                <span
                                  key={k}
                                  className="px-2 py-0.5 rounded bg-[#18212e] text-[10px] font-mono text-cyan-300 border border-[#232f42] flex items-center gap-1"
                                >
                                  <span className="text-gray-400">{k}:</span>
                                  <span className="font-semibold">{(vals as string[]).join(', ')}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scheduled Message / Cron Widget if Nats-Schedule headers present */}
                      <ScheduleViewer headers={activeMsg.headers} />

                      {/* Collapsible JSON / Hex Payload Viewer */}
                      <div className="flex-1 min-h-0">
                        <DataPayloadViewer data={activeMsg.data} isBinary={activeMsg.isBinary} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-600">
                      Select a sequence number above to inspect message.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Consumers */}
        {activeTab === 'consumers' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white">Active Consumers</h3>
                <p className="text-[11px] text-gray-500">
                  Pull and Push consumers managing delivery and acknowledgements.
                </p>
              </div>

              <button
                onClick={() => setShowCreateConsumer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Consumer</span>
              </button>
            </div>

            {loadingConsumers ? (
              <div className="text-xs text-gray-500 p-4 text-center">Loading consumers...</div>
            ) : consumers.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-600 rounded-xl bg-[#111722] border border-[#1e2736]">
                No consumers defined for this stream yet. Click "+ Create Consumer" above.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {consumers.map((c) => (
                  <div
                    key={c.name}
                    className="p-4 rounded-xl bg-[#111722] border border-[#1e2736] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="font-mono text-xs font-bold text-white">
                          {c.durable || c.name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteConsumer(c.name)}
                        className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#0c1017] p-2.5 rounded-lg border border-[#18202c]">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Deliver Policy</span>
                        <span className="text-gray-200 capitalize">{c.deliverPolicy}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Ack Policy</span>
                        <span className="text-gray-200 capitalize">{c.ackPolicy}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Pending Msgs</span>
                        <span className="text-amber-400">{c.numPending.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Redelivered</span>
                        <span className="text-rose-400">{c.numRedelivered}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-gray-600">
      <Layers className="w-10 h-10 text-gray-700 mb-2" />
      <div>No stream selected.</div>
      <div className="text-[11px] text-gray-700 mt-0.5">
        Choose a stream from the left or create a new one.
      </div>
    </div>
  );

  return (
    <div className="flex-1 h-full w-full overflow-hidden">
      <ResizableSplit
        direction="horizontal"
        initialPercent={25}
        minPercent={18}
        maxPercent={45}
        storageKey="jetstream_layout"
        first={streamListPane}
        second={streamContentPane}
      />

      {/* Stream Create Modal */}
      <StreamModal
        isOpen={showCreateStream}
        onClose={() => setShowCreateStream(false)}
        onSubmit={handleCreateStream}
        isEditMode={false}
      />

      {/* Stream Edit Modal */}
      <StreamModal
        isOpen={showEditStream}
        onClose={() => setShowEditStream(false)}
        onSubmit={handleUpdateStream}
        initialStream={selectedStream}
        isEditMode={true}
      />

      {/* Consumer Create Modal */}
      {selectedStreamName && (
        <ConsumerModal
          streamName={selectedStreamName}
          isOpen={showCreateConsumer}
          onClose={() => setShowCreateConsumer(false)}
          onSubmit={handleCreateConsumer}
        />
      )}
    </div>
  );
};
