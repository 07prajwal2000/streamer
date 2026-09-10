import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ConnectionView } from './components/ConnectionView';
import { PubSubView } from './components/pubsub/PubSubView';
import { JetStreamView } from './components/jetstream/JetStreamView';
import { KVView } from './components/kv/KVView';
import { SettingsModal } from './components/settings/SettingsModal';
import { storage, natsmanager } from '../wailsjs/go/models';
import {
  GetSavedConnections,
  SaveConnection,
  DeleteConnection,
  Connect,
  Disconnect,
  GetConnectionStatus,
  TestConnection,
  GetSetting,
  SetSetting,
} from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

export function App() {
  const [connections, setConnections] = useState<storage.ConnectionProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('connections');
  const [showSettings, setShowSettings] = useState(false);
  const [activeStatus, setActiveStatus] = useState<natsmanager.ServerStatus>(
    new natsmanager.ServerStatus({ connected: false, rttMs: 0 })
  );

  const loadConnections = async () => {
    try {
      const list = await GetSavedConnections();
      setConnections(list || []);
      if (!selectedId && list && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const loadStatus = async () => {
    try {
      const status = await GetConnectionStatus();
      setActiveStatus(status);
    } catch (err) {
      console.error('Failed to get status:', err);
    }
  };

  useEffect(() => {
    loadConnections();
    loadStatus();

    // Listen to real-time events emitted from Go
    const cancelStatusEvent = EventsOn('nats:status', (data: any) => {
      const s = new natsmanager.ServerStatus(data);
      setActiveStatus(s);
      if (!s.connected) {
        setActiveTab('connections');
      }
    });

    return () => {
      if (cancelStatusEvent) cancelStatusEvent();
    };
  }, []);

  const handleCreateNew = () => {
    const newProfile = new storage.ConnectionProfile({
      id: crypto.randomUUID(),
      name: 'New Connection',
      url: 'nats://127.0.0.1:4222',
      authType: 'none',
      clientName: 'Streamer',
      tlsInsecure: false,
    });
    setConnections((prev) => [newProfile, ...prev]);
    setSelectedId(newProfile.id);
  };

  const handleSave = async (p: storage.ConnectionProfile) => {
    await SaveConnection(p);
    await loadConnections();
  };

  const handleDelete = async (id: string) => {
    await DeleteConnection(id);
    const updated = connections.filter((c) => c.id !== id);
    setConnections(updated);
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleConnect = async (p: storage.ConnectionProfile) => {
    try {
      const status = await Connect(p);
      setActiveStatus(status);
    } catch (err) {
      alert(`Connection failed: ${err}`);
    }
  };

  const handleDisconnect = async () => {
    await Disconnect();
    await loadStatus();
  };

  const handleTest = async (p: storage.ConnectionProfile) => {
    return await TestConnection(p);
  };

  const currentProfile = connections.find((c) => c.id === selectedId);

  return (
    <div className="flex h-screen w-screen bg-[#0d1117] text-gray-200 overflow-hidden select-none font-sans">
      {/* Left Navigation Sidebar */}
      <Sidebar
        connections={connections}
        selectedId={selectedId}
        activeStatus={activeStatus}
        activeProfileId={activeStatus.currentProfileId}
        onSelect={(id) => setSelectedId(id)}
        onNew={handleCreateNew}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0">
        <div className={`h-full w-full flex flex-col ${activeTab === 'connections' ? '' : 'hidden'}`}>
          {currentProfile ? (
            <ConnectionView
              key={currentProfile.id}
              profile={currentProfile}
              activeStatus={activeStatus}
              isActive={activeStatus.connected && activeStatus.currentProfileId === currentProfile.id}
              onSave={handleSave}
              onDelete={handleDelete}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onTest={handleTest}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                +
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">No Profile Selected</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Create a new connection profile or select an existing one to get started.
                </p>
              </div>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              >
                Create Connection
              </button>
            </div>
          )}
        </div>

        <div className={`h-full w-full flex flex-col ${activeTab === 'pubsub' ? '' : 'hidden'}`}>
          <PubSubView />
        </div>

        <div className={`h-full w-full flex flex-col ${activeTab === 'jetstream' ? '' : 'hidden'}`}>
          <JetStreamView isConnected={activeStatus.connected} isActiveTab={activeTab === 'jetstream'} />
        </div>

        <div className={`h-full w-full flex flex-col ${activeTab === 'kv' ? '' : 'hidden'}`}>
          <KVView isConnected={activeStatus.connected} isActiveTab={activeTab === 'kv'} />
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
