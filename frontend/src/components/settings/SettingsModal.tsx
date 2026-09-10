import React, { useState, useEffect } from 'react';
import { X, Sliders, Info, HardDrive, Star, ExternalLink } from 'lucide-react';
import { GetSetting, SetSetting } from '../../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: 'dark' | 'light' | 'system';
  onThemeChange?: (theme: 'dark' | 'light' | 'system') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'about'>('general');
  const [clientName, setClientName] = useState('Streamer');
  const [maxMsgBuffer, setMaxMsgBuffer] = useState('500');

  useEffect(() => {
    if (isOpen) {
      GetSetting('client_name', 'Streamer').then(setClientName);
      GetSetting('max_msg_buffer', '500').then(setMaxMsgBuffer);
    }
  }, [isOpen]);

  const handleSaveGeneral = async () => {
    await SetSetting('client_name', clientName);
    await SetSetting('max_msg_buffer', maxMsgBuffer);
    onClose();
  };

  const handleOpenRepo = () => {
    BrowserOpenURL('https://github.com/07prajwal2000/streamer');
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none"
    >
      <div className="w-full max-w-lg bg-[#111722] border border-[#1f2838] rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1f2838] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Settings</h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2230] transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-[#1f2838] flex gap-4 bg-[#0e131b]">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`pb-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'about'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            About & Credits
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 flex-1 space-y-4">

          {activeTab === 'general' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Default Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Streamer"
                  className="w-full bg-[#151c27] border border-[#222b3c] focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Live Stream Message Buffer Size
                </label>
                <input
                  type="number"
                  value={maxMsgBuffer}
                  onChange={(e) => setMaxMsgBuffer(e.target.value)}
                  min={100}
                  max={5000}
                  step={100}
                  className="w-full bg-[#151c27] border border-[#222b3c] focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                />
                <p className="text-[11px] text-gray-500">
                  Maximum number of messages stored in the live UI log before auto-purging old items.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#141b26] border border-[#212b3c] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Application</span>
                  <span className="font-semibold text-white">Streamer (NATS Native Desktop)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Architecture</span>
                  <span className="font-mono text-gray-300">Go 1.27 + Wails v2 + React 19</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Storage Backend</span>
                  <span className="font-mono text-gray-300">SQLite (Pure Go / CGO-free)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">NATS Client Engine</span>
                  <span className="font-mono text-gray-300">nats-io/nats.go v1.53 (JetStream v2)</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1e2532]">
                  <span className="text-gray-400">Author & Maintainer</span>
                  <span className="font-medium text-purple-400">@07prajwal2000</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Support & Star on GitHub</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">github.com/07prajwal2000/streamer</div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenRepo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-400 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Star Project</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1f2838] bg-[#0e131b] flex justify-end gap-2">
          {activeTab === 'general' ? (
            <button
              onClick={handleSaveGeneral}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              Save Settings
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-[#1a2230] hover:bg-[#222c3e] transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
