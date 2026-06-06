/**
 * @fileoverview AttendanceModal — Time-sensitive full-screen modal for marking presence.
 * Auto-closes after the server-specified timeout.
 */
import { useState, useEffect } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

interface AttendanceModalProps {
  isVisible: boolean;
  logId: string;
  timeoutMs: number;
  onAcknowledge: (logId: string) => void;
}

export default function AttendanceModal({
  isVisible,
  logId,
  timeoutMs,
  onAcknowledge,
}: AttendanceModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(timeoutMs / 1000));
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setSecondsLeft(Math.ceil(timeoutMs / 1000));
      setAcknowledged(false);
      return;
    }

    setSecondsLeft(Math.ceil(timeoutMs / 1000));
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isVisible, timeoutMs]);

  const handleAcknowledge = () => {
    if (acknowledged) return;
    setAcknowledged(true);
    onAcknowledge(logId);
  };

  if (!isVisible) return null;

  const progress = Math.max(0, ((secondsLeft / Math.ceil(timeoutMs / 1000)) * 100));

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
    >
      <div className="card w-full max-w-sm p-6 slide-up space-y-5"
        style={{ boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.2), 0 32px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-900/50 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100 text-base">Attendance Check</h2>
            <p className="text-xs text-zinc-500">Tap below to confirm you're here</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Time remaining</span>
            <span className={secondsLeft <= 5 ? 'text-red-400 font-semibold' : ''}>
              {secondsLeft}s
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${progress}%`,
                backgroundColor: secondsLeft <= 5 ? '#ef4444' : '#7c3aed',
              }}
            />
          </div>
        </div>

        {/* CTA or Confirmed */}
        {acknowledged ? (
          <div className="flex items-center justify-center gap-2 py-3 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Marked present!</span>
          </div>
        ) : (
          <button
            id="acknowledge-attendance-btn"
            onClick={handleAcknowledge}
            disabled={secondsLeft === 0}
            className="btn-primary btn-lg w-full"
          >
            <CheckCircle2 className="w-5 h-5" />
            I'm here!
          </button>
        )}
      </div>
    </div>
  );
}
