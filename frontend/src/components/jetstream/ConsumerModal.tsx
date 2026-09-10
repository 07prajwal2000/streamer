import React, { useState } from 'react';
import { X, Users, Settings2 } from 'lucide-react';
import { natsmanager } from '../../../wailsjs/go/models';

interface ConsumerModalProps {
  streamName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: natsmanager.ConsumerCreateParams) => Promise<void>;
}

export const ConsumerModal: React.FC<ConsumerModalProps> = ({
  streamName,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [durable, setDurable] = useState('');
  const [description, setDescription] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [deliverPolicy, setDeliverPolicy] = useState<'all' | 'last' | 'new' | 'by_start_sequence'>('all');
  const [optStartSeq, setOptStartSeq] = useState<number>(1);
  const [ackPolicy, setAckPolicy] = useState<'explicit' | 'none' | 'all'>('explicit');
  const [ackWaitSec, setAckWaitSec] = useState<number>(30);
  const [maxDeliver, setMaxDeliver] = useState<number>(-1);
  const [replayPolicy, setReplayPolicy] = useState<'instant' | 'original'>('instant');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!durable.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const params = new natsmanager.ConsumerCreateParams({
        stream: streamName,
        name: durable.trim(),
        durable: durable.trim(),
        description: description.trim(),
        filterSubject: filterSubject.trim(),
        deliverPolicy,
        optStartSeq: deliverPolicy === 'by_start_sequence' ? Number(optStartSeq) : 0,
        ackPolicy,
        ackWaitSec: Number(ackWaitSec),
        maxDeliver: Number(maxDeliver),
        replayPolicy,
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
      <div className="w-full max-w-lg bg-[#111722] border border-[#1f2838] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1f2838] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">
              Create Consumer for <span className="font-mono text-purple-300">{streamName}</span>
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
              <label className="font-medium text-gray-300">Durable Name *</label>
              <input
                type="text"
                required
                autoFocus
                value={durable}
                onChange={(e) => setDurable(e.target.value)}
                placeholder="worker-group-1"
                className="w-full bg-[#151c27] border border-[#222b3c] focus:border-purple-500 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Filter Subject (Optional)</label>
              <input
                type="text"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                placeholder="orders.created"
                className="w-full bg-[#151c27] border border-[#222b3c] focus:border-purple-500 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-gray-300">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Order processing background worker"
              className="w-full bg-[#151c27] border border-[#222b3c] focus:border-purple-500 rounded-lg px-3 py-1.5 text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Deliver Policy</label>
              <select
                value={deliverPolicy}
                onChange={(e) => setDeliverPolicy(e.target.value as any)}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none"
              >
                <option value="all">Deliver All (from beginning)</option>
                <option value="last">Deliver Last</option>
                <option value="new">Deliver New (future only)</option>
                <option value="by_start_sequence">By Start Sequence</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Ack Policy</label>
              <select
                value={ackPolicy}
                onChange={(e) => setAckPolicy(e.target.value as any)}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none"
              >
                <option value="explicit">Explicit (Must acknowledge)</option>
                <option value="none">None (Fire and forget)</option>
                <option value="all">All (Ack cumulative)</option>
              </select>
            </div>
          </div>

          {deliverPolicy === 'by_start_sequence' && (
            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Start Sequence Number</label>
              <input
                type="number"
                min={1}
                value={optStartSeq}
                onChange={(e) => setOptStartSeq(Number(e.target.value))}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded px-3 py-1.5 font-mono text-gray-200"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Ack Wait (Sec)</label>
              <input
                type="number"
                min={1}
                value={ackWaitSec}
                onChange={(e) => setAckWaitSec(Number(e.target.value))}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded px-2.5 py-1.5 font-mono text-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Max Deliver (-1 unltd)</label>
              <input
                type="number"
                value={maxDeliver}
                onChange={(e) => setMaxDeliver(Number(e.target.value))}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded px-2.5 py-1.5 font-mono text-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-gray-300">Replay Policy</label>
              <select
                value={replayPolicy}
                onChange={(e) => setReplayPolicy(e.target.value as any)}
                className="w-full bg-[#151c27] border border-[#222b3c] rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none"
              >
                <option value="instant">Instant</option>
                <option value="original">Original Speed</option>
              </select>
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
              disabled={submitting || !durable.trim()}
              className="px-4 py-1.5 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Creating...' : 'Create Consumer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
