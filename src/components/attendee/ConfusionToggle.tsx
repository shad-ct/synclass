/**
 * @fileoverview ConfusionToggle — Persistent floating "Lost / Fine" toggle.
 * Always visible at the bottom of the attendee screen during an active session.
 * Debounced to prevent socket spam.
 */
import { useState, useCallback, useRef } from 'react';
import { Lightbulb, HelpCircle } from 'lucide-react';

interface ConfusionToggleProps {
  onStatusChange: (status: 'fine' | 'lost') => void;
}

export default function ConfusionToggle({ onStatusChange }: ConfusionToggleProps) {
  const [status, setStatus] = useState<'fine' | 'lost'>('fine');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = useCallback((newStatus: 'fine' | 'lost') => {
    if (newStatus === status) return;
    setStatus(newStatus);

    // Debounce the socket emission by 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onStatusChange(newStatus);
    }, 300);
  }, [status, onStatusChange]);

  const isLost = status === 'lost';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]">
      <div className="card-glass px-2 py-2 rounded-full flex items-center gap-1 shadow-2xl"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' }}
      >
        {/* Fine button */}
        <button
          id="status-fine-btn"
          onClick={() => handleToggle('fine')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold
                      transition-all duration-200 cursor-pointer select-none
                      ${!isLost
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                        : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          <Lightbulb className="w-4 h-4" />
          Tracking Fine
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-700 mx-0.5" />

        {/* Lost button */}
        <button
          id="status-lost-btn"
          onClick={() => handleToggle('lost')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold
                      transition-all duration-200 cursor-pointer select-none
                      ${isLost
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/40 animate-pulse'
                        : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          <HelpCircle className="w-4 h-4" />
          I'm Lost
        </button>
      </div>
    </div>
  );
}
