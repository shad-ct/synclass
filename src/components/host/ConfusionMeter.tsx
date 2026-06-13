/**
 * @fileoverview ConfusionMeter — Live bar chart of audience confusion level.
 * Receives streaming updates from the server every 500ms and renders an animated meter.
 */
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface ConfusionUpdate {
  lostCount: number;
  total: number;
  percentage: number;
  timestamp: number;
}

interface ConfusionMeterProps {
  latest: ConfusionUpdate | null;
}

const MAX_HISTORY = 30; // Keep 30 data points (15 seconds of 500ms updates)

export default function ConfusionMeter({ latest }: ConfusionMeterProps) {
  const [history, setHistory] = useState<Array<{ t: string; pct: number }>>([]);

  useEffect(() => {
    if (!latest) return;
    const timeStr = new Date(latest.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setHistory((prev) => {
      const next = [...prev, { t: timeStr, pct: latest.percentage }];
      return next.slice(-MAX_HISTORY);
    });
  }, [latest]);

  const current = latest?.percentage ?? 0;
  const isHigh = current >= 40;
  const isModerate = current >= 20 && current < 40;

  return (
    <div className="card h-full min-h-0 p-3 space-y-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-200">Confusion Meter</span>
        </div>
        {isHigh && (
          <div className="badge-red animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            High confusion
          </div>
        )}
      </div>

      {/* Current reading */}
      <div className="flex items-end gap-3">
        <div className={`text-3xl font-bold tabular-nums transition-colors duration-300 ${isHigh ? 'text-red-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'}`}>
          {current}%
        </div>
        <div className="pb-1 text-xs text-zinc-500 space-y-0.5">
          <p>{latest?.lostCount ?? 0} lost</p>
          <p>of {latest?.total ?? 0} online</p>
        </div>
      </div>

      {/* Bar visualization */}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${current}%`,
            backgroundColor: isHigh ? '#ef4444' : isModerate ? '#f59e0b' : '#10b981',
          }}
        />
      </div>

      {/* Sparkline chart */}
      {history.length > 2 && (
        <div className="h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="confusionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isHigh ? '#ef4444' : '#7c3aed'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isHigh ? '#ef4444' : '#7c3aed'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#52525b' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: number) => [`${val}%`, 'Lost']}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Area
                type="monotone"
                dataKey="pct"
                stroke={isHigh ? '#ef4444' : '#7c3aed'}
                fill="url(#confusionGrad)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {history.length <= 2 && (
        <p className="text-xs text-zinc-600 text-center py-0.5">Collecting data…</p>
      )}
    </div>
  );
}
