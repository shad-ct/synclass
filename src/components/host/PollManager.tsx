/**
 * @fileoverview PollManager - host panel for creating live attendee polls.
 */
import { useState, type FormEvent } from 'react';
import { Plus, Send, Trash2, TrendingUp, X } from 'lucide-react';
import type { PollSummary } from '../../types/poll';

interface PollManagerProps {
  activePoll: PollSummary | null;
  onCreatePoll: (question: string, options: string[]) => void;
  onClosePoll: () => void;
}

const DEFAULT_OPTIONS = ['', ''];

export default function PollManager({
  activePoll,
  onCreatePoll,
  onClosePoll,
}: PollManagerProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [sending, setSending] = useState(false);

  const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && cleanOptions.length >= 2 && !activePoll?.isActive;
  const maxCount = Math.max(1, ...(activePoll?.optionCounts || []));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setSending(true);
    onCreatePoll(question.trim(), cleanOptions);
    setQuestion('');
    setOptions(DEFAULT_OPTIONS);
    setTimeout(() => setSending(false), 500);
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, optionIndex) => (
      optionIndex === index ? value : option
    )));
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, optionIndex) => optionIndex !== index));
  };

  return (
    <div className="card h-full min-h-0 p-3 space-y-2 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="text-sm font-semibold text-zinc-200">Live Poll</span>
        </div>
        {activePoll?.isActive && (
          <button
            onClick={onClosePoll}
            className="btn btn-sm btn-ghost text-red-400 hover:text-red-350 hover:bg-red-950/20"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        )}
      </div>

      {activePoll && (
        <div className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-2.5 space-y-2 max-h-28 overflow-y-auto shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-100 break-words">{activePoll.question}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {activePoll.responseCount} response{activePoll.responseCount === 1 ? '' : 's'}
              </p>
            </div>
            <span className={activePoll.isActive ? 'badge-green shrink-0' : 'badge-zinc shrink-0'}>
              {activePoll.isActive ? 'Active' : 'Closed'}
            </span>
          </div>

          <div className="space-y-1.5">
            {activePoll.options.map((option, index) => {
              const count = activePoll.optionCounts[index] || 0;
              const percentage = activePoll.responseCount > 0
                ? Math.round((count / activePoll.responseCount) * 100)
                : 0;
              const width = `${Math.max(4, (count / maxCount) * 100)}%`;

              return (
                <div key={`${activePoll.id}-${index}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-300 font-medium truncate">{option}</span>
                    <span className="text-zinc-500 font-mono shrink-0">{count} / {percentage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-300"
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!activePoll?.isActive && (
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          <div className="space-y-1.5">
            <label htmlFor="poll-question" className="section-title">Question</label>
            <input
              id="poll-question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a quick question"
              maxLength={140}
              className="input text-sm py-2"
            />
          </div>

          <div className="space-y-1.5">
            <label className="section-title block">Options</label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(event) => handleOptionChange(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                  maxLength={80}
                  className="input text-xs py-1.5"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="btn-ghost p-2 rounded text-red-400 hover:text-red-350 hover:bg-red-950/20"
                    title="Remove option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddOption}
              disabled={options.length >= 6}
              className="btn btn-sm btn-secondary flex-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Option
            </button>
            <button
              type="submit"
              disabled={!canCreate || sending}
              className="btn btn-sm btn-primary flex-1"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Sent' : 'Launch Poll'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
