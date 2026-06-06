/**
 * @fileoverview ControlBar — Master override controls for the host.
 * Contains the Screen Freeze toggle and Buzz All action.
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
    <div className="flex items-center gap-3 w-full flex-wrap">
      {/* Section label */}
      <span className="section-title">Master Controls</span>

      {/* Freeze toggle */}
      <button
        id="freeze-toggle-btn"
        onClick={onToggleFreeze}
        className={`btn transition-all duration-200 ${isFrozen
          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 glow-violet animate-pulse'
          : 'btn-secondary border-blue-800/50 text-blue-400 hover:border-blue-600 hover:text-blue-300'}`}
      >
        <Snowflake className={`w-4 h-4 ${isFrozen ? 'animate-spin-slow' : ''}`} />
        {isFrozen ? '❄ Screens Frozen' : 'Freeze Screens'}
      </button>

      {/* Buzz all */}
      <button
        id="buzz-all-master-btn"
        onClick={onBuzzAll}
        disabled={attendeeCount === 0}
        className="btn-danger"
      >
        <Zap className="w-4 h-4" />
        Buzz Everyone
        {attendeeCount > 0 && <span className="text-red-200/70 text-xs">({attendeeCount})</span>}
      </button>

      {/* End Session */}
      <button
        id="end-session-btn"
        onClick={onEndSession}
        className="btn-ghost text-red-400 hover:text-white hover:bg-red-600/80 border border-red-900/40 hover:border-red-650 ml-auto"
      >
        End Session
      </button>
    </div>
  );
}
