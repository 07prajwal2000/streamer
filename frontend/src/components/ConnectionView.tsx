import React, { useState, useEffect } from 'react';
import { 
  Play, 
  PowerOff, 
  Trash2, 
  Save, 
  Zap, 
  FolderOpen, 
  Check, 
  AlertTriangle, 
  Activity, 
  ShieldCheck, 
  Server,
  Layers,
  Crown,
  Cpu,
  Radio,
  Clock,
  Inbox
} from 'lucide-react';
import { storage, natsmanager } from '../../wailsjs/go/models';
import { SelectFile } from '../../wailsjs/go/main/App';

interface ConnectionViewProps {
  profile: storage.ConnectionProfile;
  activeStatus: natsmanager.ServerStatus;
  isActive: boolean;
  onSave: (p: storage.ConnectionProfile) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onConnect: (p: storage.ConnectionProfile) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onTest: (p: storage.ConnectionProfile) => Promise<natsmanager.ServerStatus>;
}

export const ConnectionView: React.FC<ConnectionViewProps> = ({
  profile,
  activeStatus,
  isActive,
  onSave,
  onDelete,
  onConnect,
  onDisconnect,
  onTest,
}) => {
  const [form, setForm] = useState<storage.ConnectionProfile>(profile);
  const [activeTab, setActiveTab] = useState<'general' | 'auth' | 'tls'>('general');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setForm(profile);
    setTestResult(null);
  }, [profile.id]);

  const updateField = (field: keyof storage.ConnectionProfile, val: any) => {
    setForm((prev) =>
      storage.ConnectionProfile.createFrom({
        ...prev,
        [field]: val,
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTest(form);
      setTestResult({
        ok: true,
        msg: `Connected to ${res.serverVersion || (isSQS ? 'SQS (' + (form.awsRegion || 'us-east-1') + ')' : 'NATS')} (RTT: ${res.rttMs.toFixed(1)}ms)`,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const pickFile = async (field: keyof storage.ConnectionProfile, title: string, filterName: string, pattern: string) => {
    try {
      const selected = await SelectFile(title, filterName, pattern);
      if (selected) {
        updateField(field, selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isKafka = form.protocol === 'kafka';
  const isSQS = form.protocol === 'sqs';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-y-auto">
      {/* Top Action Bar */}
      <div className="h-14 px-6 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span>{form.name || 'New Connection Profile'}</span>
            {isKafka ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                <Layers className="w-3 h-3 text-orange-400" />
                Kafka / Redpanda
              </span>
            ) : isSQS ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Inbox className="w-3 h-3 text-amber-400" />
                Amazon SQS / LocalStack
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                <Zap className="w-3 h-3 text-cyan-400" />
                NATS
              </span>
            )}
          </h1>
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active Session
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {form.id && (
            <button
              onClick={() => onDelete(form.id)}
              title="Delete Profile"
              className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleTest}
            disabled={testing || (!isSQS && !form.url)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] transition-all disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${testing ? 'animate-bounce' : ''}`} />
            <span>{testing ? 'Testing...' : 'Test Ping'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !form.name || (!isSQS && !form.url)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saved' : 'Save'}</span>
          </button>

          {isActive ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-all shadow-sm"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={() => onConnect(form)}
              disabled={!isSQS && !form.url}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/30 transition-all shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Test Result Banner */}
        {testResult && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
              testResult.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {testResult.ok ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{testResult.msg}</span>
          </div>
        )}

        {/* Live Server Telemetry Card if Connected */}
        {isActive && activeStatus.connected && (
          <div className="grid grid-cols-4 gap-3 p-4 rounded-xl bg-[#111722] border border-[#1e2736]">
            {isKafka ? (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3 text-orange-400" /> Cluster ID
                  </span>
                  <div className="text-xs font-mono font-medium text-gray-200 truncate" title={activeStatus.clusterId || 'Standard Cluster'}>
                    {activeStatus.clusterId || 'Standard Cluster'}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" /> RTT Latency
                  </span>
                  <div className="text-xs font-mono font-medium text-emerald-400">
                    {activeStatus.rttMs.toFixed(2)} ms
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" /> Controller
                  </span>
                  <div className="text-xs font-mono font-medium text-amber-300">
                    Node #{activeStatus.controllerId}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-blue-400" /> Nodes
                  </span>
                  <div className="text-xs font-mono text-gray-300">
                    {activeStatus.brokersCount || 1} Brokers / {activeStatus.topicsCount || 0} Topics
                  </div>
                </div>
              </>
            ) : isSQS ? (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Server className="w-3 h-3 text-amber-400" /> Endpoint
                  </span>
                  <div className="text-xs font-mono font-medium text-gray-200 truncate" title={activeStatus.clusterId || (form.url ? form.url : 'AWS Cloud')}>
                    {activeStatus.clusterId || (form.url ? form.url : 'AWS Cloud')}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3 text-amber-400" /> Region
                  </span>
                  <div className="text-xs font-mono font-medium text-amber-400">
                    {activeStatus.serverVersion || form.awsRegion || 'us-east-1'}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" /> RTT Latency
                  </span>
                  <div className="text-xs font-mono font-medium text-emerald-400">
                    {activeStatus.rttMs.toFixed(2)} ms
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Inbox className="w-3 h-3 text-blue-400" /> Queues
                  </span>
                  <div className="text-xs font-mono text-gray-300">
                    {activeStatus.topicsCount || 0} Available
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Server className="w-3 h-3 text-blue-400" /> Version
                  </span>
                  <div className="text-xs font-mono font-medium text-gray-200">
                    {activeStatus.serverVersion || 'NATS Server'}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" /> RTT Latency
                  </span>
                  <div className="text-xs font-mono font-medium text-emerald-400">
                    {activeStatus.rttMs.toFixed(2)} ms
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Layers className="w-3 h-3 text-purple-400" /> JetStream
                  </span>
                  <div className="text-xs font-medium">
                    {activeStatus.jetStream ? (
                      <span className="text-purple-400 font-semibold">Enabled</span>
                    ) : (
                      <span className="text-gray-500">Disabled</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-cyan-400" /> Headers
                  </span>
                  <div className="text-xs font-mono text-gray-300">
                    {activeStatus.headersSupported ? 'Supported' : 'No'}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Config Tabs */}
        <div className="border-b border-[#1e2530] flex gap-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            General & Server
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`pb-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'auth'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Authentication ({form.authType})
          </button>
          <button
            onClick={() => setActiveTab('tls')}
            className={`pb-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'tls'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            TLS / Security
          </button>
        </div>

        {/* Tab 1: General */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Protocol Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Streaming Engine / Protocol</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    updateField('protocol', 'nats');
                    if (!form.url || form.url.includes('9092') || form.url.includes('4566')) {
                      updateField('url', 'nats://127.0.0.1:4222');
                    }
                    if (form.authType === 'scram256' || form.authType === 'scram512') {
                      updateField('authType', 'none');
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                    form.protocol === 'nats' || !form.protocol
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-white shadow-sm'
                      : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    form.protocol === 'nats' || !form.protocol ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#1b2330] text-gray-400'
                  }`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-white">NATS Core & JetStream</div>
                    <div className="text-[10px] text-gray-400">High-performance pub/sub, streams & KV</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    updateField('protocol', 'kafka');
                    if (!form.url || form.url.includes('4222') || form.url.includes('4566')) {
                      updateField('url', '127.0.0.1:9092');
                    }
                    if (form.authType === 'token' || form.authType === 'credentials' || form.authType === 'nkey') {
                      updateField('authType', 'none');
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                    isKafka
                      ? 'bg-orange-500/10 border-orange-500/30 text-white shadow-sm'
                      : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isKafka ? 'bg-orange-500/20 text-orange-400' : 'bg-[#1b2330] text-gray-400'
                  }`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-white">Apache Kafka / Redpanda</div>
                    <div className="text-[10px] text-gray-400">Distributed log, partitions & consumer groups</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    updateField('protocol', 'sqs');
                    if (!form.url || form.url.includes('4222') || form.url.includes('9092')) {
                      updateField('url', 'http://localhost:4566');
                    }
                    if (!form.awsRegion) {
                      updateField('awsRegion', 'us-east-1');
                    }
                    if (form.authType !== 'none' && form.authType !== 'static' && form.authType !== 'profile' && form.authType !== 'default_chain') {
                      updateField('authType', 'none');
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                    isSQS
                      ? 'bg-amber-500/10 border-amber-500/30 text-white shadow-sm'
                      : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isSQS ? 'bg-amber-500/20 text-amber-400' : 'bg-[#1b2330] text-gray-400'
                  }`}>
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-white">Amazon SQS / LocalStack</div>
                    <div className="text-[10px] text-gray-400">AWS Cloud, LocalStack, ElasticMQ</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Profile Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder={isKafka ? "e.g. Local Dev Kafka" : isSQS ? "e.g. LocalStack SQS or Prod SQS" : "e.g. Local Dev NATS"}
                  className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">
                  {isKafka ? 'Client ID (client.id)' : isSQS ? 'Profile Label' : 'Client Name'}
                </label>
                <input
                  type="text"
                  value={form.clientName || 'Streamer'}
                  onChange={(e) => updateField('clientName', e.target.value)}
                  placeholder="Streamer"
                  className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            {isSQS ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-300 flex items-center justify-between">
                      <span>AWS Region</span>
                      <span className="text-[10px] text-amber-400/80">Editable (AWS & LocalStack)</span>
                    </label>
                    <input
                      type="text"
                      list="aws-regions-list"
                      value={form.awsRegion || 'us-east-1'}
                      onChange={(e) => updateField('awsRegion', e.target.value)}
                      placeholder="e.g. us-east-1, eu-west-1, us-west-2"
                      className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
                    />
                    <datalist id="aws-regions-list">
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-east-2">US East (Ohio)</option>
                      <option value="us-west-1">US West (N. California)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="eu-west-1">EU (Ireland)</option>
                      <option value="eu-central-1">EU (Frankfurt)</option>
                      <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                      <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                      <option value="sa-east-1">South America (São Paulo)</option>
                    </datalist>
                    <p className="text-[11px] text-gray-500">
                      Standard AWS region identifier. Default for LocalStack is us-east-1.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-300">
                      Endpoint Preset Quick Fill
                    </label>
                    <div className="flex gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => updateField('url', 'http://localhost:4566')}
                        className="px-2.5 py-1.5 text-[11px] font-medium bg-[#131923] hover:bg-[#1a2332] text-amber-300 border border-[#232c3d] hover:border-amber-500/30 rounded-lg transition-colors"
                      >
                        LocalStack (4566)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('url', 'http://localhost:9324')}
                        className="px-2.5 py-1.5 text-[11px] font-medium bg-[#131923] hover:bg-[#1a2332] text-amber-300 border border-[#232c3d] hover:border-amber-500/30 rounded-lg transition-colors"
                      >
                        ElasticMQ (9324)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('url', '')}
                        className="px-2.5 py-1.5 text-[11px] font-medium bg-[#131923] hover:bg-[#1a2332] text-cyan-300 border border-[#232c3d] hover:border-cyan-500/30 rounded-lg transition-colors"
                      >
                        AWS Cloud (Clear)
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 pt-1">
                      Quickly set local endpoints or clear to target official AWS SQS.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">
                    Custom SQS Endpoint URL <span className="text-gray-500 font-normal">(Leave empty for AWS Cloud)</span>
                  </label>
                  <input
                    type="text"
                    value={form.url || ''}
                    onChange={(e) => updateField('url', e.target.value)}
                    placeholder="e.g. http://localhost:4566 (or leave empty to connect to AWS Cloud)"
                    className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-gray-500">
                    Leave blank to connect to official AWS SQS in the selected region, or enter your local/custom endpoint (e.g. http://localhost:4566, http://127.0.0.1:9324).
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">
                  {isKafka ? 'Kafka Bootstrap Broker(s)' : 'NATS Server URL(s)'}
                </label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => updateField('url', e.target.value)}
                  placeholder={isKafka ? "127.0.0.1:9092 or broker1:9092, broker2:9092" : "nats://127.0.0.1:4222 or nats://demo.nats.io:4222"}
                  className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-gray-500">
                  {isKafka
                    ? "Comma-separated broker addresses (e.g. 127.0.0.1:9092, localhost:9093)."
                    : "Comma-separated URLs are supported for cluster failover (e.g. nats://srv1:4222, nats://srv2:4222)."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Authentication */}
        {activeTab === 'auth' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Authentication Method</label>
              <div className={`grid ${isSQS ? 'grid-cols-4' : 'grid-cols-5'} gap-2`}>
                {isKafka ? (
                  [
                    { id: 'none', label: 'PLAINTEXT' },
                    { id: 'userpass', label: 'SASL / PLAIN' },
                    { id: 'scram256', label: 'SCRAM-256' },
                    { id: 'scram512', label: 'SCRAM-512' },
                    { id: 'tls', label: 'mTLS' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateField('authType', item.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        form.authType === item.id
                          ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                          : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))
                ) : isSQS ? (
                  [
                    { id: 'none', label: 'Local / Dummy' },
                    { id: 'static', label: 'Static Keys' },
                    { id: 'profile', label: 'AWS Profile' },
                    { id: 'default_chain', label: 'Default Chain' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateField('authType', item.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        form.authType === item.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))
                ) : (
                  [
                    { id: 'none', label: 'None' },
                    { id: 'userpass', label: 'User / Pass' },
                    { id: 'token', label: 'Token' },
                    { id: 'credentials', label: 'Credentials' },
                    { id: 'nkey', label: 'NKey' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateField('authType', item.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        form.authType === item.id
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-[#131923] border-[#232c3d] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* SQS Auth Forms */}
            {isSQS && (
              <div className="space-y-4">
                {form.authType === 'none' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg bg-[#111722] border border-[#1e2736] text-xs text-gray-400 space-y-1">
                      <p className="font-semibold text-amber-400">Local Testing Credentials (LocalStack / ElasticMQ)</p>
                      <p>
                        AWS SDK requires non-empty credentials and a region even for local endpoints. Streamer automatically defaults to <code className="text-amber-300">test / test</code>. You can customize them below if your local environment expects specific keys.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-300">
                          Dummy Access Key ID
                        </label>
                        <input
                          type="text"
                          value={form.username || ''}
                          onChange={(e) => updateField('username', e.target.value)}
                          placeholder="test"
                          className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-300">
                          Dummy Secret Access Key
                        </label>
                        <input
                          type="password"
                          value={form.password || ''}
                          onChange={(e) => updateField('password', e.target.value)}
                          placeholder="test"
                          className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.authType === 'static' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-300">
                          AWS Access Key ID
                        </label>
                        <input
                          type="text"
                          value={form.username || ''}
                          onChange={(e) => updateField('username', e.target.value)}
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-300">
                          AWS Secret Access Key
                        </label>
                        <input
                          type="password"
                          value={form.password || ''}
                          onChange={(e) => updateField('password', e.target.value)}
                          placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                          className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-300">
                        AWS Session Token <span className="text-gray-500 font-normal">(Optional, for temporary STS / IAM credentials)</span>
                      </label>
                      <input
                        type="password"
                        value={form.token || ''}
                        onChange={(e) => updateField('token', e.target.value)}
                        placeholder="AQoDYXdzEJr1... (Optional STS session token)"
                        className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {form.authType === 'profile' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg bg-[#111722] border border-[#1e2736] text-xs text-gray-400">
                      <p className="font-semibold text-amber-400 mb-1">Shared AWS Credentials File</p>
                      Loads credentials from <code className="text-amber-300">~/.aws/credentials</code> and configuration from <code className="text-amber-300">~/.aws/config</code>.
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-300">
                        AWS Profile Name
                      </label>
                      <input
                        type="text"
                        value={form.awsProfile || ''}
                        onChange={(e) => updateField('awsProfile', e.target.value)}
                        placeholder="default (or production, staging, etc.)"
                        className="w-full bg-[#131923] border border-[#232c3d] focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {form.authType === 'default_chain' && (
                  <div className="p-4 rounded-lg bg-[#111722] border border-[#1e2736] text-xs text-gray-300 space-y-2">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      AWS Default Credential Chain
                    </div>
                    <p className="text-gray-400 leading-relaxed">
                      Streamer will use the official AWS SDK credential provider chain to automatically discover credentials from:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-gray-400 font-mono text-[11px]">
                      <li>Environment variables (<span className="text-amber-300">AWS_ACCESS_KEY_ID</span>, <span className="text-amber-300">AWS_SECRET_ACCESS_KEY</span>)</li>
                      <li>AWS IAM Identity Center (AWS SSO) token cache</li>
                      <li>Amazon ECS container credentials or EKS web identity tokens</li>
                      <li>Amazon EC2 Instance Metadata Service (IMDSv2)</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Non-SQS Auth Forms (NATS & Kafka) */}
            {!isSQS && (
              <>
                {form.authType === 'none' && (
                  <div className="p-4 rounded-lg bg-[#111722] border border-[#1e2736] text-xs text-gray-400">
                    {isKafka
                      ? "PLAINTEXT unauthenticated connection. Standard for local Docker/Kubernetes instances."
                      : "Anonymous access. No credentials or tokens will be provided upon connecting."}
                  </div>
                )}

                {(form.authType === 'userpass' || form.authType === 'scram256' || form.authType === 'scram512') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-300">
                        {isKafka ? 'SASL Username' : 'Username'}
                      </label>
                      <input
                        type="text"
                        value={form.username || ''}
                        onChange={(e) => updateField('username', e.target.value)}
                        placeholder={isKafka ? "e.g. admin or alice" : "Username"}
                        className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-300">
                        {isKafka ? 'SASL Password' : 'Password'}
                      </label>
                      <input
                        type="password"
                        value={form.password || ''}
                        onChange={(e) => updateField('password', e.target.value)}
                        placeholder="Password"
                        className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {form.authType === 'token' && !isKafka && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-300">Authentication Token</label>
                    <input
                      type="password"
                      value={form.token || ''}
                      onChange={(e) => updateField('token', e.target.value)}
                      placeholder="s3cr3t-t0k3n"
                      className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                )}

                {form.authType === 'credentials' && !isKafka && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-300">Credentials File (.creds)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.credsFilePath || ''}
                        onChange={(e) => updateField('credsFilePath', e.target.value)}
                        placeholder="Path to .creds file"
                        className="flex-1 bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                      />
                      <button
                        onClick={() => pickFile('credsFilePath', 'Select NATS Credentials File', 'Credentials (*.creds)', '*.creds')}
                        className="px-3 py-2 bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] rounded-lg text-xs text-gray-300 hover:text-white flex items-center gap-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Browse</span>
                      </button>
                    </div>
                  </div>
                )}

                {form.authType === 'nkey' && !isKafka && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-300">NKey Seed</label>
                    <input
                      type="password"
                      value={form.nkeySeed || ''}
                      onChange={(e) => updateField('nkeySeed', e.target.value)}
                      placeholder="SUA... or Path to seed file"
                      className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                )}

                {form.authType === 'tls' && isKafka && (
                  <div className="p-4 rounded-lg bg-[#111722] border border-[#1e2736] text-xs text-gray-400">
                    Mutual TLS (mTLS) authentication. Configure client certificate and private key in the <span className="text-orange-400 font-semibold cursor-pointer" onClick={() => setActiveTab('tls')}>TLS / Security tab</span>.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 3: TLS */}
        {activeTab === 'tls' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#111722] border border-[#1e2736]">
              <input
                type="checkbox"
                id="tlsInsecure"
                checked={form.tlsInsecure || false}
                onChange={(e) => updateField('tlsInsecure', e.target.checked)}
                className="w-4 h-4 rounded bg-[#131923] border-[#232c3d] text-blue-600 focus:ring-0"
              />
              <label htmlFor="tlsInsecure" className="text-xs text-gray-300 cursor-pointer">
                <span className="font-semibold text-white">Skip Certificate Verification (Insecure)</span>
                <p className="text-[11px] text-gray-500 mt-0.5">Useful for self-signed certificates in local or staging environments.</p>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Custom Root CA Certificate</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.tlsCAFile || ''}
                  onChange={(e) => updateField('tlsCAFile', e.target.value)}
                  placeholder="Path to root CA (.pem, .crt)"
                  className="flex-1 bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
                <button
                  onClick={() => pickFile('tlsCAFile', 'Select Root CA File', 'Certificates (*.pem;*.crt)', '*.pem;*.crt')}
                  className="px-3 py-2 bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] rounded-lg text-xs text-gray-300 hover:text-white flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {isKafka && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">TLS Server Name Indication (SNI)</label>
                <input
                  type="text"
                  value={form.tlsSNI || ''}
                  onChange={(e) => updateField('tlsSNI', e.target.value)}
                  placeholder="e.g. pkc-xxxxx.confluent.cloud"
                  className="w-full bg-[#131923] border border-[#232c3d] focus:border-orange-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-gray-500">
                  Optional SNI hostname override for cloud Kafka providers or SNI routing proxies.
                </p>
              </div>
            )}

            {!isSQS && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">Client Certificate</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.tlsCertFile || ''}
                      onChange={(e) => updateField('tlsCertFile', e.target.value)}
                      placeholder="cert.pem"
                      className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <button
                      onClick={() => pickFile('tlsCertFile', 'Select Client Certificate', 'Certificates (*.pem;*.crt)', '*.pem;*.crt')}
                      className="p-2 bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] rounded-lg text-xs text-gray-300"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">Client Private Key</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.tlsKeyFile || ''}
                      onChange={(e) => updateField('tlsKeyFile', e.target.value)}
                      placeholder="key.pem"
                      className="flex-1 bg-[#131923] border border-[#232c3d] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <button
                      onClick={() => pickFile('tlsKeyFile', 'Select Client Key', 'Private Keys (*.key;*.pem)', '*.key;*.pem')}
                      className="p-2 bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] rounded-lg text-xs text-gray-300"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
