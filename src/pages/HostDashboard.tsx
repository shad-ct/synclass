/**
 * @fileoverview HostDashboard — The Presenter Command Center.
 * Full desktop-optimized layout with 3-column grid housing all host panels.
 * Manages session creation, all socket events, and orchestrates child components.
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Radio, Hand, X } from 'lucide-react';
import { socket } from '../socket';
import useSocket from '../hooks/useSocket';
import useLocalStorage from '../hooks/useLocalStorage';
import RoomHeader from '../components/host/RoomHeader';
import AttendeeRoster from '../components/host/AttendeeRoster';
import QuizManager from '../components/host/QuizManager';
import Leaderboard from '../components/host/Leaderboard';
import ResourceManager from '../components/host/ResourceManager';
import BroadcastPanel from '../components/host/BroadcastPanel';
import ConfusionMeter from '../components/host/ConfusionMeter';
import ControlBar from '../components/host/ControlBar';
import PollManager from '../components/host/PollManager';
import { SERVER_URL } from '../config';
import type { PollSummary } from '../types/poll';

interface Attendee {
  guestId: string;
  name: string;
  avatarSeed: string;
  status: 'fine' | 'lost';
  isOnline: boolean;
}

interface Resource {
  id: string;
  originalName: string;
  mimeType: string;
  publicUrl: string;
  description: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface LeaderboardEntry {
  guestId: string;
  name: string;
  totalPoints: number;
  correctAnswers: number;
  rank: number;
}

interface ConfusionUpdate {
  lostCount: number;
  total: number;
  percentage: number;
  timestamp: number;
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

type AppState = 'idle' | 'creating' | 'active';

export default function HostDashboard() {
  const navigate = useNavigate();

  // Persisted so the host dashboard survives page refresh
  const [roomCode, setRoomCode] = useLocalStorage<string>('synclass_host_room', '');
  const [appState, setAppState] = useLocalStorage<AppState>(
    'synclass_host_state',
    'idle'
  );

  const [joinCode, setJoinCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [notification, setNotification] = useState<{ name: string; question: string } | null>(null);

  // Data state
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [broadcasts, setBroadcasts] = useState<Array<{ content: string; type: string; sentAt: string }>>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastQuestionIndex, setLastQuestionIndex] = useState(-1);
  const [confusionData, setConfusionData] = useState<ConfusionUpdate | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(-1);
  const [quizAnswerCount, setQuizAnswerCount] = useState(0);
  const [quizCreated, setQuizCreated] = useState(false);
  const [quizQuestionCount, setQuizQuestionCount] = useState(0);
  const [attendanceLog, setAttendanceLog] = useState<Array<{ guestId: string; name: string }>>([]);
  const [askedQuestions, setAskedQuestions] = useState<number[]>([]);
  const [activePoll, setActivePoll] = useState<PollSummary | null>(null);
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', options: ['', '', '', ''], correctIndex: 0, timeLimit: 20 }
  ]);

  // ── Session Creation ────────────────────────────────
  const handleCreateRoom = async () => {
    setAppState('creating');
    try {
      const res = await fetch(`${SERVER_URL}/api/sessions`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setRoomCode(data.roomCode);
      setAppState('active');


      // Connect socket and register as host
      if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => {
          socket.emit('host_room', { roomCode: data.roomCode, sessionId: data.sessionId });
        });
      } else {
        socket.emit('host_room', { roomCode: data.roomCode, sessionId: data.sessionId });
      }
    } catch (err) {
      console.error('[host] createRoom error:', err);
      setAppState('idle');
    }
  };

  // ── Socket Connection Status + Reconnect on Refresh ──
  useEffect(() => {
    const handleRegisterHost = () => {
      if (roomCode && appState === 'active') {
        socket.emit('host_room', { roomCode });
      }
    };

    const onConnect = () => {
      setIsConnected(true);
      handleRegisterHost();
    };
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      setIsConnected(true);
      handleRegisterHost();
    } else if (roomCode && appState === 'active') {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomCode, appState]);

  // ── Fetch Restored Host State on Mount/Reconnect ──
  useEffect(() => {
    if (roomCode && appState === 'active') {
      const fetchHostState = async () => {
        try {
          const res = await fetch(`${SERVER_URL}/api/sessions/${roomCode}/host-state`);
          const data = await res.json();
          if (data.success) {
            setIsFrozen(data.isFrozen);
            setResources(data.resources || []);
            setBroadcasts(data.broadcasts || []);
            setActivePoll(data.poll || null);
            if (data.quiz) {
              setQuizCreated(true);
              setQuizQuestionCount(data.quiz.questionCount);
              setActiveQuestionIndex(data.quiz.activeQuestionIndex);
              setLeaderboard(data.quiz.scores || []);
              setAskedQuestions(data.quiz.askedQuestions || []);
              if (data.quiz.questions) {
                setQuestions(data.quiz.questions);
              }
            }
          }
        } catch (err) {
          console.error('[host] Error fetching restored host state:', err);
        }
      };
      fetchHostState();
    }
  }, [roomCode, appState]);

  useSocket('roster_update', useCallback(({ attendees: a }: { attendees: Attendee[] }) => {
    setAttendees(a);
  }, []));

  useSocket('hand_raised_notification', useCallback((data: { name: string; question: string }) => {
    setNotification(data);
  }, []));

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  useSocket('confusion_update', useCallback((data: ConfusionUpdate) => {
    setConfusionData(data);
  }, []));

  useSocket('question_end', useCallback(({ leaderboard: lb, questionIndex }: { leaderboard: LeaderboardEntry[]; questionIndex: number }) => {
    setLeaderboard(lb);
    setLastQuestionIndex(questionIndex);
    setActiveQuestionIndex(-1);
  }, []));

  useSocket('leaderboard_cleared', useCallback(({ leaderboard: lb }: { leaderboard: LeaderboardEntry[] }) => {
    setLeaderboard(lb);
  }, []));

  useSocket('answer_submitted_update', useCallback(({ count }: { count: number }) => {
    setQuizAnswerCount(count);
  }, []));

  useSocket('attendance_acknowledged', useCallback(({ guestId, name }: { guestId: string; name: string }) => {
    setAttendanceLog((prev) => {
      if (prev.some((a) => a.guestId === guestId)) return prev;
      return [...prev, { guestId, name }];
    });
  }, []));

  useSocket('poll_created', useCallback(({ poll }: { poll: PollSummary }) => {
    setActivePoll(poll);
  }, []));

  useSocket('poll_results_update', useCallback(({ poll }: { poll: PollSummary }) => {
    setActivePoll(poll);
  }, []));

  useSocket('poll_closed', useCallback(({ poll }: { poll: PollSummary }) => {
    setActivePoll(poll);
  }, []));

  useSocket('poll_error', useCallback(({ message }: { message: string }) => {
    alert(`Poll Error: ${message}`);
  }, []));

  // ── Host Actions ────────────────────────────────────
  const handleToggleFreeze = () => {
    const newState = !isFrozen;
    setIsFrozen(newState);
    socket.emit('toggle_freeze', { roomCode });
  };

  const handleBuzz = (guestIds: string[], buzzAll: boolean) => {
    socket.emit('buzz_users', { roomCode, guestIds, buzzAll });
  };

  const handleTriggerAttendance = () => {
    setAttendanceLog([]);
    socket.emit('trigger_attendance', { roomCode });
  };

  const handleKickUser = (guestId: string) => {
    socket.emit('kick_user', { roomCode, guestId });
  };

  const handleCreateQuiz = (questions: Array<{ text: string; options: string[]; correctIndex: number; timeLimit: number }>) => {
    socket.emit('create_quiz', { roomCode, questions });
  };

  useSocket('quiz_created', useCallback(({ questionCount }: { questionCount: number }) => {
    setQuizCreated(true);
    setQuizQuestionCount(questionCount);
  }, []));

  useSocket('quiz_reset_confirmed', useCallback(() => {
    setQuizCreated(false);
    setQuizQuestionCount(0);
    setActiveQuestionIndex(-1);
    setAskedQuestions([]);
  }, []));

  useSocket('quiz_error', useCallback(({ message }: { message: string }) => {
    alert(`Quiz Error: ${message}`);
  }, []));

  const handleLaunchQuestion = (index: number) => {
    setActiveQuestionIndex(index);
    setQuizAnswerCount(0);
    setAskedQuestions((prev) => prev.includes(index) ? prev : [...prev, index]);
    socket.emit('launch_question', { roomCode, questionIndex: index });
  };

  const handleShowScoreboard = () => {
    socket.emit('host_show_scoreboard', { roomCode });
  };

  const handleShowPodium = () => {
    socket.emit('host_show_podium', { roomCode });
  };

  const handleBroadcast = (content: string, contentType: 'code' | 'text') => {
    socket.emit('broadcast_snippet', { roomCode, content, contentType });
    setBroadcasts((prev) => [{ content, type: contentType, sentAt: new Date().toISOString() }, ...prev]);
  };

  const handleCreatePoll = (question: string, options: string[]) => {
    socket.emit('create_poll', { roomCode, question, options });
  };

  const handleClosePoll = () => {
    if (!activePoll) return;
    socket.emit('close_poll', { roomCode, pollId: activePoll.id });
  };

  const handleResourceUploaded = (resource: Resource) => {
    setResources((prev) => [resource, ...prev]);
  };

  const handlePushResource = (resourceId: string) => {
    socket.emit('push_resource', { roomCode, resourceId });
  };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end this session? All attendees will be disconnected, and files/data will be permanently deleted.')) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/sessions/${roomCode}/close`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (data.success) {
        setRoomCode('');
        setAppState('idle');
        setAttendees([]);
        setResources([]);
        setBroadcasts([]);
        setLeaderboard([]);
        setLastQuestionIndex(-1);
        setActiveQuestionIndex(-1);
        setQuizCreated(false);
        setQuizQuestionCount(0);
        setActivePoll(null);
        socket.disconnect();
      }
    } catch (err) {
      console.error('[host] Error ending session:', err);
    }
  };

  const handleLowerStudentHand = (guestId: string) => {
    socket.emit('lower_student_hand', { roomCode, guestId });
  };

  const handleLowerAllHands = () => {
    socket.emit('lower_all_hands', { roomCode });
  };

  const handleResetQuiz = () => {
    socket.emit('reset_quiz', { roomCode });
    setQuizCreated(false);
    setQuizQuestionCount(0);
    setActiveQuestionIndex(-1);
    setAskedQuestions([]);
  };

  const handleClearLeaderboard = () => {
    socket.emit('clear_leaderboard', { roomCode });
  };

  // ── Idle Screen ─────────────────────────────────────
  if (appState === 'idle' || appState === 'creating') {
    return (
      <div className="min-h-dvh bg-zinc-950 flex flex-col items-center justify-center p-6"
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 30%, rgba(124, 58, 237, 0.1) 0%, transparent 60%)' }}
      >
        <div className="max-w-md w-full text-center space-y-8 slide-up">
          {/* Logo / Brand */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center shadow-2xl shadow-violet-900/50 glow-violet">
                <Radio className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight">SynClass</h1>
              <p className="text-zinc-500 mt-1">Presenter Command Center</p>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              { emoji: '📊', label: 'Live confusion meter' },
              { emoji: '🎮', label: 'Kahoot-style quizzes' },
              { emoji: '📎', label: 'Instant file drops' },
              { emoji: '❄️', label: 'Screen freeze & buzz' },
              { emoji: '✅', label: 'Ad-hoc attendance' },
              { emoji: '💬', label: 'Code broadcasting' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <span className="text-lg">{f.emoji}</span>
                <span className="text-xs text-zinc-400 font-medium">{f.label}</span>
              </div>
            ))}
          </div>

          {/* CTA / Actions */}
          <div className="space-y-6">
            <button
              id="create-room-btn"
              onClick={handleCreateRoom}
              disabled={appState === 'creating'}
              className="btn-primary btn-lg w-full text-base"
              style={{ boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.3), 0 16px 48px rgba(124, 58, 237, 0.3)' }}
            >
              {appState === 'creating' ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Creating room…</>
              ) : (
                <><Plus className="w-5 h-5" />Create Room (Host)</>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-900"></div>
              <span className="flex-shrink mx-4 text-zinc-600 text-xs uppercase font-bold tracking-widest">or</span>
              <div className="flex-grow border-t border-zinc-900"></div>
            </div>

            <div className="card p-5 space-y-4"
              style={{ boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.05)' }}
            >
              <div className="space-y-2 text-left">
                <label htmlFor="join-room-code" className="section-title text-zinc-400">
                  Join as Attendee
                </label>
                <div className="flex gap-2">
                  <input
                    id="join-room-code"
                    type="text"
                    placeholder="Enter 6-char code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    className="input font-mono tracking-widest text-center text-lg py-2.5 flex-1"
                    maxLength={6}
                  />
                  <button
                    onClick={() => navigate(`/room/${joinCode.toUpperCase()}`)}
                    disabled={joinCode.length < 6}
                    className="btn-secondary whitespace-nowrap px-5"
                  >
                    Join Room
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-700">Connects to MongoDB · Real-time via Socket.io</p>
        </div>
      </div>
    );
  }

  // ── Active Dashboard ────────────────────────────────
  return (
    <div className="h-dvh bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top nav */}
      <header className="shrink-0 border-b border-zinc-900 px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-zinc-300">SynClass</span>
          </div>
          <RoomHeader
            roomCode={roomCode}
            attendeeCount={attendees.filter((a) => a.isOnline).length}
            isConnected={isConnected}
          />
          <ControlBar
            isFrozen={isFrozen}
            onToggleFreeze={handleToggleFreeze}
            onBuzzAll={() => handleBuzz([], true)}
            onEndSession={handleEndSession}
            attendeeCount={attendees.filter((a) => a.isOnline).length}
          />
        </div>
      </header>

      {/* Main grid */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(280px,0.9fr)_minmax(410px,1.35fr)_minmax(300px,0.95fr)] gap-3 p-3 overflow-auto lg:overflow-hidden">
        {/* ─ Left Column ─────────────────────────── */}
        <div className="lg:col-span-1 min-h-0 grid grid-rows-[minmax(0,1fr)_150px] gap-3">
          <AttendeeRoster
            attendees={attendees}
            onBuzz={handleBuzz}
            onTriggerAttendance={handleTriggerAttendance}
            onLowerHand={handleLowerStudentHand}
            onLowerAllHands={handleLowerAllHands}
            onKickUser={handleKickUser}
            attendanceLog={attendanceLog}
          />
          <ConfusionMeter latest={confusionData} />
        </div>

        {/* ─ Middle Column ───────────────────────── */}
        <div className="lg:col-span-1 min-h-0 grid grid-rows-[minmax(0,1fr)_minmax(132px,0.38fr)] gap-3">
          <QuizManager
            questions={questions}
            setQuestions={setQuestions}
            onCreateQuiz={handleCreateQuiz}
            onLaunchQuestion={handleLaunchQuestion}
            onResetQuiz={handleResetQuiz}
            onClearLeaderboard={handleClearLeaderboard}
            quizCreated={quizCreated}
            questionCount={quizQuestionCount}
            activeQuestionIndex={activeQuestionIndex}
            askedQuestions={askedQuestions}
            quizAnswerCount={quizAnswerCount}
            onShowScoreboard={handleShowScoreboard}
            onShowPodium={handleShowPodium}
            roomCode={roomCode}
          />
          <Leaderboard
            entries={leaderboard}
            questionIndex={lastQuestionIndex}
          />
        </div>

        {/* ─ Right Column ────────────────────────── */}
        <div className="lg:col-span-1 min-h-0 grid grid-rows-[minmax(225px,1.05fr)_minmax(205px,0.95fr)_minmax(160px,0.75fr)] gap-3">
          <PollManager
            activePoll={activePoll}
            onCreatePoll={handleCreatePoll}
            onClosePoll={handleClosePoll}
          />
          <BroadcastPanel
            onBroadcast={handleBroadcast}
            recentBroadcasts={broadcasts}
          />
          <ResourceManager
            roomCode={roomCode}
            resources={resources}
            onResourceUploaded={handleResourceUploaded}
            onPushResource={handlePushResource}
          />
        </div>
      </main>

      {/* Toast Notification for Handraise */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-zinc-900 border border-violet-850 rounded-xl p-4 shadow-2xl shadow-violet-900/10 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shrink-0 shadow-lg glow-violet animate-bounce">
              <Hand className="w-4 h-4 fill-current" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-100">{notification.name} raised hand!</p>
              {notification.question ? (
                <p className="text-xs text-zinc-400 mt-1 bg-zinc-950/40 p-2 rounded border border-zinc-800 break-words">
                  "{notification.question}"
                </p>
              ) : (
                <p className="text-xs text-zinc-500 mt-0.5">No text question provided.</p>
              )}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 btn-ghost rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
