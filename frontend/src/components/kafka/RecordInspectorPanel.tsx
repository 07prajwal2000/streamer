import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Code2,
  FileText,
  Binary,
  Layers,
  Clock,
  HardDrive,
  Hash,
  Tag,
  WrapText,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { kafkamanager } from '../../../wailsjs/go/models';
import { DeleteKafkaRecordsUpTo, ProduceKafkaRecord } from '../../../wailsjs/go/main/App';

interface RecordInspectorPanelProps {
  record: kafkamanager.KafkaRecord | null;
  onClose?: () => void;
  onRecordDeleted?: () => void;
}

function generateHexDump(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const hexParts: string[] = [];
    let asciiPart = '';
    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        const b = chunk[j];
        hexParts.push(b.toString(16).padStart(2, '0'));
        asciiPart += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
      } else {
        hexParts.push('  ');
      }
    }
    const offsetStr = i.toString(16).padStart(8, '0');
    const firstHalf = hexParts.slice(0, 8).join(' ');
    const secondHalf = hexParts.slice(8, 16).join(' ');
    lines.push(`${offsetStr}:  ${firstHalf}  ${secondHalf}  |${asciiPart}|`);
  }
  return lines.join('\n');
}

export const RecordInspectorPanel: React.FC<RecordInspectorPanelProps> = ({
  record,
  onClose,
  onRecordDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'json' | 'text' | 'hex'>('json');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [wrapText, setWrapText] = useState(true);

  // Deletion and Tombstone states
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPurgeOffsetModal, setShowPurgeOffsetModal] = useState(false);
  const [showTombstoneModal, setShowTombstoneModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handlePurgeUpToOffset = async () => {
    if (!record) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      // Kafka DeleteRecords deletes records with offset < At.
      // So to delete up to and including record.offset, pass record.offset + 1.
      await DeleteKafkaRecordsUpTo(record.topic, record.partition, record.offset + 1);
      setShowPurgeOffsetModal(false);
      setActionSuccess(`Purged records in partition #${record.partition} up to offset ${record.offset}`);
      setTimeout(() => setActionSuccess(null), 3500);
      onRecordDeleted?.();
    } catch (err: any) {
      setActionError(String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendTombstone = async () => {
    if (!record || !record.key) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await ProduceKafkaRecord({
        topic: record.topic,
        partition: record.partition,
        key: record.key,
        payload: '',
        headers: {},
        isTombstone: true,
      } as any);
      setShowTombstoneModal(false);
      setActionSuccess(`Published tombstone for key "${record.key}"`);
      setTimeout(() => setActionSuccess(null), 3500);
      onRecordDeleted?.();
    } catch (err: any) {
      setActionError(String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedJson = useMemo(() => {
    if (!record?.payload) return null;
    try {
      const parsed = JSON.parse(record.payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return null;
    }
  }, [record?.payload]);

  const hexDump = useMemo(() => {
    if (!record?.payload) return '';
    return generateHexDump(record.payload);
  }, [record?.payload]);

  const payloadSize = useMemo(() => {
    if (!record?.payload) return '0 B';
    const bytes = new TextEncoder().encode(record.payload).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }, [record?.payload]);

  if (!record) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-[#090d13] border-l border-[#1e2530]">
        <Layers className="w-8 h-8 mx-auto text-gray-600 mb-2 opacity-40" />
        <p className="text-xs font-medium text-gray-400">No Record Selected</p>
        <p className="text-[11px] text-gray-500 mt-1">
          Select a message row from the table to inspect payload, headers, and metadata.
        </p>
      </div>
    );
  }

  const handleCopy = (text: string, isKey: boolean) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  const headersList = record.headers ? Object.entries(record.headers) : [];

  return (
    <div className="h-full flex flex-col bg-[#090d13] border-l border-[#1e2530] select-none min-w-0">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">Record Inspector</h3>
            <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1.5 mt-0.5">
              <span>{record.topic}</span>
              <span>&bull;</span>
              <span>P:{record.partition}</span>
              <span>&bull;</span>
              <span>Offset:{record.offset}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopy(record.payload, false)}
            title="Copy Payload"
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-[#161f2d] border border-[#233147] transition-colors"
          >
            {copiedPayload ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Banners */}
      {actionError && (
        <div className="p-2.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-400 flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Delete / Message Management Actions */}
      <div className="px-4 py-2 bg-[#0a0f16] border-b border-[#1e2530] flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase font-mono text-gray-400">Actions:</span>
        <div className="flex items-center gap-2">
          {record.key && (
            <button
              onClick={() => setShowTombstoneModal(true)}
              className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-medium transition-colors flex items-center gap-1"
              title="Publish a tombstone record (null value) to delete this key in log-compacted topics"
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span>Tombstone Key</span>
            </button>
          )}

          <button
            onClick={() => setShowPurgeOffsetModal(true)}
            className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-[10px] font-medium transition-colors flex items-center gap-1"
            title={`Delete records in partition #${record.partition} up to offset ${record.offset}`}
          >
            <Trash2 className="w-3 h-3 text-red-400" />
            <span>Purge Up to Here</span>
          </button>
        </div>
      </div>

      {/* Metadata Badges */}
      <div className="px-4 py-2 bg-[#0c1017]/60 border-b border-[#1e2530] flex flex-wrap items-center gap-2 text-[10px] font-mono">
        <span className="px-2 py-0.5 rounded bg-[#161f2d] text-orange-300 border border-[#233147]">
          Partition #{record.partition}
        </span>
        <span className="px-2 py-0.5 rounded bg-[#161f2d] text-blue-300 border border-[#233147]">
          Offset {record.offset}
        </span>
        <span className="px-2 py-0.5 rounded bg-[#161f2d] text-gray-300 border border-[#233147]">
          Size: {payloadSize}
        </span>
        <span className="px-2 py-0.5 rounded bg-[#161f2d] text-gray-400 border border-[#233147] flex items-center gap-1">
          <Clock className="w-3 h-3 text-gray-500" />
          <span>{new Date(record.timestamp).toLocaleString()}</span>
        </span>
      </div>

      {/* Key & Headers Overview */}
      <div className="p-4 space-y-3 border-b border-[#1e2530] bg-[#0c1017]/30">
        {/* Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-400">Message Key</span>
            {record.key && (
              <button
                onClick={() => handleCopy(record.key || '', true)}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
              >
                {copiedKey ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy Key</span>
              </button>
            )}
          </div>
          <div className="px-2.5 py-1.5 bg-[#070b10] border border-[#1e2530] rounded-lg text-xs font-mono break-all text-white">
            {record.key ? record.key : <span className="text-gray-500 italic">null (no key)</span>}
          </div>
        </div>

        {/* Headers */}
        {headersList.length > 0 && (
          <div>
            <span className="text-[11px] font-medium text-gray-400 block mb-1">
              Headers ({headersList.length})
            </span>
            <div className="border border-[#1e2530] rounded-lg overflow-hidden bg-[#070b10]">
              <table className="w-full text-left text-[11px] font-mono">
                <tbody>
                  {headersList.map(([k, v]) => (
                    <tr key={k} className="border-b border-[#171e2a] last:border-b-0">
                      <td className="px-2.5 py-1 text-orange-400 font-medium whitespace-nowrap">{k}</td>
                      <td className="px-2.5 py-1 text-gray-300 break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payload View Toolbar */}
      <div className="px-4 py-2 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#090d13] p-0.5 border border-[#1e2530] rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('json')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'json'
                ? 'bg-orange-500/20 text-orange-300 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>JSON</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'text'
                ? 'bg-orange-500/20 text-orange-300 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Plain Text</span>
          </button>
          <button
            onClick={() => setActiveTab('hex')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'hex'
                ? 'bg-orange-500/20 text-orange-300 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Binary className="w-3 h-3" />
            <span>Hex Dump</span>
          </button>
        </div>

        {activeTab === 'text' && (
          <button
            onClick={() => setWrapText(!wrapText)}
            className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
              wrapText
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                : 'bg-[#161f2d] border-[#233147] text-gray-400 hover:text-gray-200'
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3 h-3" />
            <span className="text-[10px]">Wrap</span>
          </button>
        )}
      </div>

      {/* Payload Display Area */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-[#070b10]">
        {activeTab === 'json' && (
          formattedJson ? (
            <pre className="text-green-300 leading-relaxed overflow-x-auto whitespace-pre">
              {formattedJson}
            </pre>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] text-amber-400/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 font-sans">
                Payload is not formatted JSON. Showing raw text representation below:
              </div>
              <pre className="text-gray-300 whitespace-pre-wrap break-all leading-relaxed">
                {record.payload}
              </pre>
            </div>
          )
        )}

        {activeTab === 'text' && (
          <pre
            className={`text-gray-200 leading-relaxed ${
              wrapText ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
            }`}
          >
            {record.payload}
          </pre>
        )}

        {activeTab === 'hex' && (
          <pre className="text-gray-400 leading-relaxed overflow-x-auto whitespace-pre text-[11px]">
            {hexDump}
          </pre>
        )}
      </div>

      {/* Purge Partition Up To Offset Confirmation Modal */}
      {showPurgeOffsetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0d121a] border border-[#222d3d] rounded-2xl shadow-2xl p-6 select-none animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Purge Partition Records</h3>
                <p className="text-xs text-gray-400">Delete records up to offset {record.offset}</p>
              </div>
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 space-y-2 mb-5">
              <p className="font-semibold text-red-200">
                Delete all messages in{' '}
                <span className="font-mono text-white bg-red-950/60 px-1.5 py-0.5 rounded">
                  {record.topic}
                </span>{' '}
                Partition <span className="font-mono text-white">#{record.partition}</span> up to offset{' '}
                <span className="font-mono text-white">{record.offset}</span>?
              </p>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                This executes Kafka log truncation (advancing partition low watermark to offset {record.offset + 1}). All records with offset &le; {record.offset} will be permanently removed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPurgeOffsetModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-[#161f2d] hover:bg-[#202c3f] text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeUpToOffset}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-red-950/40 transition-all flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Up to #{record.offset}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Tombstone Confirmation Modal */}
      {showTombstoneModal && record.key && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0d121a] border border-[#222d3d] rounded-2xl shadow-2xl p-6 select-none animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Publish Tombstone Record</h3>
                <p className="text-xs text-gray-400">Delete key via log compaction</p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-2 mb-5">
              <p className="font-semibold text-amber-200">
                Publish a null-value tombstone for key:{' '}
                <span className="font-mono text-white bg-amber-950/60 px-1.5 py-0.5 rounded">
                  {record.key}
                </span>{' '}
                in topic <span className="font-mono text-white">{record.topic}</span>?
              </p>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                In log-compacted Kafka topics, producing a record with a key and a null payload marks the key as deleted. The log cleaner removes all previous occurrences of this key.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowTombstoneModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-[#161f2d] hover:bg-[#202c3f] text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTombstone}
                disabled={isDeleting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-950/40 transition-all flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing Tombstone...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5" />
                    <span>Send Tombstone</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

