import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Layers,
  Sliders,
  Trash2,
  Eraser,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Shield,
  FileCode,
  Tag,
  AlertOctagon,
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle2,
  Mail,
  Send,
} from 'lucide-react';
import { sqsmanager } from '../../../wailsjs/go/models';
import {
  GetSQSQueueDetails,
  DeleteSQSQueue,
  PurgeSQSQueue,
  UpdateSQSQueueAttributes,
  UpdateSQSQueueTags,
} from '../../../wailsjs/go/main/App';

interface QueueDetailDrawerProps {
  isOpen: boolean;
  queueUrl: string | null;
  onClose: () => void;
  onQueueDeleted: () => void;
  onQueueUpdated: () => void;
  onNavigateToMessages?: (queueUrl: string) => void;
}

export const QueueDetailDrawer: React.FC<QueueDetailDrawerProps> = ({
  isOpen,
  queueUrl,
  onClose,
  onQueueDeleted,
  onQueueUpdated,
  onNavigateToMessages,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'dlq' | 'policy' | 'tags' | 'danger'>('overview');
  const [details, setDetails] = useState<sqsmanager.SQSQueueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Copy states
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedArn, setCopiedArn] = useState(false);
  const [copiedPolicy, setCopiedPolicy] = useState(false);

  // Settings Edit form state
  const [editVisibility, setEditVisibility] = useState(30);
  const [editRetention, setEditRetention] = useState(345600);
  const [editDelay, setEditDelay] = useState(0);
  const [editMaxSizeKB, setEditMaxSizeKB] = useState(256);
  const [editWaitTime, setEditWaitTime] = useState(0);
  const [editDedup, setEditDedup] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Tags
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  // Danger Zone actions
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadDetails = async () => {
    if (!queueUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await GetSQSQueueDetails(queueUrl);
      setDetails(data);
      if (data) {
        setEditVisibility(data.visibilityTimeoutSeconds || 30);
        setEditRetention(data.messageRetentionSeconds || 345600);
        setEditDelay(data.delaySeconds || 0);
        setEditMaxSizeKB(data.maximumMessageSize ? Math.round(data.maximumMessageSize / 1024) : 256);
        setEditWaitTime(data.receiveMessageWaitTimeSeconds || 0);
        setEditDedup(data.contentBasedDeduplication || false);
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && queueUrl) {
      loadDetails();
      setActiveTab('overview');
      setSettingsSuccess(null);
      setSettingsError(null);
      setPurgeError(null);
      setPurgeSuccess(null);
      setDeleteError(null);
      setShowPurgeConfirm(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, queueUrl]);

  if (!isOpen || !queueUrl) return null;

  const handleCopy = (text: string, type: 'url' | 'arn' | 'policy') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === 'arn') {
      setCopiedArn(true);
      setTimeout(() => setCopiedArn(false), 2000);
    } else {
      setCopiedPolicy(true);
      setTimeout(() => setCopiedPolicy(false), 2000);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueUrl) return;

    setSavingSettings(true);
    setSettingsSuccess(null);
    setSettingsError(null);

    try {
      const attrs: Record<string, string> = {
        VisibilityTimeout: String(editVisibility),
        MessageRetentionPeriod: String(editRetention),
        DelaySeconds: String(editDelay),
        MaximumMessageSize: String(editMaxSizeKB * 1024),
        ReceiveMessageWaitTimeSeconds: String(editWaitTime),
      };

      if (details?.isFifo) {
        attrs['ContentBasedDeduplication'] = editDedup ? 'true' : 'false';
      }

      await UpdateSQSQueueAttributes(queueUrl, attrs);
      setSettingsSuccess('Queue attributes successfully updated.');
      onQueueUpdated();
      await loadDetails();
    } catch (err: any) {
      setSettingsError(String(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueUrl || !newTagKey.trim()) return;

    setTagSaving(true);
    setTagError(null);
    try {
      await UpdateSQSQueueTags(queueUrl, { [newTagKey.trim()]: newTagValue.trim() }, []);
      setNewTagKey('');
      setNewTagValue('');
      await loadDetails();
      onQueueUpdated();
    } catch (err: any) {
      setTagError(String(err));
    } finally {
      setTagSaving(false);
    }
  };

  const handleRemoveTag = async (key: string) => {
    if (!queueUrl) return;
    setTagSaving(true);
    setTagError(null);
    try {
      await UpdateSQSQueueTags(queueUrl, {}, [key]);
      await loadDetails();
      onQueueUpdated();
    } catch (err: any) {
      setTagError(String(err));
    } finally {
      setTagSaving(false);
    }
  };

  const handlePurgeQueue = async () => {
    if (!queueUrl) return;
    setPurgeLoading(true);
    setPurgeError(null);
    setPurgeSuccess(null);

    try {
      await PurgeSQSQueue(queueUrl);
      setPurgeSuccess('Queue purged successfully. Message counts may take up to 60s to reflect on AWS.');
      setShowPurgeConfirm(false);
      onQueueUpdated();
      await loadDetails();
    } catch (err: any) {
      setPurgeError(String(err));
    } finally {
      setPurgeLoading(false);
    }
  };

  const handleDeleteQueue = async () => {
    if (!queueUrl) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await DeleteSQSQueue(queueUrl);
      onQueueDeleted();
      onClose();
    } catch (err: any) {
      setDeleteError(String(err));
      setDeleteLoading(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts || ts === 0) return 'N/A';
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex justify-end select-none animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#090d13] border-l border-[#1e2530] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#1e2530] bg-[#0c1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white font-mono">
                  {details?.queueName || 'Loading Queue...'}
                </h2>
                {details?.isFifo && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 font-mono font-medium">
                    FIFO
                  </span>
                )}
                {details?.isDeadLetterQueue && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 font-medium">
                    DLQ
                  </span>
                )}
                {details?.serverSideEncryption && details.serverSideEncryption !== 'None' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-medium">
                    {details.serverSideEncryption}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Amazon SQS Queue Details & Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDetails}
              disabled={loading}
              title="Refresh Queue Details"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title="Close Drawer"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#151b23] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1e2530] bg-[#0a0e14] px-6">
          {[
            { id: 'overview', label: 'Overview & Metrics', icon: Layers },
            { id: 'settings', label: 'Settings', icon: Sliders },
            { id: 'dlq', label: 'Dead-Letter Queue', icon: ArrowRight },
            { id: 'policy', label: 'IAM Policy', icon: FileCode },
            { id: 'tags', label: `Tags (${Object.keys(details?.tags || {}).length})`, icon: Tag },
            { id: 'danger', label: 'Danger Zone', icon: AlertOctagon, danger: true },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? tab.danger
                      ? 'border-red-500 text-red-400 bg-red-500/5'
                      : 'border-orange-500 text-orange-400 bg-orange-500/5'
                    : tab.danger
                    ? 'border-transparent text-gray-400 hover:text-red-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Failed to load queue details</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & METRICS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Message Counts Ribbon */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                  <span className="text-[11px] font-medium text-orange-400 uppercase tracking-wider block mb-1">
                    Available Messages
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">
                    {details?.approximateNumberOfMessages?.toLocaleString() ?? 0}
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 block">Ready for consumers</span>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block mb-1">
                    In-Flight (Not Visible)
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">
                    {details?.approximateNumberOfNotVisible?.toLocaleString() ?? 0}
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 block">Being processed by workers</span>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block mb-1">
                    Delayed Messages
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">
                    {details?.approximateNumberOfDelayed?.toLocaleString() ?? 0}
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 block">Awaiting delivery timer</span>
                </div>
              </div>

              {/* View Messages Action */}
              {onNavigateToMessages && (
                <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Inspect or Produce Messages</h4>
                      <p className="text-[11px] text-gray-500">Live tail, peek messages without deleting, or send test payloads</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToMessages(queueUrl)}
                    className="px-3.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    Open Messages
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Configuration Summary Card */}
              <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3 text-xs">
                <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  Delivery & Timing Settings
                </h3>

                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Visibility Timeout</span>
                    <span className="text-white font-mono font-medium">
                      {details?.visibilityTimeoutSeconds ?? 30} seconds
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Delivery Delay</span>
                    <span className="text-white font-mono font-medium">
                      {details?.delaySeconds ?? 0} seconds
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Message Retention</span>
                    <span className="text-white font-mono font-medium">
                      {details?.messageRetentionSeconds
                        ? `${Math.round(details.messageRetentionSeconds / 86400)} days (${details.messageRetentionSeconds.toLocaleString()}s)`
                        : '4 days'}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Maximum Message Size</span>
                    <span className="text-white font-mono font-medium">
                      {details?.maximumMessageSize
                        ? `${Math.round(details.maximumMessageSize / 1024)} KB`
                        : '256 KB'}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Receive Wait Time (Long Polling)</span>
                    <span className="text-white font-mono font-medium">
                      {details?.receiveMessageWaitTimeSeconds ?? 0}s{' '}
                      {(details?.receiveMessageWaitTimeSeconds ?? 0) > 0 ? '(Active)' : '(Short Polling)'}
                    </span>
                  </div>

                  {details?.isFifo && (
                    <>
                      <div>
                        <span className="text-gray-500 block text-[11px]">Content-Based Deduplication</span>
                        <span className="text-white font-medium">
                          {details.contentBasedDeduplication ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[11px]">Deduplication Scope</span>
                        <span className="text-white font-medium font-mono text-[11px]">
                          {details.deduplicationScope || 'messageGroup'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[11px]">FIFO Throughput Limit</span>
                        <span className="text-white font-medium font-mono text-[11px]">
                          {details.fifoThroughputLimit || 'perMessageGroupId'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Identifiers & URIs */}
              <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3 text-xs">
                <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
                  Identifiers & Endpoints
                </h3>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500 text-[11px]">Queue URL</span>
                    <button
                      onClick={() => handleCopy(queueUrl, 'url')}
                      className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copiedUrl ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-2 bg-[#090d13] border border-[#1e2530] rounded-lg font-mono text-[11px] text-gray-300 break-all select-all">
                    {queueUrl}
                  </div>
                </div>

                {details?.queueArn && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-[11px]">Queue ARN</span>
                      <button
                        onClick={() => handleCopy(details.queueArn, 'arn')}
                        className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px]"
                      >
                        {copiedArn ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        {copiedArn ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-2 bg-[#090d13] border border-[#1e2530] rounded-lg font-mono text-[11px] text-gray-300 break-all select-all">
                      {details.queueArn}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Created At</span>
                    <span className="text-gray-300 font-mono text-[11px]">
                      {formatTimestamp(details?.createdTimestamp || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Last Modified</span>
                    <span className="text-gray-300 font-mono text-[11px]">
                      {formatTimestamp(details?.lastModifiedTimestamp || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETTINGS (ATTRIBUTES) */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
              {settingsSuccess && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{settingsSuccess}</span>
                </div>
              )}
              {settingsError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-4">
                <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
                  Configurable Attributes
                </h3>

                <div>
                  <label className="block text-gray-400 mb-1">
                    Visibility Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={43200}
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Range: 0 to 43,200 seconds (12 hours)</p>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">
                    Message Retention Period (seconds)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={1209600}
                    value={editRetention}
                    onChange={(e) => setEditRetention(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Range: 60 to 1,209,600 seconds (14 days). Current: {Math.round(editRetention / 86400)} days.
                  </p>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">
                    Delivery Delay (seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={900}
                    value={editDelay}
                    onChange={(e) => setEditDelay(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Range: 0 to 900 seconds (15 minutes)</p>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">
                    Maximum Message Size (KB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={256}
                    value={editMaxSizeKB}
                    onChange={(e) => setEditMaxSizeKB(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Range: 1 to 256 KB</p>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">
                    Receive Message Wait Time (seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={editWaitTime}
                    onChange={(e) => setEditWaitTime(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#090d13] border border-[#1e2530] rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-orange-500/50"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Range: 0 to 20 seconds. 0 = Short polling, &gt; 0 = Long polling.</p>
                </div>

                {details?.isFifo && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDedup}
                      onChange={(e) => setEditDedup(e.target.checked)}
                      className="rounded text-orange-500 focus:ring-0 bg-[#090d13] border-gray-700"
                    />
                    <span className="text-gray-300 text-xs">Content-Based Deduplication</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs shadow-lg shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {savingSettings && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Attribute Changes
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: DEAD-LETTER QUEUE (DLQ) */}
          {activeTab === 'dlq' && (
            <div className="space-y-6 text-xs">
              {/* Redrive Policy (This queue sending to DLQ) */}
              <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
                    Dead-Letter Target Configuration
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      details?.hasRedrivePolicy
                        ? 'bg-green-500/15 border-green-500/30 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {details?.hasRedrivePolicy ? 'Active DLQ Redrive' : 'Disabled'}
                  </span>
                </div>

                {details?.hasRedrivePolicy ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <span className="text-gray-500 block text-[11px]">Target DLQ ARN</span>
                      <div className="p-2 bg-[#090d13] border border-[#1e2530] rounded-lg font-mono text-[11px] text-orange-400 break-all select-all">
                        {details.deadLetterTargetArn}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Maximum Receive Count</span>
                      <span className="text-white font-mono font-medium">
                        {details.maxReceiveCount} attempts before moving to DLQ
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs">
                    This queue does not currently route undeliverable messages to a Dead-Letter Queue. You can configure DLQ when creating queues.
                  </p>
                )}
              </div>

              {/* Dead-Letter Source Queues (Queues sending into this queue) */}
              <div className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
                    Source Queues using this DLQ
                  </h3>
                  <span className="text-[10px] text-gray-400">
                    {details?.deadLetterSourceQueues?.length ?? 0} Source Queues
                  </span>
                </div>

                {details?.deadLetterSourceQueues && details.deadLetterSourceQueues.length > 0 ? (
                  <div className="space-y-2">
                    {details.deadLetterSourceQueues.map((srcUrl, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-[#090d13] border border-[#1e2530] rounded-lg flex items-center justify-between font-mono text-[11px] text-gray-300"
                      >
                        <span className="truncate mr-2">{srcUrl}</span>
                        <button
                          onClick={() => handleCopy(srcUrl, 'url')}
                          className="p-1 text-gray-500 hover:text-white"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs">
                    No source queues are currently configured to route messages to this queue.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: IAM POLICY */}
          {activeTab === 'policy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Queue Access Policy (JSON)</span>
                {details?.policy && (
                  <button
                    onClick={() => handleCopy(details.policy || '', 'policy')}
                    className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-xs"
                  >
                    {copiedPolicy ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedPolicy ? 'Copied' : 'Copy JSON'}
                  </button>
                )}
              </div>

              {details?.policy ? (
                <div className="p-4 bg-[#090d13] border border-[#1e2530] rounded-xl overflow-x-auto max-h-[500px]">
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(details.policy), null, 2);
                      } catch {
                        return details.policy;
                      }
                    })()}
                  </pre>
                </div>
              ) : (
                <div className="p-8 bg-[#0c1017] border border-[#1e2530] rounded-xl text-center text-gray-500 text-xs">
                  No IAM resource policy attached to this queue.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RESOURCE TAGS */}
          {activeTab === 'tags' && (
            <div className="space-y-5 text-xs">
              {tagError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{tagError}</span>
                </div>
              )}

              {/* Add Tag Form */}
              <form onSubmit={handleAddTag} className="p-4 bg-[#0c1017] border border-[#1e2530] rounded-xl space-y-3">
                <span className="font-semibold text-gray-300 uppercase tracking-wider text-[11px] block">
                  Add Queue Tag
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagKey}
                    onChange={(e) => setNewTagKey(e.target.value)}
                    placeholder="Key (e.g. Project)"
                    className="flex-1 px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-lg text-white text-xs"
                  />
                  <input
                    type="text"
                    value={newTagValue}
                    onChange={(e) => setNewTagValue(e.target.value)}
                    placeholder="Value (e.g. Analytics)"
                    className="flex-1 px-3 py-1.5 bg-[#090d13] border border-[#1e2530] rounded-lg text-white text-xs"
                  />
                  <button
                    type="submit"
                    disabled={tagSaving || !newTagKey.trim()}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Tags Table */}
              <div className="border border-[#1e2530] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0c1017] text-gray-400 border-b border-[#1e2530]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Tag Key</th>
                      <th className="py-2.5 px-4 font-medium">Tag Value</th>
                      <th className="py-2.5 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2530] font-mono">
                    {details?.tags && Object.keys(details.tags).length > 0 ? (
                      Object.entries(details.tags).map(([k, v]) => (
                        <tr key={k} className="hover:bg-[#121822] transition-colors">
                          <td className="py-2.5 px-4 text-orange-300 font-semibold">{k}</td>
                          <td className="py-2.5 px-4 text-gray-300">{v}</td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(k)}
                              className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                              title="Delete tag"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-gray-500 font-sans">
                          No tags attached to this queue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-6 text-xs">
              {purgeSuccess && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{purgeSuccess}</span>
                </div>
              )}

              {purgeError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">{purgeError}</div>
                </div>
              )}

              {deleteError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">{deleteError}</div>
                </div>
              )}

              {/* Purge Queue */}
              <div className="p-5 bg-amber-500/[0.03] border border-amber-500/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                  <Eraser className="w-4 h-4" />
                  <span>Purge Queue Messages</span>
                </div>
                <p className="text-gray-400 leading-relaxed text-xs">
                  Purging permanently deletes all available, in-flight, and delayed messages from this queue. SQS enforces a strict <strong>60-second cooldown rate limit</strong> between purge requests on the same queue.
                </p>

                {!showPurgeConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowPurgeConfirm(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 font-medium transition-colors"
                  >
                    Purge All Messages...
                  </button>
                ) : (
                  <div className="p-4 bg-[#090d13] border border-amber-500/30 rounded-xl space-y-3">
                    <p className="text-amber-300 font-medium text-xs">
                      Are you sure you want to purge all messages in <code className="font-mono">{details?.queueName}</code>?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handlePurgeQueue}
                        disabled={purgeLoading}
                        className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {purgeLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                        Confirm Purge
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPurgeConfirm(false)}
                        className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Queue */}
              <div className="p-5 bg-red-500/[0.03] border border-red-500/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-semibold">
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Queue</span>
                </div>
                <p className="text-gray-400 leading-relaxed text-xs">
                  Deleting a queue removes the queue and all its messages permanently. Once deleted, it may take up to 60 seconds before a queue with the same name can be created again.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 font-medium transition-colors"
                  >
                    Delete Queue...
                  </button>
                ) : (
                  <div className="p-4 bg-[#090d13] border border-red-500/30 rounded-xl space-y-3">
                    <p className="text-red-300 text-xs">
                      To confirm deletion, type the queue name <code className="font-mono font-bold">{details?.queueName}</code> below:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={details?.queueName}
                      className="w-full px-3 py-1.5 bg-[#0c1017] border border-[#1e2530] rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-red-500/50"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleDeleteQueue}
                        disabled={deleteLoading || deleteConfirmText !== details?.queueName}
                        className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40"
                      >
                        {deleteLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                        Permanently Delete Queue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
