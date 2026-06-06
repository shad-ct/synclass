/**
 * @fileoverview BuzzAlert — Visual red pulse alert triggered by host buzz.
 * Triggers navigator.vibrate on mount and auto-dismisses after 3 seconds.
 */
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

interface BuzzAlertProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export default function BuzzAlert({ isVisible, onDismiss }: BuzzAlertProps) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Trigger device vibration if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Auto-dismiss after 3 seconds
    const fadeTimer = setTimeout(() => setIsFading(true), 2500);
    const dismissTimer = setTimeout(() => {
      onDismiss();
      setIsFading(false);
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-center justify-center 
                  transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Pulsing red background */}
      <div className="absolute inset-0 pulse-red pointer-events-none" />

      {/* Alert card */}
      <div
        className="relative z-10 card-glass p-8 text-center max-w-xs w-full mx-4 slide-up glow-red"
        style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}
        onClick={onDismiss}
      >
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center
                          animate-[pulse_0.6s_ease-in-out_infinite]">
            <Bell className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Attention!</h2>
        <p className="text-sm text-zinc-300">
          Your presenter is calling for your attention.
        </p>
        <p className="text-xs text-zinc-500 mt-4">Tap anywhere to dismiss</p>
      </div>
    </div>
  );
}
