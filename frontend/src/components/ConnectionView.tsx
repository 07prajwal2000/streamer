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
  Clock
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
        msg: `Connected to ${res.serverVersion || 'NATS'} (RTT: ${res.rttMs.toFixed(1)}ms)`,
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-y-auto">
      {/* Top Action Bar */}
      <div className="h-14 px-6 border-b border-[#1e2530] flex items-center justify-between bg-[#0e131b]/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white tracking-tight">
            {form.name || 'New Connection Profile'}
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
            disabled={testing || !form.url}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#1a212d] hover:bg-[#232c3c] border border-[#2a3446] transition-all disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${testing ? 'animate-bounce' : ''}`} />
            <span>{testing ? 'Testing...' : 'Test Ping'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.url}
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
              disabled={!form.url}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Profile Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Local Dev NATS"
                  className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Client Name</label>
                <input
                  type="text"
                  value={form.clientName || 'Streamer'}
                  onChange={(e) => updateField('clientName', e.target.value)}
                  placeholder="Streamer"
                  className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">NATS Server URL(s)</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="nats://127.0.0.1:4222 or nats://demo.nats.io:4222"
                className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors"
              />
              <p className="text-[11px] text-gray-500">
                Comma-separated URLs are supported for cluster failover (e.g. <code className="text-gray-400">nats://srv1:4222, nats://srv2:4222</code>).
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Authentication */}
        {activeTab === 'auth' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Authentication Method</label>
              <div className="grid grid-cols-5 gap-2">
                {[
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
                ))}
              </div>
            </div>

            {form.authType === 'none' && (
              <div className="p-4 rounded-lg bg-[#111722] border border-[#1e2736] text-xs text-gray-400">
                Anonymous access. No credentials or tokens will be provided upon connecting.
              </div>
            )}

            {form.authType === 'userpass' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">Username</label>
                  <input
                    type="text"
                    value={form.username || ''}
                    onChange={(e) => updateField('username', e.target.value)}
                    placeholder="Username"
                    className="w-full bg-[#131923] border border-[#232c3d] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">Password</label>
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

            {form.authType === 'token' && (
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

            {form.authType === 'credentials' && (
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

            {form.authType === 'nkey' && (
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
          </div>
        )}
      </div>
    </div>
  );
};
