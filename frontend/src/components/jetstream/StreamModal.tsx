import React, { useState, useEffect } from 'react';
import { X, Layers, Clock, ShieldAlert } from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';

interface StreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: natsmanager.StreamCreateParams) => Promise<void>;
  initialStream?: natsmanager.JSStreamInfo | null;
  isEditMode?: boolean;
}

export const StreamModal: React.FC<StreamModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialStream,
  isEditMode = false,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectsText, setSubjectsText] = useState('');
  const [storage, setStorage] = useState<'file' | 'memory'>('file');
  const [retention, setRetention] = useState<'limits' | 'interest' | 'workqueue'>('limits');
  const [discard, setDiscard] = useState<'old' | 'new'>('old');
  const [maxMsgs, setMaxMsgs] = useState(-1);
  const [maxBytes, setMaxBytes] = useState(-1);
  const [maxAgeSec, setMaxAgeSec] = useState(0);
  const [maxMsgSize, setMaxMsgSize] = useState(-1);
  const [replicas, setReplicas] = useState(1);
  const [allowMsgSchedules, setAllowMsgSchedules] = useState(false);
  const [denyPurge, setDenyPurge] = useState(false);
  const [denyDelete, setDenyDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStream && isEditMode) {
      setName(initialStream.name);
      setDescription(initialStream.description || '');
      setSubjectsText((initialStream.subjects || []).join(', '));
      setStorage(initialStream.storage as any);
      setRetention(initialStream.retention as any);
      setDiscard(initialStream.discard as any);
      setMaxMsgs(initialStream.maxMsgs);
      setMaxBytes(initialStream.maxBytes);
      setMaxAgeSec(initialStream.maxAgeSec);
      setMaxMsgSize(initialStream.maxMsgSize);
      setReplicas(initialStream.replicas || 1);
      setAllowMsgSchedules(Boolean(initialStream.allowMsgSchedules));
      setDenyPurge(Boolean(initialStream.denyPurge));
      setDenyDelete(Boolean(initialStream.denyDelete));
    } else {
      setName('');
      setDescription('');
      setSubjectsText('');
      setStorage('file');
      setRetention('limits');
      setDiscard('old');
      setMaxMsgs(-1);
      setMaxBytes(-1);
      setMaxAgeSec(0);
      setMaxMsgSize(-1);
      setReplicas(1);
      setAllowMsgSchedules(false);
      setDenyPurge(false);
      setDenyDelete(false);
    }
  }, [initialStream, isEditMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const subjects = subjectsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (subjects.length === 0) {
      subjects.push(`${name.trim()}.>`);
    }

    setSubmitting(true);
    setError(null);
    try {
      const params = new natsmanager.StreamCreateParams({
        name: name.trim(),
        description: description.trim(),
        subjects,
        storage,
        retention,
        discard,
        maxMsgs: Number(maxMsgs),
        maxBytes: Number(maxBytes),
        maxAgeSec: Number(maxAgeSec),
        maxMsgSize: Number(maxMsgSize),
        replicas: Number(replicas),
        allowMsgSchedules,
        denyPurge,
        denyDelete,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="w-full max-w-xl bg-[#111722] border border-[#1f2838] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1f2838] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">
              {isEditMode ? `Edit Stream "${name}"` : 'Create JetStream Stream'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Stream Name *</label>
              <input
                type="text"
                required
                disabled={isEditMode}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ORDERS"
                className="w-full bg-[#151c27] border border-[#222b3c] focus:border-purple-500 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none uppercase disabled:opacity-50"
              />
              <p className="text-[10px] text-gray-500">Immutable after creation.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Orders processing stream"
                className="w-full bg-[#151c27] border border-[#222b3c] focus:border-purple-500 rounded-lg px-3 py-1.5 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-gray-300">Subjects *</label>
            <input
              type="text"
              value={subjectsText}
              onChange={(e) => setSubjectsText(e.target.value)}
              placeholder="e.g. orders.*, orders.created.>"
              className="w-full bg-[#151c27] border border-[#222b3c] focus:border-purple-500 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none"
            />
            <p className="text-[10px] text-gray-500">
              Comma-separated subjects. You can add or modify subjects anytime.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Storage Backend</label>
              <select
                disabled={isEditMode}
                value={storage}
                onChange={(e) => setStorage(e.target.value as any)}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none disabled:opacity-50"
              >
                <option value="file">File (Disk)</option>
                <option value="memory">Memory (RAM)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Retention Policy</label>
              <select
                value={retention}
                onChange={(e) => setRetention(e.target.value as any)}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none"
              >
                <option value="limits">Limits (Age/Count/Bytes)</option>
                <option value="interest">Interest (Active consumers)</option>
                <option value="workqueue">WorkQueue (Ack removes)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Discard Policy</label>
              <select
                value={discard}
                onChange={(e) => setDiscard(e.target.value as any)}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none"
              >
                <option value="old">Discard Oldest</option>
                <option value="new">Discard New (Reject publish)</option>
              </select>
            </div>
          </div>

          {/* Limits section */}
          <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1d2534] space-y-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Stream Limits (-1 for unlimited)
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">Max Messages</label>
                <input
                  type="number"
                  value={maxMsgs}
                  onChange={(e) => setMaxMsgs(Number(e.target.value))}
                  className="w-full bg-[#151c27] border border-[#222b3c] rounded px-2 py-1 font-mono text-gray-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">Max Bytes</label>
                <input
                  type="number"
                  value={maxBytes}
                  onChange={(e) => setMaxBytes(Number(e.target.value))}
                  className="w-full bg-[#151c27] border border-[#222b3c] rounded px-2 py-1 font-mono text-gray-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">Max Age (Sec)</label>
                <input
                  type="number"
                  value={maxAgeSec}
                  onChange={(e) => setMaxAgeSec(Number(e.target.value))}
                  className="w-full bg-[#151c27] border border-[#222b3c] rounded px-2 py-1 font-mono text-gray-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">Max Msg Size</label>
                <input
                  type="number"
                  value={maxMsgSize}
                  onChange={(e) => setMaxMsgSize(Number(e.target.value))}
                  className="w-full bg-[#151c27] border border-[#222b3c] rounded px-2 py-1 font-mono text-gray-200"
                />
              </div>
            </div>
          </div>

          {/* Advanced Features */}
          <div className="p-3.5 rounded-xl bg-[#0e131b] border border-[#1d2534] space-y-2.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Advanced Stream Features
            </span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isEditMode && Boolean(initialStream?.allowMsgSchedules)}
                  checked={allowMsgSchedules}
                  onChange={(e) => setAllowMsgSchedules(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#151c27] border-[#222b3c] text-purple-600 focus:ring-0 disabled:opacity-50"
                />
                <span className="text-gray-200">
                  Allow Message Schedules <span className="text-purple-400 font-mono text-[10px]">(Nats-Schedule cron)</span>
                  {isEditMode && Boolean(initialStream?.allowMsgSchedules) && (
                    <span className="text-gray-500 text-[10px] ml-1.5 italic font-sans">(Immutable once enabled)</span>
                  )}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={denyPurge}
                  onChange={(e) => setDenyPurge(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#151c27] border-[#222b3c] text-purple-600 focus:ring-0"
                />
                <span className="text-gray-200">Deny Purge (Prevent stream purge via API)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={denyDelete}
                  onChange={(e) => setDenyDelete(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#151c27] border-[#222b3c] text-purple-600 focus:ring-0"
                />
                <span className="text-gray-200">Deny Delete (Prevent single message deletion)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#1f2838]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-1.5 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
