import React, { useState, useEffect } from 'react';
import {
  Archive,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  HardDrive,
  Clock,
  Download,
  Upload,
  File,
  FileText,
  FileCode,
  Image as ImageIcon,
  Lock,
  Layers,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';
import {
  ListObjectBuckets,
  CreateObjectBucket,
  DeleteObjectBucket,
  SealObjectBucket,
  ListObjects,
  DownloadObject,
  DeleteObject,
} from '../../../wailsjs/go/main/App';
import { ResizableSplit } from '../common/ResizableSplit';
import { ObjectBucketModal } from './ObjectBucketModal';
import { ObjectUploadModal } from './ObjectUploadModal';
import { ObjectDetailDrawer } from './ObjectDetailDrawer';

interface ObjectStoreViewProps {
  isConnected?: boolean;
  isActiveTab?: boolean;
}

export const ObjectStoreView: React.FC<ObjectStoreViewProps> = ({
  isConnected = false,
  isActiveTab = false,
}) => {
  const [buckets, setBuckets] = useState<natsmanager.ObjectBucketInfo[]>([]);
  const [selectedBucketName, setSelectedBucketName] = useState<string | null>(null);
  const [bucketSearchQuery, setBucketSearchQuery] = useState('');
  const [loadingBuckets, setLoadingBuckets] = useState(false);

  // Objects state
  const [objects, setObjects] = useState<natsmanager.ObjectEntryInfo[]>([]);
  const [selectedObjectName, setSelectedObjectName] = useState<string | null>(null);
  const [objectSearchQuery, setObjectSearchQuery] = useState('');
  const [loadingObjects, setLoadingObjects] = useState(false);

  // Modals & Drawers
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const selectedBucket = buckets.find((b) => b.bucket === selectedBucketName);
  const selectedObject = objects.find((o) => o.name === selectedObjectName) || null;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadBuckets = async (quiet = false) => {
    if (!quiet) setLoadingBuckets(true);
    try {
      const list = await ListObjectBuckets();
      setBuckets(list || []);
      if (list && list.length > 0) {
        if (!selectedBucketName || !list.some((b) => b.bucket === selectedBucketName)) {
          setSelectedBucketName(list[0].bucket);
        }
      } else {
        setSelectedBucketName(null);
      }
    } catch (err) {
      console.error('Failed to load object buckets:', err);
    } finally {
      if (!quiet) setLoadingBuckets(false);
    }
  };

  const loadObjects = async (bucketName: string, quiet = false) => {
    if (!quiet) setLoadingObjects(true);
    try {
      const list = await ListObjects(bucketName);
      setObjects(list || []);
    } catch (err) {
      console.error(`Failed to load objects for bucket ${bucketName}:`, err);
      setObjects([]);
    } finally {
      if (!quiet) setLoadingObjects(false);
    }
  };

  useEffect(() => {
    if (isConnected && isActiveTab) {
      loadBuckets();
    }
  }, [isConnected, isActiveTab]);

  useEffect(() => {
    if (selectedBucketName && isConnected && isActiveTab) {
      loadObjects(selectedBucketName);
    } else {
      setObjects([]);
    }
  }, [selectedBucketName, isConnected, isActiveTab]);

  const handleCreateBucket = async (params: natsmanager.ObjectBucketCreateParams) => {
    await CreateObjectBucket(params);
    showToast(`Bucket "${params.bucket}" created successfully!`);
    await loadBuckets(true);
    setSelectedBucketName(params.bucket);
  };

  const handleDeleteBucket = async (bucketName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete bucket "${bucketName}" and all its objects?`)) {
      try {
        await DeleteObjectBucket(bucketName);
        showToast(`Bucket "${bucketName}" deleted`);
        await loadBuckets(true);
      } catch (err: any) {
        showToast(`Failed to delete bucket: ${err}`, 'error');
      }
    }
  };

  const handleSealBucket = async (bucketName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        `Are you sure you want to seal bucket "${bucketName}"? This makes it PERMANENTLY read-only!`
      )
    ) {
      try {
        await SealObjectBucket(bucketName);
        showToast(`Bucket "${bucketName}" sealed`);
        await loadBuckets(true);
      } catch (err: any) {
        showToast(`Failed to seal bucket: ${err}`, 'error');
      }
    }
  };

  const handleDownloadObject = async (objectName: string) => {
    if (!selectedBucketName) return;
    try {
      const res = await DownloadObject(selectedBucketName, objectName);
      // res is [success, savePath] or [boolean, string]
      const saved = Array.isArray(res) ? res[0] : (res as any)?.success;
      const savePath = Array.isArray(res) ? res[1] : (res as any)?.savePath;
      if (saved && savePath) {
        showToast(`Saved to ${savePath}`);
      }
    } catch (err: any) {
      showToast(`Download failed: ${err}`, 'error');
    }
  };

  const handleDeleteObject = async (objectName: string) => {
    if (!selectedBucketName) return;
    try {
      await DeleteObject(selectedBucketName, objectName);
      showToast(`Object "${objectName}" deleted`);
      await loadObjects(selectedBucketName, true);
      await loadBuckets(true);
    } catch (err: any) {
      showToast(`Failed to delete object: ${err}`, 'error');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: any) => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleString();
    } catch {
      return String(date);
    }
  };

  const getFileIcon = (name: string) => {
    if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) {
      return <ImageIcon className="w-4 h-4 text-purple-400" />;
    }
    if (/\.(json|xml|yaml|yml|toml|js|ts|go|py|html|css)$/i.test(name)) {
      return <FileCode className="w-4 h-4 text-emerald-400" />;
    }
    if (/\.(txt|md|log|csv)$/i.test(name)) {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const filteredBuckets = buckets.filter((b) =>
    b.bucket.toLowerCase().includes(bucketSearchQuery.toLowerCase())
  );

  const filteredObjects = objects.filter((o) =>
    o.name.toLowerCase().includes(objectSearchQuery.toLowerCase())
  );

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <Archive className="w-12 h-12 text-gray-600 mb-3" />
        <h3 className="text-sm font-semibold text-gray-300">Disconnected</h3>
        <p className="text-xs text-gray-500 mt-1">Connect to a NATS server with JetStream enabled to browse Object Stores.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden select-none">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
              : 'bg-red-950/90 text-red-200 border-red-500/30'
          }`}
        >
          {notification.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <ResizableSplit
        direction="horizontal"
        initialPercent={22}
        minPercent={15}
        maxPercent={40}
        storageKey="objectstore_buckets_split"
        first={
          <div className="flex flex-col h-full bg-[#151b23] border-r border-[#1e2530]">
            {/* Buckets Header */}
            <div className="p-3 border-b border-[#1e2530] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-white">Object Stores</span>
                <span className="text-[10px] bg-[#1a212d] text-gray-400 px-1.5 py-0.5 rounded-full font-mono">
                  {buckets.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => loadBuckets()}
                  disabled={loadingBuckets}
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors"
                  title="Refresh Buckets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBuckets ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowCreateBucket(true)}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
                  title="New Bucket"
                >
                  <Plus className="w-3 h-3" />
                  <span>Bucket</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-[#1e2530]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter buckets..."
                  value={bucketSearchQuery}
                  onChange={(e) => setBucketSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0d1117] border border-[#212836] rounded-md text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Buckets List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {filteredBuckets.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  {buckets.length === 0 ? 'No object store buckets found' : 'No matching buckets'}
                </div>
              ) : (
                filteredBuckets.map((b) => {
                  const isSelected = b.bucket === selectedBucketName;
                  return (
                    <div
                      key={b.bucket}
                      onClick={() => setSelectedBucketName(b.bucket)}
                      className={`group p-2.5 rounded-lg cursor-pointer transition-all flex flex-col gap-1.5 border ${
                        isSelected
                          ? 'bg-blue-600/10 border-blue-500/30 text-white'
                          : 'border-transparent hover:bg-[#1c232f] text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-xs font-mono flex items-center gap-1.5 truncate">
                          <Archive className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                          <span className="truncate">{b.bucket}</span>
                          {b.sealed && (
                            <span title="Sealed (Read-Only)">
                              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!b.sealed && (
                            <button
                              onClick={(e) => handleSealBucket(b.bucket, e)}
                              title="Seal Bucket (Permanently Read-Only)"
                              className="p-1 rounded text-gray-400 hover:text-amber-400 hover:bg-[#252f3e] transition-colors"
                            >
                              <Lock className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDeleteBucket(b.bucket, e)}
                            title="Delete Bucket"
                            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#252f3e] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-[#121720] border border-[#212836] px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {formatBytes(b.size)}
                          </span>
                          <span className="text-[10px] uppercase font-mono">
                            {b.storage}
                          </span>
                        </div>
                        {b.isCompressed && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
                            lz4
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        }
        second={
          <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden">
            {selectedBucket ? (
              <>
                {/* Bucket Header Banner */}
                <div className="px-5 py-3.5 border-b border-[#1e2530] bg-[#151b23] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <Archive className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-white font-mono">{selectedBucket.bucket}</h2>
                        {selectedBucket.sealed ? (
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            Sealed
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                        <span>Total Size: <span className="text-gray-200 font-mono">{formatBytes(selectedBucket.size)}</span></span>
                        <span>•</span>
                        <span>Storage: <span className="text-gray-200 capitalize">{selectedBucket.storage}</span></span>
                        <span>•</span>
                        <span>Replicas: <span className="text-gray-200">{selectedBucket.replicas}</span></span>
                        {selectedBucket.ttl > 0 && (
                          <>
                            <span>•</span>
                            <span>TTL: <span className="text-gray-200 font-mono">{selectedBucket.ttl}s</span></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadObjects(selectedBucket.bucket)}
                      disabled={loadingObjects}
                      className="p-1.5 rounded-lg border border-[#2d3544] text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors"
                      title="Refresh objects"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingObjects ? 'animate-spin' : ''}`} />
                    </button>
                    {!selectedBucket.sealed && (
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Object</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Objects Toolbar */}
                <div className="px-5 py-2.5 border-b border-[#1e2530] bg-[#10141d] flex items-center justify-between">
                  <div className="relative w-72">
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search objects in bucket..."
                      value={objectSearchQuery}
                      onChange={(e) => setObjectSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-[#0d1117] border border-[#212836] rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {filteredObjects.length} {filteredObjects.length === 1 ? 'object' : 'objects'}
                  </div>
                </div>

                {/* Objects Table */}
                <div className="flex-1 overflow-y-auto">
                  {loadingObjects ? (
                    <div className="flex items-center justify-center py-16 text-xs text-gray-500">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2 text-blue-400" />
                      Loading objects...
                    </div>
                  ) : filteredObjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
                      <File className="w-10 h-10 text-gray-600 mb-2" />
                      <p className="text-xs font-medium text-gray-300">
                        {objects.length === 0 ? 'Bucket is empty' : 'No matching objects found'}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1 max-w-sm">
                        {objects.length === 0
                          ? 'Upload files or provide base64 strings to store blobs in this bucket.'
                          : 'Try adjusting your search query.'}
                      </p>
                      {objects.length === 0 && !selectedBucket.sealed && (
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="mt-4 px-3 py-1.5 bg-[#1a212d] hover:bg-[#222a38] border border-[#2d3544] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5 text-blue-400" />
                          <span>Upload first object</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#1e2530] text-[11px] font-semibold text-gray-400 bg-[#0d1117] sticky top-0 z-10">
                          <th className="py-2.5 px-4 font-medium">Name</th>
                          <th className="py-2.5 px-4 font-medium">Size</th>
                          <th className="py-2.5 px-4 font-medium">Chunks</th>
                          <th className="py-2.5 px-4 font-medium">Modified</th>
                          <th className="py-2.5 px-4 font-medium">SHA-256 Digest</th>
                          <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2530]">
                        {filteredObjects.map((obj) => (
                          <tr
                            key={obj.name}
                            onClick={() => {
                              setSelectedObjectName(obj.name);
                              setShowDetailDrawer(true);
                            }}
                            className="group hover:bg-[#151b23] cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-4 font-mono text-white flex items-center gap-2">
                              {getFileIcon(obj.name)}
                              <span className="font-medium hover:text-blue-400 transition-colors truncate max-w-xs">
                                {obj.name}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-gray-300 whitespace-nowrap">
                              {formatBytes(obj.size)}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-gray-400 whitespace-nowrap">
                              {obj.chunks}
                            </td>
                            <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap text-[11px]">
                              {formatDate(obj.modTime)}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-gray-400 whitespace-nowrap">
                              {obj.digest ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-500 truncate max-w-[140px]" title={obj.digest}>
                                    {obj.digest}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(obj.digest || '');
                                      setCopiedDigest(obj.name);
                                      setTimeout(() => setCopiedDigest(null), 1500);
                                    }}
                                    className="p-1 rounded hover:bg-[#212836] text-gray-500 hover:text-gray-300 transition-colors"
                                    title="Copy digest"
                                  >
                                    {copiedDigest === obj.name ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleDownloadObject(obj.name)}
                                  className="p-1.5 rounded hover:bg-[#212836] text-gray-400 hover:text-blue-400 transition-colors"
                                  title="Download (Open Save As popup)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                {!selectedBucket.sealed && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Delete object "${obj.name}"?`)) {
                                        handleDeleteObject(obj.name);
                                      }
                                    }}
                                    className="p-1.5 rounded hover:bg-[#212836] text-gray-400 hover:text-red-400 transition-colors"
                                    title="Delete object"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <Archive className="w-12 h-12 text-gray-600 mb-3" />
                <h3 className="text-sm font-semibold text-gray-300">No Bucket Selected</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Select a bucket from the left panel or create a new one to browse stored objects.
                </p>
                <button
                  onClick={() => setShowCreateBucket(true)}
                  className="mt-4 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Bucket</span>
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Modals & Drawers */}
      {showCreateBucket && (
        <ObjectBucketModal
          isOpen={showCreateBucket}
          onClose={() => setShowCreateBucket(false)}
          onSubmit={handleCreateBucket}
        />
      )}

      {showUploadModal && selectedBucketName && (
        <ObjectUploadModal
          isOpen={showUploadModal}
          bucket={selectedBucketName}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            showToast('Object uploaded successfully');
            loadObjects(selectedBucketName, true);
            loadBuckets(true);
          }}
        />
      )}

      {showDetailDrawer && selectedBucketName && selectedObject && (
        <ObjectDetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => setShowDetailDrawer(false)}
          bucket={selectedBucketName}
          object={selectedObject}
          onDownload={handleDownloadObject}
          onDelete={handleDeleteObject}
        />
      )}
    </div>
  );
};
