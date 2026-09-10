import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Send, 
  ArrowRightLeft, 
  Clock, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PublishMessage, RequestMessage } from '../../../wailsjs/go/main/App';
import { natsmanager } from '../../../wailsjs/go/models';

interface PublisherPanelProps {
  onMessageSent?: (msg: natsmanager.PubSubMessage) => void;
  initialSubject?: string;
  initialPayload?: string;
}

export const PublisherPanel: React.FC<PublisherPanelProps> = ({
  onMessageSent,
  initialSubject = '',
  initialPayload = '',
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [replyTo, setReplyTo] = useState('');
  const [isRequest, setIsRequest] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(3000);
  const [payload, setPayload] = useState(initialPayload);
  const [headers, setHeaders] = useState<{ key: string; val: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Synchronize when initial props change (e.g. clicking "Re-publish")
  React.useEffect(() => {
    if (initialSubject) setSubject(initialSubject);
    if (initialPayload) setPayload(initialPayload);
  }, [initialSubject, initialPayload]);

  const addHeader = () => {
    setHeaders([...headers, { key: '', val: '' }]);
  };

  const updateHeader = (index: number, field: 'key' | 'val', value: string) => {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!subject.trim()) return;
    setSending(true);
    setStatusMsg(null);

    // Build headers map
    const headerMap: { [key: string]: string[] } = {};
    headers.forEach((h) => {
      if (h.key.trim()) {
        headerMap[h.key.trim()] = [h.val];
      }
    });

    try {
      if (isRequest) {
        const reply = await RequestMessage(subject.trim(), headerMap, payload, timeoutMs);
        setStatusMsg({
          ok: true,
          text: `Reply received from ${reply.subject} (${reply.size} B)`,
        });
        if (onMessageSent) {
          onMessageSent(reply);
        }
      } else {
        await PublishMessage(subject.trim(), replyTo.trim(), headerMap, payload);
        setStatusMsg({
          ok: true,
          text: `Message published to ${subject.trim()}`,
        });
      }
    } catch (err: any) {
      setStatusMsg({
        ok: false,
        text: String(err),
      });
    } finally {
      setSending(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  return (
    <div className="bg-[#0b0f16] border-t border-[#1e2530] p-3 select-none">
      {/* Top Controls */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center rounded-lg bg-[#141a24] p-0.5 border border-[#232d3d]">
          <button
            type="button"
            onClick={() => setIsRequest(false)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              !isRequest
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Publish
          </button>
          <button
            type="button"
            onClick={() => setIsRequest(true)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              isRequest
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Request-Reply
          </button>
        </div>

        {/* Subject Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Target subject (e.g. orders.create, telemetry.v1.ping)"
            className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none placeholder-gray-600"
          />
        </div>

        {/* Toggle Advanced Options */}
        <button
          onClick={() => setShowOptions(!showOptions)}
          title="Headers & Options"
          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
            showOptions || headers.length > 0 || replyTo
              ? 'bg-[#18212e] border-blue-500/40 text-blue-400'
              : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {headers.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          )}
        </button>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || !subject.trim()}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm disabled:opacity-50 ${
            isRequest
              ? 'bg-purple-600 hover:bg-purple-500'
              : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {isRequest ? (
            <ArrowRightLeft className={`w-3.5 h-3.5 ${sending ? 'animate-spin' : ''}`} />
          ) : (
            <Send className={`w-3.5 h-3.5 ${sending ? 'animate-bounce' : ''}`} />
          )}
          <span>{sending ? 'Sending...' : isRequest ? 'Send Request' : 'Publish'}</span>
        </button>
      </div>

      {/* Advanced Options Bar (Headers, Reply-To, Timeout) */}
      {showOptions && (
        <div className="p-3 mb-2 rounded-lg bg-[#0e141d] border border-[#202938] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {!isRequest ? (
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">Reply-To Subject (Optional)</label>
                <input
                  type="text"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="_INBOX.custom.reply"
                  className="w-full bg-[#131923] border border-[#232c3d] rounded px-2.5 py-1 text-xs font-mono text-gray-200 focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-purple-400" /> Timeout (ms)
                </label>
                <input
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  min={500}
                  step={500}
                  className="w-full bg-[#131923] border border-[#232c3d] rounded px-2.5 py-1 text-xs font-mono text-gray-200 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Headers Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-400">Message Headers</span>
              <button
                type="button"
                onClick={addHeader}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Header
              </button>
            </div>

            {headers.length === 0 ? (
              <div className="text-[11px] text-gray-600 italic">No headers attached</div>
            ) : (
              <div className="space-y-1.5">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={h.key}
                      onChange={(e) => updateHeader(i, 'key', e.target.value)}
                      placeholder="Header Name (e.g. Nats-Msg-Id)"
                      className="flex-1 bg-[#131923] border border-[#232c3d] rounded px-2 py-1 text-xs font-mono text-gray-200 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={h.val}
                      onChange={(e) => updateHeader(i, 'val', e.target.value)}
                      placeholder="Header Value"
                      className="flex-1 bg-[#131923] border border-[#232c3d] rounded px-2 py-1 text-xs font-mono text-gray-200 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(i)}
                      className="p-1 text-gray-500 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payload Editor */}
      <div className="relative">
        <textarea
          rows={3}
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={`Payload content (JSON or text)...\nExample:\n{\n  "message": "hello nats",\n  "timestamp": 1234567\n}`}
          className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg p-2.5 text-xs font-mono text-gray-200 focus:outline-none resize-y"
        />
      </div>

      {/* Status Feedback Banner */}
      {statusMsg && (
        <div
          className={`mt-2 p-2 rounded text-xs flex items-center gap-1.5 ${
            statusMsg.ok
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
};
