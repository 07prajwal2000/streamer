import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  Copy,
  Check,
  File,
  HardDrive,
  Clock,
  Layers,
  Key,
  Hash,
  Info,
  RefreshCw,
  Code,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { natsmanager, main } from '../../../wailsjs/go/models';
import { GetObjectPreview } from '../../../wailsjs/go/main/App';

interface ObjectDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bucket: string;
  object: natsmanager.ObjectEntryInfo | null;
  onDownload: (name: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

export const ObjectDetailDrawer: React.FC<ObjectDetailDrawerProps> = ({
  isOpen,
  onClose,
  bucket,
  object,
  onDownload,
  onDelete,
}) => {
  const [digestCopied, setDigestCopied] = useState(false);
  const [nuidCopied, setNuidCopied] = useState(false);
  const [preview, setPreview] = useState<main.ObjectContentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && object && bucket) {
      loadPreview(object.name);
    } else {
      setPreview(null);
      setPreviewError(null);
    }
  }, [isOpen, object?.name, bucket]);

  if (!isOpen || !object) return null;

  const loadPreview = async (name: string) => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const data = await GetObjectPreview(bucket, name, 1024 * 1024);
      setPreview(data);
    } catch (err: any) {
      setPreviewError(String(err));
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCopy = (text: string, type: 'digest' | 'nuid') => {
    navigator.clipboard.writeText(text);
    if (type === 'digest') {
      setDigestCopied(true);
      setTimeout(() => setDigestCopied(false), 2000);
    } else {
      setNuidCopied(true);
      setTimeout(() => setNuidCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload(object.name);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete object "${object.name}"?`)) {
      setDeleting(true);
      try {
        await onDelete(object.name);
        onClose();
      } finally {
        setDeleting(false);
      }
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

  const isImageFile = (name: string) => {
    return /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-full bg-[#151b23] border-l border-[#2d3544] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[#212836] flex items-center justify-between bg-[#10141d]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <File className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate font-mono">{object.name}</h2>
              <p className="text-[11px] text-gray-500">
                Bucket: <span className="font-mono text-gray-400">{bucket}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              title="Download file (opens native Save As popup)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Saving...' : 'Download'}</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#1f2633] rounded-lg transition-colors"
              title="Delete Object"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1f2633] rounded-lg transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0d1117] border border-[#212836] rounded-lg p-3">
              <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Object Size</span>
              </div>
              <div className="text-sm font-semibold text-white font-mono">
                {formatBytes(object.size)}
              </div>
            </div>

            <div className="bg-[#0d1117] border border-[#212836] rounded-lg p-3">
              <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Chunks</span>
              </div>
              <div className="text-sm font-semibold text-white font-mono">
                {object.chunks} chunks
              </div>
            </div>

            <div className="bg-[#0d1117] border border-[#212836] rounded-lg p-3">
              <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Last Modified</span>
              </div>
              <div className="text-xs font-semibold text-white truncate" title={formatDate(object.modTime)}>
                {formatDate(object.modTime)}
              </div>
            </div>
          </div>

          {/* SHA-256 Digest & NUID */}
          <div className="space-y-2">
            <div className="bg-[#0d1117] border border-[#212836] rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-blue-400" />
                  <span>SHA-256 Digest</span>
                </span>
                {object.digest && (
                  <button
                    onClick={() => handleCopy(object.digest || '', 'digest')}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {digestCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{digestCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="text-xs font-mono text-gray-300 break-all bg-[#151b23] p-2 rounded border border-[#2d3544]">
                {object.digest || 'No digest available'}
              </div>
            </div>

            <div className="bg-[#0d1117] border border-[#212836] rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" />
                  <span>Internal NUID</span>
                </span>
                {object.nuid && (
                  <button
                    onClick={() => handleCopy(object.nuid, 'nuid')}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {nuidCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{nuidCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="text-xs font-mono text-gray-300 break-all bg-[#151b23] p-2 rounded border border-[#2d3544]">
                {object.nuid || '—'}
              </div>
            </div>
          </div>

          {/* Description */}
          {object.description && (
            <div className="bg-[#0d1117] border border-[#212836] rounded-lg p-3">
              <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mb-1">
                <Info className="w-3.5 h-3.5" />
                <span>Description</span>
              </div>
              <p className="text-xs text-gray-300">{object.description}</p>
            </div>
          )}

          {/* Metadata */}
          {object.metadata && Object.keys(object.metadata).length > 0 && (
            <div className="bg-[#0d1117] border border-[#212836] rounded-lg p-3">
              <div className="text-[11px] text-gray-500 mb-2 font-medium">Custom Metadata</div>
              <div className="space-y-1">
                {Object.entries(object.metadata).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#151b23] border border-[#212836]"
                  >
                    <span className="font-mono text-blue-400">{k}</span>
                    <span className="font-mono text-gray-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Section */}
          <div className="bg-[#0d1117] border border-[#212836] rounded-lg overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-[#10141d] border-b border-[#212836] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span>Content Preview</span>
                {preview?.truncated && (
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                    Truncated (1 MB)
                  </span>
                )}
              </div>
              <button
                onClick={() => loadPreview(object.name)}
                disabled={loadingPreview}
                className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                title="Refresh preview"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPreview ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="p-3">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-8 text-xs text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading content preview...
                </div>
              ) : previewError ? (
                <div className="text-xs text-red-400 p-3 bg-red-500/10 rounded border border-red-500/20">
                  Failed to load preview: {previewError}
                </div>
              ) : preview ? (
                <div>
                  {/* Image Preview */}
                  {isImageFile(object.name) && preview.base64 ? (
                    <div className="flex flex-col items-center justify-center p-4 bg-[#151b23] rounded border border-[#2d3544]">
                      <img
                        src={`data:image/${object.name.split('.').pop()};base64,${preview.base64}`}
                        alt={object.name}
                        className="max-h-64 max-w-full rounded object-contain shadow-md"
                      />
                    </div>
                  ) : preview.isBinary ? (
                    /* Binary File Base64 Display */
                    <div>
                      <div className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                        <span>Binary payload (Base64 encoded):</span>
                      </div>
                      <textarea
                        readOnly
                        rows={6}
                        value={preview.base64 || ''}
                        className="w-full px-2.5 py-2 bg-[#151b23] border border-[#2d3544] rounded text-xs font-mono text-gray-300 resize-none focus:outline-none"
                      />
                    </div>
                  ) : (
                    /* Plain text / JSON */
                    <div>
                      <textarea
                        readOnly
                        rows={10}
                        value={preview.text || ''}
                        className="w-full px-2.5 py-2 bg-[#151b23] border border-[#2d3544] rounded text-xs font-mono text-emerald-400 resize-none focus:outline-none select-text"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-500 text-center py-4">
                  No preview available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
