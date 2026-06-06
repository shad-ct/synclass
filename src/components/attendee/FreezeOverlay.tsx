/**
 * @fileoverview FreezeOverlay — Un-dismissible full-screen freeze lock.
 * Rendered when host emits `toggle_freeze` with isFrozen=true.
 * Blocks all interaction with a high-blur modal.
 */
interface FreezeOverlayProps {
  isVisible: boolean;
}

export default function FreezeOverlay({ isVisible }: FreezeOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        backdropFilter: 'blur(24px) brightness(0.3)',
        WebkitBackdropFilter: 'blur(24px) brightness(0.3)',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
      }}
    >
      {/* Pulsing ring */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute w-32 h-32 rounded-full border-2 border-violet-500/30 animate-ping" />
        <div className="absolute w-24 h-24 rounded-full border border-violet-500/50" />
        <div className="w-20 h-20 rounded-full bg-violet-600/20 flex items-center justify-center">
          {/* Eyes up icon */}
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-violet-300 fill-current">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-white mb-3 tracking-tight text-center">
        Look up at the presenter
      </h1>
      <p className="text-zinc-400 text-sm text-center max-w-xs leading-relaxed">
        Your screen has been paused by the presenter.
        <br />
        Please direct your attention to the front.
      </p>

      {/* Animated bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-violet-600/30">
        <div className="h-full bg-violet-500 animate-[pulse_2s_ease-in-out_infinite]"
          style={{ width: '60%', marginLeft: '20%' }} />
      </div>
    </div>
  );
}
