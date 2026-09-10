import React, { useState, useEffect } from 'react';
import { X, Database, HardDrive, ShieldAlert, Layers } from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';

interface KVBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: natsmanager.KVBucketCreateParams) => Promise<void>;
  initialBucket?: natsmanager.KVBucketInfo | null;
}

export const KVBucketModal: React.FC<KVBucketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialBucket,
}) => {
  const isEdit = !!initialBucket;

  const [bucket, setBucket] = useState('');
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState<number>(10);
  const [ttlSec, setTtlSec] = useState<number>(0);
  const [maxBytes, setMaxBytes] = useState<number>(-1);
  const [maxValueSize, setMaxValueSize] = useState<number>(-1);
  const [storage, setStorage] = useState<'file' | 'memory'>('file');
  const [replicas, setReplicas] = useState<number>(1);
  const [compression, setCompression] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBucket) {
      setBucket(initialBucket.bucket);
      setDescription(initialBucket.description || '');
      setHistory(initialBucket.history || 1);
      setTtlSec(initialBucket.ttl || 0);
      setMaxBytes(initialBucket.maxBytes || -1);
      setMaxValueSize(initialBucket.maxValueSize || -1);
      setStorage((initialBucket.storage as 'file' | 'memory') || 'file');
      setReplicas(initialBucket.replicas || 1);
      setCompression(initialBucket.isCompressed || false);
    } else {
      setBucket('');
      setDescription('');
      setHistory(10);
      setTtlSec(0);
      setMaxBytes(-1);
      setMaxValueSize(-1);
      setStorage('file');
      setReplicas(1);
      setCompression(false);
    }
    setError(null);
  }, [initialBucket, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucket.trim()) {
      setError('Bucket name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const params = new natsmanager.KVBucketCreateParams({
        bucket: bucket.trim(),
        description: description.trim(),
        history: Math.min(64, Math.max(1, Number(history) || 1)),
        ttlSec: Number(ttlSec) || 0,
        maxBytes: Number(maxBytes) || -1,
        maxValueSize: Number(maxValueSize) || -1,
        storage: storage,
        replicas: Math.max(1, Number(replicas) || 1),
        compression: compression,
      });

      await onSubmit(params);
      onClose();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#151b23] border border-[#2d3544] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#212836] flex items-center justify-between bg-[#10141d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {isEdit ? `Edit Bucket: ${initialBucket?.bucket}` : 'Create Key-Value Bucket'}
              </h2>
              <p className="text-[11px] text-gray-400">
                {isEdit ? 'Update bucket configuration' : 'NATS JetStream backed key-value store'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-all">{error}</div>
            </div>
          )}

          {/* Bucket Name */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Bucket Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isEdit}
              placeholder="e.g. user_configs, sessions, app_state"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              Only alphanumeric characters, dashes, and underscores.
            </span>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. User configuration storage"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* History & Storage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Max History (1-64)
              </label>
              <input
                type="number"
                min={1}
                max={64}
                value={history}
                onChange={(e) => setHistory(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Revisions kept per key</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Storage Backend</label>
              <select
                disabled={isEdit}
                value={storage}
                onChange={(e) => setStorage(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="file">File (Persistent)</option>
                <option value="memory">Memory (Ephemeral)</option>
              </select>
              <span className="text-[10px] text-gray-500 mt-1 block">Underlying JetStream engine</span>
            </div>
          </div>

          {/* TTL & Max Bytes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Key TTL (seconds)
              </label>
              <input
                type="number"
                min={0}
                placeholder="0 for unlimited"
                value={ttlSec}
                onChange={(e) => setTtlSec(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">0 = keys never expire</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Replicas (Cluster)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                disabled={isEdit}
                value={replicas}
                onChange={(e) => setReplicas(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">1 for standalone servers</span>
            </div>
          </div>

          {/* Max Value Size & Max Bucket Bytes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Max Value Size (bytes)
              </label>
              <input
                type="number"
                min={-1}
                placeholder="-1 for unlimited"
                value={maxValueSize}
                onChange={(e) => setMaxValueSize(parseInt(e.target.value) || -1)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Max Total Bytes
              </label>
              <input
                type="number"
                min={-1}
                placeholder="-1 for unlimited"
                value={maxBytes}
                onChange={(e) => setMaxBytes(parseInt(e.target.value) || -1)}
                className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Compression */}
          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={compression}
                onChange={(e) => setCompression(e.target.checked)}
                className="rounded border-[#262f3f] bg-[#0c1017] text-blue-600 focus:ring-0"
              />
              <span>Enable Stream Compression (NATS 2.10+)</span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#212836] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1b222d] hover:bg-[#242c3b] text-gray-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Bucket' : 'Create Bucket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
