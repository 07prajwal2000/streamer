import React, { useState, useEffect } from 'react';
import { X, History, Clock, Layers, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';
import { GetKVHistory } from '../../../wailsjs/go/main/App';
import { DataPayloadViewer } from '../DataPayloadViewer';

interface KVHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bucket: string;
  keyName: string;
}

export const KVHistoryDrawer: React.FC<KVHistoryDrawerProps> = ({
  isOpen,
  onClose,
  bucket,
  keyName,
}) => {
  const [history, setHistory] = useState<natsmanager.KVEntryInfo[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<natsmanager.KVEntryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!bucket || !keyName) return;
    setLoading(true);
    setError(null);
    try {
      const list = await GetKVHistory(bucket, keyName);
      setHistory(list || []);
      if (list && list.length > 0) {
        setSelectedRevision(list[0]);
      } else {
        setSelectedRevision(null);
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, bucket, keyName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl h-full bg-[#151b23] border-l border-[#2d3544] shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="h-14 px-5 border-b border-[#212836] flex items-center justify-between bg-[#10141d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-white font-mono">{keyName}</h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-400">
                  {bucket}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Revision History Timeline</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh revisions"
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body: Split Revisions List & Payload Viewer */}
        <div className="flex-1 flex min-h-0">
          {/* Left Column: Revisions Timeline */}
          <div className="w-72 border-r border-[#212836] flex flex-col bg-[#0c1017]">
            <div className="p-3 border-b border-[#1c2330] flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Revisions ({history.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading ? (
                <div className="p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading revisions...
                </div>
              ) : error ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="break-all">{error}</div>
                </div>
              ) : history.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">No revisions found.</div>
              ) : (
                history.map((rev) => {
                  const isSelected = selectedRevision?.revision === rev.revision;
                  return (
                    <div
                      key={rev.revision}
                      onClick={() => setSelectedRevision(rev)}
                      className={`p-2.5 rounded-lg cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-[#151c27] border-blue-500/40 text-white shadow-sm'
                          : 'border-[#1e2530] text-gray-400 hover:bg-[#111720] hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-semibold text-blue-400">
                          Rev #{rev.revision}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            rev.operation === 'PUT'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : rev.operation === 'DEL'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {rev.operation}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(rev.created).toLocaleTimeString()}
                        </span>
                        <span>{rev.size} bytes</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Payload Inspection */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0d1219]">
            {selectedRevision ? (
              <div className="h-full flex flex-col">
                <div className="px-4 py-2.5 bg-[#10151f] border-b border-[#1e2530] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-gray-400">Revision</span>
                    <span className="text-white font-semibold">#{selectedRevision.revision}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">Timestamp:</span>
                    <span className="text-gray-300">
                      {new Date(selectedRevision.created).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Size: <span className="text-gray-200 font-mono">{selectedRevision.size} B</span>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <DataPayloadViewer
                    data={selectedRevision.value}
                    isBinary={selectedRevision.isBinary}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
                Select a revision to view its stored value.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
