import React from 'react';
import { Clock, Calendar, ArrowRight, Bell, Sparkles } from 'lucide-react';

interface ScheduleViewerProps {
  headers: { [key: string]: string[] } | undefined;
}

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({ headers }) => {
  if (!headers) return null;

  // Search case-insensitively for Nats-Schedule
  let scheduleVal = '';
  let targetVal = '';
  let sourceVal = '';
  let ttlVal = '';

  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (key === 'nats-schedule') scheduleVal = v[0] || '';
    if (key === 'nats-schedule-target') targetVal = v[0] || '';
    if (key === 'nats-schedule-source') sourceVal = v[0] || '';
    if (key === 'nats-schedule-ttl') ttlVal = v[0] || '';
  }

  if (!scheduleVal && !targetVal) return null;

  const isCron = !scheduleVal.startsWith('@') && scheduleVal.trim().split(/\s+/).length >= 5;
  const isInterval = scheduleVal.startsWith('@every');
  const isOneTime = scheduleVal.startsWith('@at');
  const isAlias = ['@hourly', '@daily', '@weekly'].includes(scheduleVal.trim());

  return (
    <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-[#111722] border border-purple-500/30 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              Scheduled / Cron Message
              <span className="px-1.5 py-0.2 text-[9px] rounded bg-purple-500/30 text-purple-200 border border-purple-500/40 uppercase font-mono">
                {isCron ? 'Cron 6-Field' : isInterval ? 'Interval' : isOneTime ? 'One-Time' : isAlias ? 'Preset' : 'Schedule'}
              </span>
            </span>
          </div>
        </div>

        {ttlVal && (
          <span className="text-[10px] text-gray-400 font-mono bg-[#141b26] px-1.5 py-0.5 rounded border border-[#212b3c]">
            TTL: {ttlVal}
          </span>
        )}
      </div>

      {/* Grid of Schedule Details */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#0c1017]/80 p-2.5 rounded-lg border border-[#1b2332]">
        <div>
          <span className="text-[10px] text-gray-400 block font-sans">Cadence / Expression</span>
          <span className="text-emerald-400 font-bold tracking-wide">
            {scheduleVal || 'Unspecified'}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-gray-400 block font-sans">Target Subject</span>
          <div className="flex items-center gap-1 text-cyan-400 font-semibold truncate">
            <ArrowRight className="w-3 h-3 shrink-0" />
            <span className="truncate">{targetVal || 'None'}</span>
          </div>
        </div>

        {sourceVal && (
          <div className="col-span-2 pt-1 border-t border-[#1b2332]">
            <span className="text-[10px] text-gray-400 block font-sans">Sampling Source</span>
            <span className="text-purple-300">{sourceVal}</span>
          </div>
        )}
      </div>
    </div>
  );
};
