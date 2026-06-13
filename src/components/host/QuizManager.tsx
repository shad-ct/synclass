/**
 * @fileoverview QuizManager — Manage, build, edit, and launch persistent Quiz Sets.
 *
 * Views:
 * - list: Displays saved quiz sets from MongoDB, allowing the host to Edit, Delete, or Launch them.
 * - build: Editor view to create a new quiz set or modify an existing one (includes Title and full question CRUD).
 * - launch: Active quiz gameplay view (visible when a quiz is running in the current session).
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, PlayCircle, BookOpen, X, Loader2 } from 'lucide-react';
import { SERVER_URL } from '../../config';

const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const EditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const SaveIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
    <path d="M7 3v4a1 1 0 0 0 1 1h7" />
  </svg>
);


interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

interface QuizSet {
  _id: string;
  title: string;
  questions: Question[];
}

interface QuizManagerProps {
  questions: Question[]; // current session questions (restored)
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  onCreateQuiz: (questions: Question[]) => void;
  onLaunchQuestion: (index: number) => void;
  onResetQuiz: () => void;
  onClearLeaderboard: () => void;
  quizCreated: boolean;
  questionCount: number;
  activeQuestionIndex: number;
  askedQuestions: number[];
  quizAnswerCount: number;
  onShowScoreboard: () => void;
  onShowPodium: () => void;
  roomCode: string;
}

const DEFAULT_QUESTION: Question = {
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  timeLimit: 20,
};

const OPTION_COLORS = [
  'bg-red-650/10 border-red-700/20 text-red-200',
  'bg-blue-650/10 border-blue-700/20 text-blue-200',
  'bg-amber-600/10 border-amber-700/20 text-amber-200',
  'bg-emerald-650/10 border-emerald-700/20 text-emerald-200',
];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function QuizManager({
  questions: activeQuestions,
  setQuestions: setActiveQuestions,
  onCreateQuiz,
  onLaunchQuestion,
  onResetQuiz,
  onClearLeaderboard,
  quizCreated,
  questionCount,
  activeQuestionIndex,
  askedQuestions = [],
  quizAnswerCount,
  onShowScoreboard,
  onShowPodium,
  roomCode,
}: QuizManagerProps) {
  // View states: 'list' | 'build' | 'launch'
  const [view, setView] = useState<'list' | 'build' | 'launch'>(quizCreated ? 'launch' : 'list');
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(false);

  // Editor states
  const [editingSet, setEditingSet] = useState<QuizSet | null>(null);
  const [title, setTitle] = useState('');
  const [editorQuestions, setEditorQuestions] = useState<Question[]>([
    { text: '', options: ['', '', '', ''], correctIndex: 0, timeLimit: 20 }
  ]);

  // Sync view state with quiz session lifecycle
  useEffect(() => {
    if (quizCreated) {
      setView('launch');
    } else {
      setView('list');
      fetchQuizSets();
    }
  }, [quizCreated]);

  // Fetch saved quiz sets from database
  const fetchQuizSets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/quizzes`);
      const data = await res.json();
      if (data.success) {
        setQuizSets(data.quizSets || []);
      }
    } catch (err) {
      console.error('[QuizManager] Error fetching quiz sets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save new or updated quiz set
  const handleSaveQuizSet = async () => {
    if (!title.trim()) {
      alert('Please enter a title for the quiz set.');
      return;
    }

    const validQuestions = editorQuestions.filter(
      (q) => q.text.trim() && q.options.every((o) => o.trim())
    );

    if (validQuestions.length === 0) {
      alert('Your quiz set must have at least one complete question (with title and all options).');
      return;
    }

    try {
      const url = editingSet
        ? `${SERVER_URL}/api/quizzes/${editingSet._id}`
        : `${SERVER_URL}/api/quizzes`;
      const method = editingSet ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), questions: validQuestions }),
      });

      const data = await res.json();
      if (data.success) {
        setView('list');
        fetchQuizSets();
      } else {
        alert(`Failed to save: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('[QuizManager] Error saving quiz set:', err);
      alert('Error saving quiz set. Make sure the server is running.');
    }
  };

  // Delete saved quiz set
  const handleDeleteQuizSet = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz set permanently?')) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/quizzes/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchQuizSets();
      } else {
        alert('Failed to delete quiz set.');
      }
    } catch (err) {
      console.error('[QuizManager] Error deleting quiz set:', err);
    }
  };

  // Enter builder to create new quiz set
  const handleNewQuizSet = () => {
    setEditingSet(null);
    setTitle('');
    setEditorQuestions([{ text: '', options: ['', '', '', ''], correctIndex: 0, timeLimit: 20 }]);
    setView('build');
  };

  // Enter builder to edit existing quiz set
  const handleEditQuizSet = (set: QuizSet) => {
    setEditingSet(set);
    setTitle(set.title);
    // Deep copy questions to prevent modifying list direct
    setEditorQuestions(JSON.parse(JSON.stringify(set.questions)));
    setView('build');
  };

  // Launch a saved quiz set questions into the active session
  const handleLaunchQuizSet = (set: QuizSet) => {
    setActiveQuestions(set.questions);
    onCreateQuiz(set.questions);
  };

  // Editor Helpers
  const addEditorQuestion = () => {
    setEditorQuestions((prev) => [...prev, { ...DEFAULT_QUESTION, options: ['', '', '', ''] }]);
  };

  const updateEditorQuestion = (qIdx: number, field: keyof Question, value: any) => {
    setEditorQuestions((prev) => {
      const next = [...prev];
      next[qIdx] = { ...next[qIdx], [field]: value };
      return next;
    });
  };

  const updateEditorOption = (qIdx: number, oIdx: number, value: string) => {
    setEditorQuestions((prev) => {
      const next = [...prev];
      const opts = [...next[qIdx].options];
      opts[oIdx] = value;
      next[qIdx] = { ...next[qIdx], options: opts };
      return next;
    });
  };

  const removeEditorQuestion = (qIdx: number) => {
    if (editorQuestions.length <= 1) return;
    setEditorQuestions((prev) => prev.filter((_, i) => i !== qIdx));
  };

  const isEditorValid = title.trim().length > 0 && editorQuestions.every(
    (q) => q.text.trim().length > 0 && q.options.every((opt) => opt.trim().length > 0)
  );

  // ── 1. LIST VIEW ──────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="card p-3 space-y-2 h-full min-h-0 flex flex-col justify-between overflow-hidden">
        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-semibold text-zinc-200">Quiz Sets</span>
            </div>
            <button
              onClick={handleNewQuizSet}
              className="btn btn-sm btn-primary text-xs flex items-center gap-1 cursor-pointer select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Set
            </button>
          </div>

          {/* List content */}
          <div className="flex-1 min-h-0 overflow-auto space-y-2 pr-1">
            {loading ? (
              <div className="h-full min-h-32 flex flex-col items-center justify-center gap-2 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                <span className="text-xs">Loading quiz sets…</span>
              </div>
            ) : quizSets.length === 0 ? (
              <div className="h-full min-h-32 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center p-4 text-center space-y-2">
                <p className="text-xs text-zinc-500 font-medium">No quiz sets saved in DB yet.</p>
                <button
                  onClick={handleNewQuizSet}
                  className="text-xs text-violet-400 hover:text-violet-300 font-bold select-none cursor-pointer"
                >
                  Create one now
                </button>
              </div>
            ) : (
              quizSets.map((set) => (
                <div
                  key={set._id}
                  className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors hover:border-zinc-700/60"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-zinc-200 truncate">{set.title}</h4>
                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">{set.questions.length} questions</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleLaunchQuizSet(set)}
                      className="btn btn-xs btn-primary text-[11px] px-2 py-1 flex items-center gap-1 select-none cursor-pointer"
                      title="Launch quiz set into the live room session"
                    >
                      <PlayCircle className="w-3 h-3" />
                      Launch Set
                    </button>
                    <button
                      onClick={() => handleEditQuizSet(set)}
                      className="btn btn-xs btn-ghost p-1 text-zinc-400 hover:text-zinc-200"
                      title="Edit Quiz Set"
                    >
                      <EditIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuizSet(set._id)}
                      className="btn btn-xs btn-ghost p-1 text-red-400 hover:text-red-350 hover:bg-red-950/20"
                      title="Delete Quiz Set"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2 text-center">Templates survive room closure</p>
      </div>
    );
  }

  // ── 2. BUILD / EDIT VIEW ──────────────────────────────
  if (view === 'build') {
    return (
      <div className="card p-3 space-y-3 h-full min-h-0 flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className="btn-ghost p-1 rounded hover:bg-zinc-800/50"
            >
              <ArrowLeftIcon className="w-4 h-4 text-zinc-400" />
            </button>
            <span className="text-sm font-bold text-zinc-200">
              {editingSet ? 'Edit Quiz Set' : 'Create Quiz Set'}
            </span>
          </div>
          <button
            onClick={() => setView('list')}
            className="btn btn-xs btn-ghost text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Builder Content */}
        <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
          {/* Title field */}
          <div className="space-y-1.5">
            <label className="section-title">Quiz Set Name</label>
            <input
              type="text"
              placeholder="e.g. JavaScript Basics, History Trivia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input text-sm py-2 font-medium"
              maxLength={60}
            />
          </div>

          {/* Questions Editor list */}
          <div className="space-y-3">
            <label className="section-title block mb-1">Questions ({editorQuestions.length})</label>
            {editorQuestions.map((q, qIdx) => (
              <div key={qIdx} className="bg-zinc-850/40 border border-zinc-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-400">Question {qIdx + 1}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={q.timeLimit}
                      onChange={(e) => updateEditorQuestion(qIdx, 'timeLimit', Number(e.target.value))}
                      className="input py-1 px-1.5 text-[11px] w-20 bg-zinc-900 border-zinc-850"
                    >
                      {[10, 15, 20, 30, 45, 60].map((t) => (
                        <option key={t} value={t}>{t}s timer</option>
                      ))}
                    </select>
                    {editorQuestions.length > 1 && (
                      <button
                        onClick={() => removeEditorQuestion(qIdx)}
                        className="btn-ghost p-1 hover:bg-zinc-800 rounded"
                        title="Remove Question"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Question statement (e.g. What is 2 + 2?)"
                  value={q.text}
                  onChange={(e) => updateEditorQuestion(qIdx, 'text', e.target.value)}
                  className="input text-xs py-2 bg-zinc-900 border-zinc-850"
                />

                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 bg-zinc-900/60 border-zinc-850 ${OPTION_COLORS[oIdx]}`}
                    >
                      <button
                        onClick={() => updateEditorQuestion(qIdx, 'correctIndex', oIdx)}
                        className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors cursor-pointer flex items-center justify-center
                          ${q.correctIndex === oIdx ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600 bg-transparent'}`}
                        title="Mark as correct answer"
                      />
                      <span className="text-[10px] font-black shrink-0">{OPTION_LABELS[oIdx]}</span>
                      <input
                        type="text"
                        placeholder={`Option ${OPTION_LABELS[oIdx]}`}
                        value={opt}
                        onChange={(e) => updateEditorOption(qIdx, oIdx, e.target.value)}
                        className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none min-w-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addEditorQuestion}
            className="btn-ghost btn-sm w-full border border-dashed border-zinc-800 hover:border-zinc-600 rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Question
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 pt-3 border-t border-zinc-900/60 shrink-0">
          <button
            onClick={() => setView('list')}
            className="btn btn-secondary flex-1 text-xs select-none cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveQuizSet}
            disabled={!isEditorValid}
            className="btn btn-primary flex-1 text-xs flex items-center justify-center gap-1 select-none cursor-pointer"
          >
            <SaveIcon className="w-3.5 h-3.5" />
            Save Quiz Set
          </button>
        </div>
      </div>
    );
  }

  // ── 3. LAUNCH / GAMEPLAY VIEW ────────────────────────
  return (
    <div className="card p-3 space-y-2 h-full min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-200">Active Session Quiz</span>
          {quizCreated && (
            <button
              onClick={() => window.open(`/room/${roomCode}/present`, '_blank')}
              className="ml-2 btn btn-xs btn-secondary border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex items-center gap-1 cursor-pointer select-none"
              title="Open Kahoot-style projector screen in a new tab"
            >
              <span>📺 Present</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the whole leaderboard? This will reset all player points to 0.')) {
                onClearLeaderboard();
              }
            }}
            className="btn btn-xs btn-ghost text-amber-400 hover:text-amber-350 hover:bg-amber-950/20"
          >
            Clear Leaderboard
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to exit active gameplay? This will reset all active scores.')) {
                onResetQuiz();
                setView('list');
              }
            }}
            className="btn btn-xs btn-ghost text-red-400 hover:text-red-350 hover:bg-red-950/20"
          >
            Exit Game
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
          <span>{questionCount} questions loaded in room</span>
          <span className="font-mono">{askedQuestions.length} / {questionCount} completed</span>
        </div>

        {/* Central Gameplay Controls */}
        {(() => {
          let nextAction: 'start' | 'next' | 'podium' | 'ended' = 'start';
          let nextQuestionIndex = 0;

          if (askedQuestions.length > 0) {
            const lastAsked = askedQuestions[askedQuestions.length - 1];
            if (activeQuestionIndex !== -1) {
              nextAction = 'ended';
            } else if (lastAsked + 1 < questionCount) {
              nextAction = 'next';
              nextQuestionIndex = lastAsked + 1;
            } else {
              nextAction = 'podium';
            }
          }

          return (
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-2.5 rounded-xl space-y-2 text-left">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Set Playback Controls</span>
              {nextAction === 'start' && (
                <button
                  onClick={() => onLaunchQuestion(0)}
                  className="btn btn-sm btn-primary w-full flex items-center justify-center gap-1.5 font-bold select-none cursor-pointer bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md border-transparent text-white"
                >
                  <PlayCircle className="w-4 h-4" />
                  Start Quiz (Launch Q1)
                </button>
              )}
              {nextAction === 'next' && (
                <button
                  onClick={() => onLaunchQuestion(nextQuestionIndex)}
                  className="btn btn-sm btn-primary w-full flex items-center justify-center gap-1.5 font-bold select-none cursor-pointer bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md border-transparent text-white"
                >
                  <PlayCircle className="w-4 h-4" />
                  Next Question (Launch Q{nextQuestionIndex + 1})
                </button>
              )}
              {nextAction === 'podium' && (
                <button
                  onClick={onShowPodium}
                  className="btn btn-sm btn-primary w-full flex items-center justify-center gap-1.5 font-bold select-none cursor-pointer bg-gradient-to-r from-amber-500 to-yellow-500 shadow-md border-transparent text-zinc-950"
                >
                  🏆 Show Final Podium
                </button>
              )}
              {nextAction === 'ended' && (
                <div className="w-full text-center py-2 bg-zinc-950/40 border border-zinc-800 text-zinc-400 font-semibold rounded-lg text-xs flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
                  Question {activeQuestionIndex + 1} is active ({quizAnswerCount} answered)
                </div>
              )}
            </div>
          );
        })()}

        {/* Projector Leaderboard / Podium Controls */}
        {askedQuestions.length > 0 && activeQuestionIndex === -1 && (
          <div className="bg-violet-950/20 border border-violet-900/30 rounded-xl p-2.5 space-y-2 text-center animate-in fade-in duration-200">
            <p className="text-xs text-violet-350 font-semibold tracking-wide uppercase">Projector Controls</p>
            <div className="flex gap-2">
              <button
                onClick={onShowScoreboard}
                className="btn btn-sm btn-primary flex-1 text-xs select-none cursor-pointer"
              >
                Show Leaderboard
              </button>
              {askedQuestions.includes(questionCount - 1) && (
                <button
                  onClick={onShowPodium}
                  className="btn btn-sm btn-secondary flex-1 border-amber-600/30 text-amber-300 bg-amber-950/20 hover:bg-amber-900/30 hover:border-amber-600/50 text-xs select-none cursor-pointer"
                >
                  🏆 Show Final Podium
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active game loop list */}
        {Array.from({ length: questionCount }, (_, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg border transition-colors
              ${activeQuestionIndex === i ? 'bg-violet-900/30 border-violet-700/50' : 'bg-zinc-800/40 border-zinc-700/30'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {activeQuestionIndex === i && (
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
              )}
              <span className="text-sm text-zinc-300 truncate font-medium" title={activeQuestions[i]?.text}>
                {askedQuestions.includes(i) ? '✓ ' : ''}Q{i + 1}: {activeQuestions[i]?.text || `Question ${i + 1}`}
                {activeQuestionIndex === i && (
                  <span className="ml-2 text-[10px] font-bold text-violet-350 bg-violet-950/50 border border-violet-850 px-1.5 py-0.5 rounded-md">
                    {quizAnswerCount} answered
                  </span>
                )}
              </span>
            </div>
            <button
              id={`launch-q-${i}-btn`}
              onClick={() => onLaunchQuestion(i)}
              disabled={activeQuestionIndex === i}
              className={`btn btn-sm shrink-0 ${activeQuestionIndex === i ? 'btn-secondary opacity-50' : 'btn-primary'}`}
            >
              {activeQuestionIndex === i
                ? 'Active'
                : <><PlayCircle className="w-3.5 h-3.5" />Launch</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
