/**
 * @fileoverview Leaderboard — Live ranked quiz leaderboard for the host.
 * Updates in real-time after each question ends.
 */
import Avatar from 'boring-avatars';
const AvatarComponent = (Avatar as any).default || Avatar;
import { Trophy } from 'lucide-react';

interface LeaderboardEntry {
  guestId: string;
  name: string;
  avatarSeed?: string;
  totalPoints: number;
  correctAnswers: number;
  rank: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  questionIndex: number;
}

const AVATAR_PALETTE = ['#18181b', '#3f3f46', '#7c3aed', '#a78bfa', '#f4f4f5'];

const RANK_STYLES: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-zinc-300',
  3: 'text-amber-700',
};

const RANK_ICONS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function Leaderboard({ entries, questionIndex }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="card h-full min-h-0 p-3 space-y-2 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-zinc-200">Leaderboard</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Scores will appear after the first question
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full min-h-0 p-3 space-y-2 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-zinc-200">Leaderboard</span>
        </div>
        {questionIndex >= 0 && (
          <span className="text-xs text-zinc-500">After Q{questionIndex + 1}</span>
        )}
      </div>

      {/* Entries */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        {entries.slice(0, 10).map((entry) => {
          const isTop3 = entry.rank <= 3;
          return (
            <div
              key={entry.guestId}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors
                ${isTop3 ? 'bg-amber-900/10 border border-amber-800/20' : 'bg-zinc-800/40'}`}
            >
              {/* Rank */}
              <div className={`text-sm font-bold w-6 text-center shrink-0 ${RANK_STYLES[entry.rank] || 'text-zinc-500'}`}>
                {RANK_ICONS[entry.rank] || `#${entry.rank}`}
              </div>

              {/* Avatar */}
              <div className="rounded-full overflow-hidden shrink-0">
                {(() => {
                  const avatarParts = (entry.avatarSeed || '').split(':');
                  const avatarVariant = avatarParts.length > 1 ? avatarParts[0] : 'beam';
                  const seed = avatarParts.length > 1 ? avatarParts.slice(1).join(':') : (entry.avatarSeed || entry.name);
                  return (
                    <AvatarComponent size={24} name={seed} variant={avatarVariant as any} colors={AVATAR_PALETTE} />
                  );
                })()}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{entry.name}</p>
                <p className="text-[10px] text-zinc-600">{entry.correctAnswers} correct</p>
              </div>

              {/* Points */}
              <div className={`text-sm font-bold tabular-nums ${isTop3 ? 'text-amber-400' : 'text-zinc-300'}`}>
                {entry.totalPoints.toLocaleString()}
                <span className="text-[10px] font-normal text-zinc-600 ml-0.5">pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
