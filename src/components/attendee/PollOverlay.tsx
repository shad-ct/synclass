/**
 * @fileoverview PollOverlay - attendee-facing live poll card.
 */
import { Check, TrendingUp } from 'lucide-react';
import type { PollSummary } from '../../types/poll';

interface PollOverlayProps {
  poll: PollSummary;
  selectedOption: number | null;
  onSubmit: (optionIndex: number) => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function PollOverlay({
  poll,
  selectedOption,
  onSubmit,
}: PollOverlayProps) {
  const answeredOption = selectedOption ?? poll.selectedOption ?? null;
  const hasResponded = poll.hasResponded || answeredOption !== null;
  const maxCount = Math.max(1, ...poll.optionCounts);

  return (
    <div className="fixed left-0 right-0 bottom-24 z-[65] px-4 pointer-events-none">
      <div
        className="card pointer-events-auto w-full max-w-md mx-auto overflow-hidden slide-up"
        style={{ boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.15), 0 24px 60px rgba(0,0,0,0.45)' }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-sm font-bold text-zinc-200">Live Poll</span>
          </div>
          {hasResponded && (
            <span className="badge-green shrink-0">
              <Check className="w-3 h-3" />
              Voted
            </span>
          )}
        </div>

        <div className="p-4 space-y-4">
          <h2 className="text-base font-extrabold text-white leading-snug text-left">
            {poll.question}
          </h2>

          {!hasResponded ? (
            <div className="grid gap-2">
              {poll.options.map((option, index) => (
                <button
                  key={`${poll.id}-${index}`}
                  onClick={() => onSubmit(index)}
                  className="btn btn-secondary justify-start w-full min-h-12 text-left"
                >
                  <span className="w-6 h-6 rounded-md bg-violet-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                    {OPTION_LABELS[index]}
                  </span>
                  <span className="text-sm font-semibold text-zinc-100 leading-snug break-words">
                    {option}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {poll.options.map((option, index) => {
                const count = poll.optionCounts[index] || 0;
                const percentage = poll.responseCount > 0
                  ? Math.round((count / poll.responseCount) * 100)
                  : 0;
                const width = `${Math.max(4, (count / maxCount) * 100)}%`;
                const isSelected = answeredOption === index;

                return (
                  <div key={`${poll.id}-result-${index}`} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                          {OPTION_LABELS[index]}
                        </span>
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-violet-200' : 'text-zinc-300'}`}>
                          {option}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-zinc-500 shrink-0">{percentage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isSelected ? 'bg-violet-500' : 'bg-zinc-600'}`}
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-zinc-500 text-center">
                {poll.responseCount} response{poll.responseCount === 1 ? '' : 's'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
