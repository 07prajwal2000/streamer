import React, { useState, useEffect } from 'react';
import { X, Archive, HardDrive, ShieldAlert, Cpu } from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';

interface ObjectBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: natsmanager.ObjectBucketCreateParams) => Promise<void>;
}

export const ObjectBucketModal: React.FC<ObjectBucketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [bucket, setBucket] = useState('');
  const [description, setDescription] = useState('');
  const [ttlSec, setTtlSec] = useState<number>(0);
  const [maxBytes, setMaxBytes] = useState<number>(-1);
  const [storage, setStorage] = useState<'file' | 'memory'>('file');
  const [replicas, setReplicas] = useState<number>(1);
  const [compression, setCompression] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBucket('');
      setDescription('');
      setTtlSec(0);
      setMaxBytes(-1);
      setStorage('file');
      setReplicas(1);
      setCompression(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBucket = bucket.trim();
    if (!trimmedBucket) {
      setError('Bucket name is required');
      return;
    }
    // Validation: NATS bucket names typically allow alphanumeric, dashes, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedBucket)) {
      setError('Bucket name must contain only alphanumeric characters, dashes, and underscores');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const params = new natsmanager.ObjectBucketCreateParams({
        bucket: trimmedBucket,
        description: description.trim(),
        ttlSec: Number(ttlSec) || 0,
        maxBytes: Number(maxBytes) || -1,
        storage: storage,
        replicas: Math.max(1, Math.min(5, Number(replicas) || 1)),
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
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">New Object Store Bucket</h2>
              <p className="text-[11px] text-gray-500">Create a JetStream-backed object store bucket</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2.5 text-xs text-red-400">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1 break-all">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Bucket Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              placeholder="e.g. assets, models, firmware"
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#2d3544] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#2d3544] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Storage and Replicas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Storage Backend</label>
              <div className="flex rounded-lg overflow-hidden border border-[#2d3544] p-0.5 bg-[#0d1117]">
                <button
                  type="button"
                  onClick={() => setStorage('file')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                    storage === 'file'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStorage('memory')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                    storage === 'memory'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Memory</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Replicas</label>
              <input
                type="number"
                min="1"
                max="5"
                value={replicas}
                onChange={(e) => setReplicas(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#2d3544] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* TTL and Max Bytes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                TTL (seconds)
              </label>
              <input
                type="number"
                min="0"
                value={ttlSec}
                onChange={(e) => setTtlSec(parseInt(e.target.value) || 0)}
                placeholder="0 = unlimited"
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#2d3544] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">0 means never expires</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Max Store Bytes
              </label>
              <input
                type="number"
                value={maxBytes}
                onChange={(e) => setMaxBytes(parseInt(e.target.value) || -1)}
                placeholder="-1 = unlimited"
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#2d3544] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">-1 means unlimited</span>
            </div>
          </div>

          {/* Compression */}
          <div className="pt-2 border-t border-[#212836]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={compression}
                onChange={(e) => setCompression(e.target.checked)}
                className="rounded border-[#2d3544] text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#0d1117] w-4 h-4"
              />
              <div>
                <span className="text-xs font-medium text-gray-300 block">Stream Compression</span>
                <span className="text-[10px] text-gray-500 block">
                  Compresses chunks on disk (requires NATS Server 2.10+)
                </span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#212836] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white bg-[#1a212d] hover:bg-[#232b3a] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Bucket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
