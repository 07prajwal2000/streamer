import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileUp,
  FileCode,
  HardDrive,
  File,
  ShieldAlert,
  Plus,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import {
  PutObjectFromBase64,
  PutObjectFromFile,
  SelectFile,
} from '../../../wailsjs/go/main/App';

interface ObjectUploadModalProps {
  isOpen: boolean;
  bucket: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObjectUploadModal: React.FC<ObjectUploadModalProps> = ({
  isOpen,
  bucket,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'base64'>('file');
  const [objectName, setObjectName] = useState('');
  const [description, setDescription] = useState('');

  // File tab state
  const [localFilePath, setLocalFilePath] = useState('');
  const [browserFile, setBrowserFile] = useState<File | null>(null);
  const [browserFileBase64, setBrowserFileBase64] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Base64 tab state
  const [base64Input, setBase64Input] = useState('');
  const [inputEncoding, setInputEncoding] = useState<'base64' | 'text'>('base64');

  // Metadata tags
  const [metadataList, setMetadataList] = useState<{ key: string; value: string }[]>([]);
  const [showMetadata, setShowMetadata] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setObjectName('');
      setDescription('');
      setLocalFilePath('');
      setBrowserFile(null);
      setBrowserFileBase64('');
      setBase64Input('');
      setMetadataList([]);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Native file picker using Wails dialog
  const handlePickLocalFile = async () => {
    try {
      const selected = await SelectFile('Select File to Upload', 'All Files (*.*)', '*.*');
      if (selected) {
        setLocalFilePath(selected);
        setBrowserFile(null);
        setBrowserFileBase64('');
        // Extract filename from path
        const filename = selected.replace(/^.*[\\/]/, '');
        if (!objectName) {
          setObjectName(filename);
        }
      }
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  };

  // Browser file input / drag & drop handler
  const handleBrowserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBrowserFile(file);
      setLocalFilePath('');
      if (!objectName) {
        setObjectName(file.name);
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:*;base64, prefix if present
        const commaIdx = result.indexOf(',');
        setBrowserFileBase64(commaIdx !== -1 ? result.substring(commaIdx + 1) : result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMeta = () => {
    setMetadataList((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveMeta = (index: number) => {
    setMetadataList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMetaChange = (index: number, field: 'key' | 'value', val: string) => {
    setMetadataList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = objectName.trim();
    if (!trimmedName) {
      setError('Object name is required');
      return;
    }

    const metaMap: Record<string, string> = {};
    for (const item of metadataList) {
      if (item.key.trim()) {
        metaMap[item.key.trim()] = item.value.trim();
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      if (activeTab === 'file') {
        if (localFilePath) {
          // Upload from local file path via backend streaming
          await PutObjectFromFile(bucket, trimmedName, description.trim(), localFilePath, metaMap);
        } else if (browserFileBase64) {
          // Upload browser-selected file as base64
          await PutObjectFromBase64(bucket, trimmedName, description.trim(), browserFileBase64, metaMap);
        } else {
          setError('Please select a file to upload');
          setSubmitting(false);
          return;
        }
      } else {
        // Base64 or raw text tab
        if (!base64Input.trim()) {
          setError('Content cannot be empty');
          setSubmitting(false);
          return;
        }

        let b64 = base64Input.trim();
        if (inputEncoding === 'text') {
          // UTF-8 encode to base64
          b64 = btoa(unescape(encodeURIComponent(b64)));
        }

        await PutObjectFromBase64(bucket, trimmedName, description.trim(), b64, metaMap);
      }

      onSuccess();
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
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Upload Object</h2>
              <p className="text-[11px] text-gray-500">
                Bucket: <span className="font-mono text-gray-300 font-semibold">{bucket}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2633] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#212836] bg-[#0d1117] px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Local File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('base64')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'base64'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Base64 / Text Content</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2.5 text-xs text-red-400">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1 break-all">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Object Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              placeholder="e.g. dataset.csv, config.json, image.png"
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

          {/* TAB 1: File Selection */}
          {activeTab === 'file' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">File Source</label>
                <div className="space-y-2">
                  {/* Native file picker */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePickLocalFile}
                      className="px-3 py-2 bg-[#1a212d] hover:bg-[#222a38] border border-[#2d3544] rounded-lg text-xs font-medium text-white flex items-center gap-2 transition-colors shrink-0"
                    >
                      <FolderOpen className="w-4 h-4 text-blue-400" />
                      <span>Browse Local Disk...</span>
                    </button>
                    <div className="flex-1 px-3 py-2 bg-[#0d1117] border border-[#212836] rounded-lg text-xs font-mono text-gray-400 truncate">
                      {localFilePath ? (
                        <span className="text-emerald-400">{localFilePath}</span>
                      ) : (
                        <span className="text-gray-600">No file selected via disk dialog</span>
                      )}
                    </div>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-[#212836]"></div>
                    <span className="flex-shrink mx-3 text-[10px] text-gray-600 uppercase">Or select from browser</span>
                    <div className="flex-grow border-t border-[#212836]"></div>
                  </div>

                  {/* HTML File input / Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-[#2d3544] hover:border-blue-500/50 rounded-lg p-4 text-center cursor-pointer bg-[#0d1117]/60 hover:bg-[#0d1117] transition-all"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleBrowserFileChange}
                      className="hidden"
                    />
                    <FileUp className="w-6 h-6 text-gray-500 mx-auto mb-1.5" />
                    {browserFile ? (
                      <div>
                        <div className="text-xs font-semibold text-emerald-400 font-mono">
                          {browserFile.name}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {(browserFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs text-gray-300">
                          Click to select a file from browser
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Supports any file format (text, image, binary, zip, etc.)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Base64 / Text Content */}
          {activeTab === 'base64' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-300">Payload Format</label>
                <div className="flex bg-[#0d1117] border border-[#2d3544] rounded-md p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInputEncoding('base64')}
                    className={`px-2.5 py-0.5 rounded transition-colors ${
                      inputEncoding === 'base64'
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Base64 String
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputEncoding('text')}
                    className={`px-2.5 py-0.5 rounded transition-colors ${
                      inputEncoding === 'text'
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Plain Text / JSON
                  </button>
                </div>
              </div>

              <div>
                <textarea
                  rows={7}
                  value={base64Input}
                  onChange={(e) => setBase64Input(e.target.value)}
                  placeholder={
                    inputEncoding === 'base64'
                      ? 'Paste Base64 encoded string here (e.g. aGVsbG8gd29ybGQ= or data:...;base64,...)'
                      : 'Enter raw text or JSON content to upload...'
                  }
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#2d3544] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono resize-none"
                />
                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                  <span>Characters: {base64Input.length}</span>
                  {inputEncoding === 'base64' && base64Input && (
                    <span>
                      Est. decoded size: ~{Math.round((base64Input.length * 3) / 4 / 1024)} KB
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <div className="pt-2 border-t border-[#212836]">
            <button
              type="button"
              onClick={() => setShowMetadata(!showMetadata)}
              className="flex items-center justify-between w-full text-xs font-medium text-gray-400 hover:text-white py-1"
            >
              <span>Custom Metadata ({metadataList.length})</span>
              <span className="text-[10px] text-blue-400">{showMetadata ? 'Hide' : 'Add / View'}</span>
            </button>

            {showMetadata && (
              <div className="mt-2 space-y-2">
                {metadataList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => handleMetaChange(idx, 'key', e.target.value)}
                      placeholder="Key"
                      className="flex-1 px-2.5 py-1.5 bg-[#0d1117] border border-[#2d3544] rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => handleMetaChange(idx, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-2.5 py-1.5 bg-[#0d1117] border border-[#2d3544] rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMeta(idx)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-[#1a212d] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddMeta}
                  className="px-2.5 py-1 bg-[#1a212d] hover:bg-[#222a38] text-gray-300 text-xs rounded border border-[#2d3544] flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Metadata Field</span>
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
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
              {submitting ? 'Uploading...' : 'Upload to Object Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
