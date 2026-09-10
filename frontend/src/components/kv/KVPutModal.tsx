import React, { useState, useEffect } from 'react';
import { X, KeyRound, ShieldAlert, Sparkles, Code2, Eye, Check } from 'lucide-react';
import { DataPayloadViewer } from '../DataPayloadViewer';

interface KVPutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (key: string, value: string) => Promise<void>;
  bucketName: string;
  initialKey?: string;
  initialValue?: string;
}

export const KVPutModal: React.FC<KVPutModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  bucketName,
  initialKey = '',
  initialValue = '',
}) => {
  const isEdit = !!initialKey;
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatSuccess, setFormatSuccess] = useState(false);

  useEffect(() => {
    setKey(initialKey);
    setValue(initialValue);
    setError(null);
    setFormatSuccess(false);
    setActiveTab('editor');
  }, [initialKey, initialValue, isOpen]);

  if (!isOpen) return null;

  const isJsonValid = (() => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  })();

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(value);
      setValue(JSON.stringify(parsed, null, 2));
      setFormatSuccess(true);
      setTimeout(() => setFormatSuccess(false), 2000);
      setError(null);
    } catch (err: any) {
      setError(`Invalid JSON: ${err.message || 'Syntax error'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('Key name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(key.trim(), value);
      onClose();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-[#151b23] border border-[#2d3544] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#212836] flex items-center justify-between bg-[#10141d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {isEdit ? `Update Key: ${initialKey}` : `Put Key into '${bucketName}'`}
              </h2>
              <p className="text-[11px] text-gray-400">
                Write string or structured JSON value to the KV bucket
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

          {/* Key Input */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Key Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isEdit}
              placeholder="e.g. config.theme, users.102, app.settings"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-50"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              Valid key characters include alphanumeric characters, dashes, underscores, dots, and equal signs.
            </span>
          </div>

          {/* Payload Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-300">Payload / Value</label>
                {isJsonValid === true && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Valid JSON
                  </span>
                )}
                {isJsonValid === false && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Plain Text / Non-JSON
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Format JSON Button */}
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="px-2 py-1 bg-[#1b222d] hover:bg-[#252f3f] border border-[#2a3446] rounded-md text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors"
                >
                  {formatSuccess ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Formatted</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>Prettify JSON</span>
                    </>
                  )}
                </button>

                {/* View/Preview Switcher */}
                <div className="flex items-center p-0.5 bg-[#0c1017] border border-[#262f3f] rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                      activeTab === 'editor'
                        ? 'bg-emerald-600 text-white font-medium shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                      activeTab === 'preview'
                        ? 'bg-emerald-600 text-white font-medium shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Formatted Tree</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Editor or Formatted Tree View */}
            {activeTab === 'editor' ? (
              <textarea
                rows={12}
                placeholder="Enter string, configuration or JSON payload here..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full p-3 bg-[#0c1017] border border-[#262f3f] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono resize-y leading-relaxed"
                spellCheck={false}
              />
            ) : (
              <div className="min-h-[280px] max-h-[400px] overflow-y-auto p-3 bg-[#0c1017] border border-[#262f3f] rounded-lg">
                {value.trim() ? (
                  <DataPayloadViewer data={value} />
                ) : (
                  <div className="text-xs text-gray-500 italic py-8 text-center">
                    Payload is empty. Enter some text or JSON in the Edit tab.
                  </div>
                )}
              </div>
            )}
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Value' : 'Put Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
