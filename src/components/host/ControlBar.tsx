/**
 * @fileoverview ControlBar - compact host master override controls.
 */
import { Snowflake, Zap } from 'lucide-react';

interface ControlBarProps {
  isFrozen: boolean;
  onToggleFreeze: () => void;
  onBuzzAll: () => void;
  onEndSession: () => void;
  attendeeCount: number;
}

export default function ControlBar({
  isFrozen,
  onToggleFreeze,
  onBuzzAll,
  onEndSession,
  attendeeCount,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-start lg:justify-end gap-2 w-full flex-wrap lg:flex-nowrap">
      <span className="section-title hidden 2xl:inline">Master Controls</span>

      <button
        id="freeze-toggle-btn"
        onClick={onToggleFreeze}
        className={`btn btn-sm whitespace-nowrap transition-all duration-200 ${isFrozen
          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 glow-violet animate-pulse'
          : 'btn-secondary border-blue-800/50 text-blue-400 hover:border-blue-600 hover:text-blue-300'}`}
      >
        <Snowflake className={`w-4 h-4 ${isFrozen ? 'animate-spin-slow' : ''}`} />
        {isFrozen ? 'Frozen' : 'Freeze'}
      </button>

      <button
        id="buzz-all-master-btn"
        onClick={onBuzzAll}
        disabled={attendeeCount === 0}
        className="btn-danger btn-sm whitespace-nowrap"
      >
        <Zap className="w-4 h-4" />
        Buzz
        {attendeeCount > 0 && <span className="text-red-200/70 text-xs">({attendeeCount})</span>}
      </button>

      <button
        id="end-session-btn"
        onClick={onEndSession}
        className="btn-ghost btn-sm text-red-400 hover:text-white hover:bg-red-600/80 border border-red-900/40 hover:border-red-650 whitespace-nowrap"
      >
        End
      </button>
    </div>
  );
}
