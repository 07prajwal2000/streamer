import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Flame,
  KeyRound,
  History,
  Clock,
  HardDrive,
  Edit3,
  Copy,
  Check,
  AlertCircle,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';
import {
  ListKVBuckets,
  CreateKVBucket,
  UpdateKVBucket,
  DeleteKVBucket,
  PurgeKVDeletes,
  ListKVEntries,
  GetKVEntry,
  PutKVEntry,
  DeleteKVEntry,
  PurgeKVEntry,
} from '../../../wailsjs/go/main/App';
import { ResizableSplit } from '../common/ResizableSplit';
import { DataPayloadViewer } from '../DataPayloadViewer';
import { KVBucketModal } from './KVBucketModal';
import { KVPutModal } from './KVPutModal';
import { KVHistoryDrawer } from './KVHistoryDrawer';

interface KVViewProps {
  isConnected?: boolean;
  isActiveTab?: boolean;
}

export const KVView: React.FC<KVViewProps> = ({ isConnected = false, isActiveTab = false }) => {
  const [buckets, setBuckets] = useState<natsmanager.KVBucketInfo[]>([]);
  const [selectedBucketName, setSelectedBucketName] = useState<string | null>(null);
  const [bucketSearchQuery, setBucketSearchQuery] = useState('');
  const [loadingBuckets, setLoadingBuckets] = useState(false);

  // Key state
  const [entries, setEntries] = useState<natsmanager.KVEntryInfo[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keySearchQuery, setKeySearchQuery] = useState('');
  const [loadingKeys, setLoadingKeys] = useState(false);

  // Modals
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [showEditBucket, setShowEditBucket] = useState(false);
  const [showPutKey, setShowPutKey] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const selectedBucket = buckets.find((b) => b.bucket === selectedBucketName);
  const selectedEntry = entries.find((e) => e.key === selectedKey);

  const loadBuckets = async (quiet = false) => {
    if (!quiet) setLoadingBuckets(true);
    try {
      const list = await ListKVBuckets();
      setBuckets(list || []);
      if (list && list.length > 0) {
        if (!selectedBucketName || !list.some((b) => b.bucket === selectedBucketName)) {
          setSelectedBucketName(list[0].bucket);
        }
      } else {
        setSelectedBucketName(null);
      }
    } catch (err) {
      console.error('Failed to load KV buckets:', err);
    } finally {
      if (!quiet) setLoadingBuckets(false);
    }
  };

  const loadEntries = async (bucketName: string, quiet = false) => {
    if (!quiet) setLoadingKeys(true);
    try {
      const list = await ListKVEntries(bucketName);
      setEntries(list || []);
      if (list && list.length > 0) {
        if (!selectedKey || !list.some((e) => e.key === selectedKey)) {
          setSelectedKey(list[0].key);
        }
      } else {
        setSelectedKey(null);
      }
    } catch (err) {
      console.error(`Failed to load keys for bucket ${bucketName}:`, err);
      setEntries([]);
      setSelectedKey(null);
    } finally {
      if (!quiet) setLoadingKeys(false);
    }
  };

  // Trigger loading buckets when connection or tab is active
  useEffect(() => {
    if (isConnected) {
      loadBuckets(buckets.length > 0);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected && isActiveTab && buckets.length === 0) {
      loadBuckets();
    }
  }, [isActiveTab, isConnected]);

  // Load entries when selected bucket changes
  useEffect(() => {
    if (selectedBucketName) {
      loadEntries(selectedBucketName);
    } else {
      setEntries([]);
      setSelectedKey(null);
    }
  }, [selectedBucketName]);

  const handleCreateBucket = async (params: natsmanager.KVBucketCreateParams) => {
    await CreateKVBucket(params);
    await loadBuckets();
    setSelectedBucketName(params.bucket);
  };

  const handleUpdateBucket = async (params: natsmanager.KVBucketCreateParams) => {
    await UpdateKVBucket(params);
    await loadBuckets();
  };

  const handleDeleteBucket = async () => {
    if (!selectedBucketName) return;
    if (confirm(`Are you sure you want to delete bucket '${selectedBucketName}'? All data will be permanently destroyed.`)) {
      await DeleteKVBucket(selectedBucketName);
      await loadBuckets();
    }
  };

  const handlePurgeBucketDeletes = async () => {
    if (!selectedBucketName) return;
    if (confirm(`Purge all delete markers in bucket '${selectedBucketName}'?`)) {
      await PurgeKVDeletes(selectedBucketName);
      await loadEntries(selectedBucketName);
      await loadBuckets(true);
    }
  };

  const handlePutKey = async (k: string, v: string) => {
    if (!selectedBucketName) return;
    await PutKVEntry(selectedBucketName, k, v);
    await loadEntries(selectedBucketName, true);
    setSelectedKey(k);
    await loadBuckets(true);
  };

  const handleDeleteKey = async () => {
    if (!selectedBucketName || !selectedKey) return;
    if (confirm(`Delete key '${selectedKey}'? This creates a tombstone marker while preserving history.`)) {
      await DeleteKVEntry(selectedBucketName, selectedKey);
      await loadEntries(selectedBucketName, true);
      await loadBuckets(true);
    }
  };

  const handlePurgeKey = async () => {
    if (!selectedBucketName || !selectedKey) return;
    if (confirm(`Purge key '${selectedKey}'? This permanently removes ALL historical revisions from the JetStream stream.`)) {
      await PurgeKVEntry(selectedBucketName, selectedKey);
      await loadEntries(selectedBucketName, true);
      await loadBuckets(true);
    }
  };

  const copyKeyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1500);
  };

  // Filter buckets
  const filteredBuckets = buckets.filter((b) =>
    b.bucket.toLowerCase().includes(bucketSearchQuery.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(bucketSearchQuery.toLowerCase()))
  );

  // Filter keys
  const filteredEntries = entries.filter((e) =>
    e.key.toLowerCase().includes(keySearchQuery.toLowerCase())
  );

  // Left Sidebar: Bucket Navigator
  const bucketListPanel = (
    <div className="h-full flex flex-col bg-[#0d1117] border-r border-[#1e2530] select-none">
      {/* Bucket List Header */}
      <div className="h-12 px-3 border-b border-[#1e2530] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-white">KV Buckets</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-400">
            {buckets.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadBuckets()}
            disabled={loadingBuckets}
            title="Refresh Buckets"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBuckets ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateBucket(true)}
            title="Create KV Bucket"
            className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bucket Search Bar */}
      <div className="p-2 border-b border-[#1e2530]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Search buckets..."
            value={bucketSearchQuery}
            onChange={(e) => setBucketSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#161b22] border border-[#262f3f] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Bucket Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredBuckets.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">
            {buckets.length === 0 ? 'No KV buckets found.' : 'No matching buckets.'}
          </div>
        ) : (
          filteredBuckets.map((b) => {
            const isSelected = selectedBucketName === b.bucket;
            return (
              <div
                key={b.bucket}
                onClick={() => setSelectedBucketName(b.bucket)}
                className={`group px-3 py-2.5 rounded-lg cursor-pointer text-left transition-all border ${
                  isSelected
                    ? 'bg-[#161f2e] border-blue-500/40 text-white shadow-sm'
                    : 'border-transparent text-gray-300 hover:bg-[#131822] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold truncate">{b.bucket}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      b.storage === 'file'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {b.storage}
                  </span>
                </div>
                {b.description && (
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{b.description}</p>
                )}
                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1.5">
                  <span>{b.values} values</span>
                  <span>{(b.bytes / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Middle/Right Pane: Key Explorer + Inspector
  const keyExplorerPanel = selectedBucket ? (
    <div className="h-full flex flex-col bg-[#0c1017]">
      {/* Top Bucket Toolbar */}
      <div className="h-12 px-4 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Bucket:</span>
            <span className="text-sm font-semibold text-white font-mono">{selectedBucket.bucket}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[11px] text-gray-400 font-mono pl-3 border-l border-[#262f3f]">
            <span>Hist: {selectedBucket.history}</span>
            <span>•</span>
            <span>TTL: {selectedBucket.ttl > 0 ? `${selectedBucket.ttl}s` : '∞'}</span>
            <span>•</span>
            <span>Values: {selectedBucket.values}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadEntries(selectedBucket.bucket)}
            disabled={loadingKeys}
            title="Refresh keys"
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingKeys ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            onClick={() => setShowEditBucket(true)}
            title="Edit Bucket Properties"
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handlePurgeBucketDeletes}
            title="Purge Delete Markers"
            className="p-1.5 rounded text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
          >
            <Flame className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDeleteBucket}
            title="Delete Entire Bucket"
            className="p-1.5 rounded text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowPutKey(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Put Key</span>
          </button>
        </div>
      </div>

      {/* Split between Key List & Key Detail Inspector */}
      <div className="flex-1 min-h-0">
        <ResizableSplit
          direction="horizontal"
          initialPercent={40}
          minPercent={25}
          maxPercent={70}
          storageKey="kv_keys_split"
          first={
            <div className="h-full flex flex-col bg-[#0d1117] border-r border-[#1e2530]">
              {/* Key Search Filter */}
              <div className="p-2 border-b border-[#1e2530]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filter keys..."
                    value={keySearchQuery}
                    onChange={(e) => setKeySearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-[#161b22] border border-[#262f3f] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Key Items List */}
              <div className="flex-1 overflow-y-auto p-1 space-y-1">
                {filteredEntries.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500">
                    {entries.length === 0 ? 'No keys in this bucket.' : 'No matching keys.'}
                  </div>
                ) : (
                  filteredEntries.map((e) => {
                    const isSelected = selectedKey === e.key;
                    return (
                      <div
                        key={e.key}
                        onClick={() => setSelectedKey(e.key)}
                        className={`px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-[#151d2a] border-blue-500/40 text-white shadow-sm'
                            : 'border-transparent text-gray-300 hover:bg-[#121620] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-mono font-medium truncate">{e.key}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                              e.operation === 'PUT'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : e.operation === 'DEL'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {e.operation}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                          <span>rev #{e.revision}</span>
                          <span>{e.size} B</span>
                          <span>{new Date(e.created).toLocaleTimeString()}</span>
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
              {selectedEntry ? (
                <div className="h-full flex flex-col">
                  {/* Key Inspector Header */}
                  <div className="h-11 px-4 bg-[#0e131b] border-b border-[#1e2530] flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs min-w-0">
                      <KeyRound className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-white font-semibold truncate">{selectedEntry.key}</span>
                      <span className="text-blue-400 text-[11px] font-semibold">
                        #rev {selectedEntry.revision}
                      </span>
                      <button
                        onClick={() => copyKeyToClipboard(selectedEntry.key)}
                        title="Copy Key Name"
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1c2330] transition-colors"
                      >
                        {keyCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowHistoryDrawer(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#18202d] hover:bg-[#202b3d] text-purple-400 text-xs font-medium border border-purple-500/30 transition-colors"
                      >
                        <History className="w-3 h-3" />
                        <span>History</span>
                      </button>

                      <button
                        onClick={() => setShowPutKey(true)}
                        title="Edit value"
                        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#1c2330] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handleDeleteKey}
                        title="Delete key (Tombstone)"
                        className="p-1.5 rounded text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handlePurgeKey}
                        title="Purge all key revisions"
                        className="p-1.5 rounded text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <Flame className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Sub-bar */}
                  <div className="px-4 py-1.5 bg-[#090d13] border-b border-[#181d26] flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <div className="flex items-center gap-4">
                      <span>Created: {new Date(selectedEntry.created).toLocaleString()}</span>
                      <span>Operation: {selectedEntry.operation}</span>
                    </div>
                    <div>Size: {selectedEntry.size} bytes</div>
                  </div>

                  {/* Payload Viewer */}
                  <div className="flex-1 min-h-0">
                    <DataPayloadViewer
                      data={selectedEntry.value}
                      isBinary={selectedEntry.isBinary}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-gray-500">
                  <KeyRound className="w-10 h-10 opacity-30" />
                  <div className="text-xs">No key selected. Pick a key from the list to inspect.</div>
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  ) : (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-gray-500">
      <Database className="w-12 h-12 opacity-30" />
      <div>
        <h3 className="text-sm font-semibold text-gray-300">No Bucket Selected</h3>
        <p className="text-xs text-gray-500 mt-1">
          Select a Key-Value bucket from the list or create a new one to inspect stored keys.
        </p>
      </div>
      <button
        onClick={() => setShowCreateBucket(true)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
      >
        Create KV Bucket
      </button>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <ResizableSplit
        direction="horizontal"
        initialPercent={22}
        minPercent={15}
        maxPercent={35}
        storageKey="kv_bucket_split"
        first={bucketListPanel}
        second={keyExplorerPanel}
      />

      {/* Modals */}
      <KVBucketModal
        isOpen={showCreateBucket}
        onClose={() => setShowCreateBucket(false)}
        onSubmit={handleCreateBucket}
      />

      {selectedBucket && (
        <KVBucketModal
          isOpen={showEditBucket}
          onClose={() => setShowEditBucket(false)}
          onSubmit={handleUpdateBucket}
          initialBucket={selectedBucket}
        />
      )}

      {selectedBucket && (
        <KVPutModal
          isOpen={showPutKey}
          onClose={() => setShowPutKey(false)}
          onSubmit={handlePutKey}
          bucketName={selectedBucket.bucket}
          initialKey={selectedKey || ''}
          initialValue={selectedEntry ? selectedEntry.value : ''}
        />
      )}

      {selectedBucket && selectedKey && (
        <KVHistoryDrawer
          isOpen={showHistoryDrawer}
          onClose={() => setShowHistoryDrawer(false)}
          bucket={selectedBucket.bucket}
          keyName={selectedKey}
        />
      )}
    </div>
  );
};
