/**
 * @fileoverview QuizQuestion — Kahoot-style question display for attendees.
 * Shows large color-coded answer buttons, countdown timer, and result feedback.
 */
import { useState, useEffect } from 'react';

const OPTION_SYMBOLS = ['▲', '●', '■', '◆'];
const OPTION_CLASSES = ['quiz-opt-0', 'quiz-opt-1', 'quiz-opt-2', 'quiz-opt-3'];

interface QuizQuestionProps {
  questionIndex: number;
  text: string;
  options: string[];
  secondsLeft: number;
  timeLimit: number;
  hasAnswered: boolean;
  answerResult: { isCorrect: boolean; correctIndex: number; pointsAwarded: number; rank?: number; totalPlayers?: number } | null;
  onSubmit: (selectedOption: number) => void;
  showFeedback: boolean;
}

export default function QuizQuestion({
  questionIndex,
  text,
  options,
  secondsLeft,
  timeLimit,
  hasAnswered,
  answerResult,
  onSubmit,
  showFeedback,
}: QuizQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const progress = Math.max(0, (secondsLeft / timeLimit) * 100);
  const isUrgent = secondsLeft <= 5;

  useEffect(() => {
    // Reset selection on new question
    setSelected(null);
  }, [questionIndex]);

  const handleSelect = (index: number) => {
    if (hasAnswered || selected !== null) return;
    setSelected(index);
    onSubmit(index);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-zinc-950 flex flex-col">
      {/* Timer bar */}
      <div className="h-1.5 bg-zinc-800">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: isUrgent ? '#ef4444' : '#7c3aed',
          }}
        />
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-6">
        {/* Timer display */}
        <div className={`text-4xl font-bold tabular-nums transition-colors duration-300 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-zinc-300'}`}>
          {secondsLeft}
        </div>

        {/* Question number */}
        <div className="section-title text-center">
          Question {questionIndex + 1}
        </div>

        {/* Question text */}
        <div className="text-center max-w-md">
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{text}</h2>
        </div>

        {/* Answer result overlay */}
        {showFeedback && answerResult && typeof answerResult.isCorrect === 'boolean' && (
          <div className={`w-full max-w-sm p-4 rounded-xl text-center slide-up ${answerResult.isCorrect ? 'bg-emerald-900/40 border border-emerald-700/50' : 'bg-red-900/40 border border-red-700/50'}`}>
            <div className="text-2xl mb-1">{answerResult.isCorrect ? '🎉' : '❌'}</div>
            <p className="font-bold text-lg text-white">
              {answerResult.isCorrect ? 'Correct!' : 'Wrong answer'}
            </p>
            {answerResult.pointsAwarded > 0 && (
              <p className="text-emerald-300 font-semibold">+{answerResult.pointsAwarded} pts</p>
            )}
            {answerResult.rank !== undefined && answerResult.rank > 0 && (
              <p className="text-zinc-350 text-xs font-medium mt-2.5 pt-2 border-t border-white/10">
                You are currently in <span className="font-extrabold text-violet-400">#{answerResult.rank}</span> place out of {answerResult.totalPlayers || 1}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Options grid — only show if not yet answered */}
      {selected === null && !showFeedback && (
        <div className="grid grid-cols-2 gap-2 p-3 pb-safe animate-in fade-in duration-200">
          {options.map((option, i) => (
            <button
              key={i}
              id={`quiz-option-${i}`}
              onClick={() => handleSelect(i)}
              disabled={hasAnswered || selected !== null}
              className={`${OPTION_CLASSES[i]} btn rounded-xl p-4 h-[4.5rem] text-white font-bold
                          text-sm flex items-center gap-3 transition-all duration-150
                          disabled:opacity-60 active:scale-95
                          ${selected === i ? 'ring-4 ring-white/50 scale-95' : ''}`}
            >
              <span className="text-xl shrink-0">{OPTION_SYMBOLS[i]}</span>
              <span className="text-left leading-tight flex-1">{option}</span>
            </button>
          ))}
        </div>
      )}

      {/* "Waiting for results" state after answering */}
      {selected !== null && !showFeedback && (
        <div className="p-6 text-center animate-in fade-in duration-200">
          <div className="flex items-center justify-center gap-2 text-zinc-400">
            <div className="w-4 h-4 border-2 border-zinc-650 border-t-violet-500 rounded-full animate-spin shrink-0" />
            <span className="text-sm font-medium">Answer submitted! Waiting for results…</span>
          </div>
        </div>
      )}
    </div>
  );
}
