import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';

const CountdownTimer = ({ targetDate, variant = 'compact' }) => {
  const { days, hours, minutes, seconds, totalSeconds, isEnded, formatted } =
    useCountdown(targetDate);

  if (isEnded) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>Bidding Closed</span>
      </div>
    );
  }

  const isEndingSoon = totalSeconds <= 3600; // Under 1 hour

  if (variant === 'full') {
    return (
      <div
        className={`p-4 rounded-xl border flex flex-col gap-2 ${
          isEndingSoon
            ? 'bg-amber-50/70 border-amber-300 text-amber-950'
            : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            {isEndingSoon ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
            ) : (
              <Clock className="w-4 h-4 text-blue-600" />
            )}
            {isEndingSoon ? 'Ending Soon!' : 'Time Remaining'}
          </span>
          <span className="text-[11px] font-normal text-slate-500">
            Server Authoritative
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center mt-1">
          <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200/60">
            <div className="text-xl font-bold font-mono text-slate-900 leading-tight">
              {days}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Days</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200/60">
            <div className="text-xl font-bold font-mono text-slate-900 leading-tight">
              {String(hours).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Hours</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200/60">
            <div className="text-xl font-bold font-mono text-slate-900 leading-tight">
              {String(minutes).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Mins</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200/60">
            <div
              className={`text-xl font-bold font-mono leading-tight ${
                isEndingSoon ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {String(seconds).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Secs</div>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant for cards
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${
        isEndingSoon
          ? 'bg-amber-100 text-amber-800 animate-pulse'
          : 'bg-slate-100 text-slate-700'
      }`}
    >
      <Clock className={`w-3.5 h-3.5 ${isEndingSoon ? 'text-amber-600' : 'text-slate-500'}`} />
      <span>{formatted}</span>
    </div>
  );
};

export default CountdownTimer;
