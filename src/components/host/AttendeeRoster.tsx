/**
 * @fileoverview AttendeeRoster — Live attendee list with buzz controls.
 * Shows online/offline status and allows host to select and buzz specific attendees.
 */
import { useState } from 'react';
import Avatar from 'boring-avatars';
const AvatarComponent = (Avatar as any).default || Avatar;
import { Bell, BellRing, CheckCircle2, Circle, Users, Hand, X } from 'lucide-react';

interface Attendee {
  guestId: string;
  name: string;
  avatarSeed: string;
  status: 'fine' | 'lost';
  isOnline: boolean;
  isHandRaised?: boolean;
  handRaiseQuestion?: string;
}

interface AttendeeRosterProps {
  attendees: Attendee[];
  onBuzz: (guestIds: string[], buzzAll: boolean) => void;
  onTriggerAttendance: () => void;
  onLowerHand: (guestId: string) => void;
  onLowerAllHands: () => void;
  onKickUser: (guestId: string) => void;
  attendanceLog?: { guestId: string; name: string }[];
}

const AVATAR_PALETTE = ['#18181b', '#3f3f46', '#7c3aed', '#a78bfa', '#f4f4f5'];

export default function AttendeeRoster({
  attendees,
  onBuzz,
  onTriggerAttendance,
  onLowerHand,
  onLowerAllHands,
  onKickUser,
  attendanceLog = [],
}: AttendeeRosterProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (guestId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  };

  const handleBuzzSelected = () => {
    if (selected.size === 0) return;
    onBuzz([...selected], false);
    setSelected(new Set());
  };

  const handleBuzzAll = () => {
    onBuzz([], true);
    setSelected(new Set());
  };

  const onlineCount = attendees.filter((a) => a.isOnline).length;
  const anyHandsRaised = attendees.some((a) => a.isHandRaised);

  return (
    <div className="card h-full min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-200">Attendees</span>
          <span className="badge-zinc text-xs">{onlineCount}/{attendees.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {anyHandsRaised && (
            <button
              id="lower-all-hands-btn"
              onClick={onLowerAllHands}
              className="btn btn-sm bg-violet-900/30 border border-violet-800/40 hover:bg-violet-900/60 text-violet-300 transition-all duration-150 animate-pulse"
            >
              <Hand className="w-3.5 h-3.5" />
              Lower Hands
            </button>
          )}
          <button
            id="take-attendance-btn"
            onClick={onTriggerAttendance}
            className="btn-secondary btn-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Attendance
          </button>
          {selected.size > 0 && (
            <button
              id="buzz-selected-btn"
              onClick={handleBuzzSelected}
              className="btn-danger btn-sm"
            >
              <BellRing className="w-3.5 h-3.5" />
              Buzz ({selected.size})
            </button>
          )}
          <button
            id="buzz-all-btn"
            onClick={handleBuzzAll}
            disabled={attendees.length === 0}
            className="btn-ghost btn-sm"
          >
            <Bell className="w-3.5 h-3.5" />
            Buzz
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {attendees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 py-8">
            <Users className="w-8 h-8" />
            <p className="text-sm">Waiting for attendees…</p>
            <p className="text-xs text-zinc-700">Share the room code or QR to get started</p>
          </div>
        ) : (
          attendees.map((attendee) => {
            const isChecked = selected.has(attendee.guestId);
            const wasPresent = attendanceLog.some((l) => l.guestId === attendee.guestId);
            const avatarParts = (attendee.avatarSeed || '').split(':');
            const avatarVariant = avatarParts.length > 1 ? avatarParts[0] : 'beam';
            const seed = avatarParts.length > 1 ? avatarParts.slice(1).join(':') : attendee.avatarSeed;

            return (
              <div
                key={attendee.guestId}
                onClick={() => toggleSelect(attendee.guestId)}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer
                            transition-colors duration-100 select-none
                            ${isChecked ? 'bg-violet-900/30 border border-violet-700/50' : 'hover:bg-zinc-800/60'}`}
              >
                {/* Checkbox */}
                <div className={`w-4 h-4 rounded border transition-colors shrink-0
                  ${isChecked ? 'bg-violet-600 border-violet-600' : 'border-zinc-600'}`}>
                  {isChecked && (
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-white fill-current">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  )}
                </div>

                {/* Avatar */}
                <div className={`rounded-full overflow-hidden shrink-0 transition-opacity ${!attendee.isOnline ? 'opacity-40' : ''}`}>
                  <AvatarComponent size={28} name={seed} variant={avatarVariant as any} colors={AVATAR_PALETTE} />
                </div>

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm font-medium truncate ${attendee.isOnline ? 'text-zinc-200' : 'text-zinc-500'}`}>
                      {attendee.name}
                    </p>
                    {attendee.isHandRaised && (
                      <span className="inline-flex items-center text-violet-400 font-bold px-1.5 py-0.5 rounded text-[10px] bg-violet-900/20 border border-violet-850 animate-pulse">
                        <Hand className="w-2.5 h-2.5 mr-0.5 fill-current" /> Raised
                      </span>
                    )}
                  </div>
                  {attendee.isHandRaised && attendee.handRaiseQuestion && (
                    <p className="text-xs text-violet-300 font-medium italic break-words mt-0.5 bg-violet-950/20 border border-violet-900/30 rounded px-2 py-1 max-w-[190px]">
                      Q: "{attendee.handRaiseQuestion}"
                    </p>
                  )}
                </div>

                {/* Indicators */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {attendee.isHandRaised && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLowerHand(attendee.guestId);
                      }}
                      className="btn btn-sm btn-ghost p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded cursor-pointer"
                      title="Lower hand"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {attendee.status === 'lost' && (
                    <span className="badge-amber text-[10px]">Lost</span>
                  )}
                  {wasPresent && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-label="Marked present" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to remove ${attendee.name} from this session?`)) {
                        onKickUser(attendee.guestId);
                      }
                    }}
                    className="btn btn-sm btn-ghost p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded cursor-pointer"
                    title={`Remove ${attendee.name}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="22" x2="16" y1="11" y2="11" />
                    </svg>
                  </button>
                  {attendee.isOnline
                    ? <Circle className="w-2 h-2 text-emerald-500 fill-emerald-500" />
                    : <Circle className="w-2 h-2 text-zinc-600 fill-zinc-600" />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
