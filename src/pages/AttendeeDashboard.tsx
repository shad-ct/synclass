/**
 * @fileoverview AttendeeDashboard — Active session view for attendees.
 * Manages all overlay states (freeze, buzz, quiz, snippet, resource, attendance).
 * The ConfusionToggle is always anchored at the bottom.
 */
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, LogOut, Hand, X } from 'lucide-react';
import { socket } from '../socket';
import useSocket from '../hooks/useSocket';
import useLocalStorage from '../hooks/useLocalStorage';
import FreezeOverlay from '../components/attendee/FreezeOverlay';
import BuzzAlert from '../components/attendee/BuzzAlert';
import AttendanceModal from '../components/attendee/AttendanceModal';
import SnippetOverlay from '../components/attendee/SnippetOverlay';
import ResourceToast from '../components/attendee/ResourceToast';
import QuizQuestion from '../components/attendee/QuizQuestion';
import ConfusionToggle from '../components/attendee/ConfusionToggle';
import Avatar from 'boring-avatars';
const AvatarComponent = (Avatar as any).default || Avatar;

const AVATAR_PALETTE = ['#18181b', '#3f3f46', '#7c3aed', '#a78bfa', '#f4f4f5'];

interface GuestProfile {
  guestId: string;
  name: string;
  avatarSeed: string;
  roomCode: string;
}

interface ActiveQuestion {
  questionIndex: number;
  text: string;
  options: string[];
  secondsLeft: number;
  timeLimit: number;
}

interface AnswerResult {
  isCorrect: boolean;
  correctIndex: number;
  pointsAwarded: number;
  rank?: number;
  totalPlayers?: number;
  currentTotal?: number;
}

interface LeaderboardEntry {
  guestId: string;
  name: string;
  avatarSeed: string;
  totalPoints: number;
  correctAnswers: number;
  rank: number;
}

interface Resource {
  id: string;
  originalName: string;
  mimeType: string;
  publicUrl: string;
  description: string;
  sizeBytes: number;
}

export default function AttendeeDashboard() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [guest] = useLocalStorage<GuestProfile | null>('synclass_guest', null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Overlay states
  const [isFrozen, setIsFrozen] = useState(false);
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [attendancePing, setAttendancePing] = useState<{ logId: string; timeoutMs: number } | null>(null);
  const [snippet, setSnippet] = useState<{ content: string; contentType: 'code' | 'text'; sentAt: string } | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [showQuizFeedback, setShowQuizFeedback] = useState(false);
  const [scoreboardData, setScoreboardData] = useState<{ leaderboard: LeaderboardEntry[] } | null>(null);
  const [podiumData, setPodiumData] = useState<{ leaderboard: LeaderboardEntry[] } | null>(null);
  const [currentRankInfo, setCurrentRankInfo] = useState<{ rank: number; totalPlayers: number; totalPoints: number } | null>(null);

  // Handraise states
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [handRaiseQuestion, setHandRaiseQuestion] = useState('');
  const [showHandraiseModal, setShowHandraiseModal] = useState(false);
  const [tempQuestion, setTempQuestion] = useState('');

  // Ensure socket is connected and join the room (with auto-rejoin on reconnect)
  useEffect(() => {
    if (!guest || guest.roomCode !== roomCode?.toUpperCase()) {
      navigate(`/room/${roomCode}`, { replace: true });
      return;
    }

    const handleJoin = () => {
      socket.emit('join_room', {
        roomCode: roomCode?.toUpperCase(),
        guestId: guest.guestId,
        name: guest.name,
        avatarSeed: guest.avatarSeed,
      });
    };

    const onConnect = () => {
      setIsConnected(true);
      handleJoin();
    };
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      setIsConnected(true);
      handleJoin();
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [guest, roomCode, navigate]);

  // Socket event subscriptions
  useSocket('hand_state_changed', useCallback((data: { isHandRaised: boolean; handRaiseQuestion: string }) => {
    setIsHandRaised(data.isHandRaised);
    setHandRaiseQuestion(data.handRaiseQuestion);
    if (!data.isHandRaised) {
      setShowHandraiseModal(false);
      setTempQuestion('');
    }
  }, []));

  useSocket('join_confirmed', useCallback((data: { isFrozen: boolean; isHandRaised?: boolean; handRaiseQuestion?: string }) => {
    setIsFrozen(data.isFrozen);
    if (data.isHandRaised !== undefined) {
      setIsHandRaised(data.isHandRaised);
      setHandRaiseQuestion(data.handRaiseQuestion || '');
      if (!data.isHandRaised) {
        setShowHandraiseModal(false);
        setTempQuestion('');
      }
    }
  }, []));

  useSocket('session_ended', useCallback(() => {
    alert('This session has been ended by the presenter.');
    socket.disconnect();
    navigate('/', { replace: true });
  }, [navigate]));

  useSocket('kicked', useCallback(() => {
    alert('You have been removed from this session by the host.');
    socket.disconnect();
    navigate('/', { replace: true });
  }, [navigate]));

  useSocket('freeze_update', useCallback(({ isFrozen: f }: { isFrozen: boolean }) => {
    setIsFrozen(f);
  }, []));

  useSocket('receive_buzz', useCallback(() => {
    setIsBuzzed(true);
  }, []));

  useSocket('attendance_ping', useCallback(({ logId, timeoutMs }: { logId: string; timeoutMs: number }) => {
    setAttendancePing({ logId, timeoutMs });
  }, []));

  useSocket('attendance_closed', useCallback(() => {
    setAttendancePing(null);
  }, []));

  useSocket('receive_snippet', useCallback((data: { content: string; contentType: 'code' | 'text'; sentAt: string }) => {
    setSnippet(data);
  }, []));

  useSocket('receive_resource', useCallback((data: Resource) => {
    setResource(data);
  }, []));

  useSocket('question_start', useCallback((data: { questionIndex: number; text: string; options: string[]; timeLimit: number; secondsLeft: number }) => {
    setActiveQuestion({ ...data });
    setHasAnswered(false);
    setAnswerResult(null);
    setShowQuizFeedback(false);
    setScoreboardData(null);
    setPodiumData(null);
    setCurrentRankInfo(null);
  }, []));

  useSocket('time_tick', useCallback(({ secondsLeft, questionIndex }: { secondsLeft: number; questionIndex: number }) => {
    setActiveQuestion((prev) => {
      if (!prev || prev.questionIndex !== questionIndex) return prev;
      return { ...prev, secondsLeft };
    });
  }, []));

  useSocket('question_end', useCallback(() => {
    setShowQuizFeedback(true);
    setTimeout(() => {
      setActiveQuestion(null);
      setAnswerResult(null);
      setHasAnswered(false);
      setShowQuizFeedback(false);
    }, 4000);
  }, []));

  useSocket('answer_received', useCallback((data: AnswerResult) => {
    setAnswerResult(data);
    setHasAnswered(true);
    if (data.rank !== undefined) {
      setCurrentRankInfo({
        rank: data.rank,
        totalPlayers: data.totalPlayers || 1,
        totalPoints: data.currentTotal || 0,
      });
    }
  }, []));

  useSocket('show_scoreboard', useCallback((data: { leaderboard: LeaderboardEntry[] }) => {
    setActiveQuestion(null);
    setAnswerResult(null);
    setHasAnswered(false);
    setShowQuizFeedback(false);
    setScoreboardData(data);
    setPodiumData(null);
  }, []));

  useSocket('show_podium', useCallback((data: { leaderboard: LeaderboardEntry[] }) => {
    setActiveQuestion(null);
    setAnswerResult(null);
    setHasAnswered(false);
    setShowQuizFeedback(false);
    setScoreboardData(null);
    setPodiumData(data);
  }, []));

  useSocket('quiz_reset', useCallback(() => {
    setActiveQuestion(null);
    setAnswerResult(null);
    setHasAnswered(false);
    setShowQuizFeedback(false);
    setScoreboardData(null);
    setPodiumData(null);
    setCurrentRankInfo(null);
  }, []));

  const handleAcknowledge = (logId: string) => {
    socket.emit('mark_attendance', {
      roomCode: roomCode?.toUpperCase(),
      guestId: guest?.guestId,
      name: guest?.name,
      logId,
    });
    setTimeout(() => setAttendancePing(null), 1500);
  };

  const handleSubmitAnswer = (selectedOption: number) => {
    if (!activeQuestion || !guest) return;
    socket.emit('submit_answer', {
      roomCode: roomCode?.toUpperCase(),
      guestId: guest.guestId,
      name: guest.name,
      questionIndex: activeQuestion.questionIndex,
      selectedOption,
    });
    setHasAnswered(true);
  };

  const handleStatusChange = (status: 'fine' | 'lost') => {
    socket.emit('update_understanding_status', {
      roomCode: roomCode?.toUpperCase(),
      guestId: guest?.guestId,
      status,
    });
  };

  const handleToggleHandraise = () => {
    if (isHandRaised) {
      socket.emit('lower_hand', {
        roomCode: roomCode?.toUpperCase(),
        guestId: guest?.guestId,
      });
    } else {
      setTempQuestion('');
      setShowHandraiseModal(true);
    }
  };

  const handleRaiseHandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    socket.emit('raise_hand', {
      roomCode: roomCode?.toUpperCase(),
      guestId: guest?.guestId,
      question: tempQuestion,
    });
    setShowHandraiseModal(false);
  };

  const handleLeave = () => {
    socket.disconnect();
    navigate('/', { replace: true });
  };

  const handleCloseOverlay = () => {
    setScoreboardData(null);
    setPodiumData(null);
  };

  return (
    <div className="min-h-dvh bg-zinc-950 flex flex-col"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 100%, rgba(124, 58, 237, 0.05) 0%, transparent 70%)' }}
    >
      {/* Status bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-sm font-mono font-bold text-zinc-400 tracking-widest">
            {roomCode?.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isConnected
            ? <Wifi className="w-4 h-4 text-emerald-500" />
            : <WifiOff className="w-4 h-4 text-red-500 animate-pulse" />}
          
          {guest && (
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-lg">
              <div className="relative rounded-full overflow-hidden shrink-0 ring-1 ring-zinc-700">
                <AvatarComponent
                  size={20}
                  name={guest.avatarSeed.split(':').slice(1).join(':') || guest.name}
                  variant={guest.avatarSeed.split(':')[0] as any || 'beam'}
                  colors={AVATAR_PALETTE}
                />
              </div>
              <span className="text-xs text-zinc-300 font-medium max-w-[100px] truncate">{guest.name}</span>
            </div>
          )}
          
          <button onClick={handleLeave} className="btn-ghost p-1.5 rounded" title="Leave Session">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
        {scoreboardData ? (
          <div className="w-full max-w-md mx-auto space-y-6 py-4 animate-in fade-in duration-300 relative">
            <button
              onClick={handleCloseOverlay}
              className="absolute top-0 right-0 p-2 text-zinc-500 hover:text-zinc-300 rounded-full hover:bg-zinc-900/50 transition-colors cursor-pointer select-none"
              title="Close Leaderboard"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Scoreboard</span>
              <h2 className="text-2xl font-black text-white">Current Standings</h2>
            </div>

            {currentRankInfo && (
              <div className="bg-gradient-to-r from-violet-900/30 to-fuchsia-900/30 border border-violet-500/20 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-650 flex items-center justify-center text-white text-xl font-bold">
                    #{currentRankInfo.rank}
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Your Position</p>
                    <p className="text-sm font-extrabold text-white">Rank {currentRankInfo.rank} of {currentRankInfo.totalPlayers}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Points</p>
                  <p className="text-lg font-black text-violet-400 font-mono">{currentRankInfo.totalPoints}</p>
                </div>
              </div>
            )}

            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 space-y-2.5 shadow-inner w-full">
              {scoreboardData.leaderboard.slice(0, 5).map((entry, idx) => {
                const isMe = entry.guestId === guest?.guestId;
                const isTop3 = idx < 3;
                const medalColors = [
                  'bg-amber-400 text-zinc-950 border-amber-300',
                  'bg-zinc-400 text-zinc-950 border-zinc-300',
                  'bg-amber-700 text-white border-amber-600'
                ];

                return (
                  <div
                    key={entry.guestId}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all duration-200
                      ${isMe
                        ? 'bg-violet-950/20 border-violet-500/40 shadow-md shadow-violet-950/30'
                        : 'bg-zinc-900/50 border-zinc-850/60'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isTop3 ? (
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-black text-[10px] ${medalColors[idx]}`}>
                          {idx + 1}
                        </div>
                      ) : (
                        <div className="w-6 h-6 flex items-center justify-center font-bold text-zinc-500 text-xs font-mono">
                          {idx + 1}
                        </div>
                      )}

                      <div className="relative rounded-full overflow-hidden shrink-0 ring-1 ring-zinc-700">
                        <AvatarComponent
                          size={28}
                          name={entry.avatarSeed?.split(':')?.slice(1)?.join(':') || entry.name}
                          variant={entry.avatarSeed?.split(':')?.[0] as any || 'beam'}
                          colors={AVATAR_PALETTE}
                        />
                      </div>

                      <span className={`text-sm font-bold truncate ${isMe ? 'text-violet-350' : 'text-zinc-200'}`}>
                        {entry.name} {isMe && <span className="text-[10px] text-violet-400 font-normal font-sans ml-1">(You)</span>}
                      </span>
                    </div>

                    <span className="text-sm font-black text-violet-400 font-mono">
                      {entry.totalPoints}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : podiumData ? (
          <div className="w-full max-w-md mx-auto space-y-8 py-4 animate-in zoom-in-95 duration-500 relative">
            <button
              onClick={handleCloseOverlay}
              className="absolute top-0 right-0 p-2 text-zinc-500 hover:text-zinc-300 rounded-full hover:bg-zinc-900/50 transition-colors cursor-pointer select-none"
              title="Close Podium"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Congratulations! 🏆</span>
              <h2 className="text-3xl font-black text-white">Final Podium</h2>
            </div>

            <div className="flex items-end justify-center gap-3 min-h-[200px] pb-2 pt-6">
              {podiumData.leaderboard[1] && podiumData.leaderboard[1].totalPoints > 0 ? (
                <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom-20 duration-700 delay-200">
                  <div className="relative rounded-full overflow-hidden border-2 border-zinc-400 bg-zinc-900 shadow-lg scale-90 mb-1.5 shrink-0">
                    <AvatarComponent
                      size={44}
                      name={podiumData.leaderboard[1].avatarSeed?.split(':')?.slice(1)?.join(':') || podiumData.leaderboard[1].name}
                      variant={podiumData.leaderboard[1].avatarSeed?.split(':')?.[0] as any || 'beam'}
                      colors={AVATAR_PALETTE}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-zinc-300 truncate max-w-full text-center px-0.5">
                    {podiumData.leaderboard[1].name}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-bold font-mono mb-1">
                    {podiumData.leaderboard[1].totalPoints} pts
                  </span>
                  <div className="w-full bg-gradient-to-b from-zinc-500/30 to-zinc-700/10 border border-zinc-500/20 rounded-t-2xl flex flex-col items-center justify-center h-20 shadow-md">
                    <span className="text-2xl font-black text-zinc-300">2</span>
                  </div>
                </div>
              ) : (
                <div className="w-1/3" />
              )}

              {podiumData.leaderboard[0] && podiumData.leaderboard[0].totalPoints > 0 ? (
                <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom-28 duration-700">
                  <div className="relative mb-1 shrink-0">
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl animate-bounce">👑</div>
                    <div className="relative rounded-full overflow-hidden border-4 border-amber-400 bg-zinc-900 shadow-xl scale-105 mb-1">
                      <AvatarComponent
                        size={52}
                        name={podiumData.leaderboard[0].avatarSeed?.split(':')?.slice(1)?.join(':') || podiumData.leaderboard[0].name}
                        variant={podiumData.leaderboard[0].avatarSeed?.split(':')?.[0] as any || 'beam'}
                        colors={AVATAR_PALETTE}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-white truncate max-w-full text-center px-0.5">
                    {podiumData.leaderboard[0].name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-black font-mono mb-1">
                    {podiumData.leaderboard[0].totalPoints} pts
                  </span>
                  <div className="w-full bg-gradient-to-b from-amber-500/30 to-amber-700/10 border border-amber-500/20 rounded-t-2xl flex flex-col items-center justify-center h-28 shadow-lg">
                    <span className="text-3xl font-black text-amber-400">1</span>
                  </div>
                </div>
              ) : (
                <div className="w-1/3" />
              )}

              {podiumData.leaderboard[2] && podiumData.leaderboard[2].totalPoints > 0 ? (
                <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom-16 duration-700 delay-300">
                  <div className="relative rounded-full overflow-hidden border border-amber-800 bg-zinc-900 shadow-md scale-85 mb-2 shrink-0">
                    <AvatarComponent
                      size={36}
                      name={podiumData.leaderboard[2].avatarSeed?.split(':')?.slice(1)?.join(':') || podiumData.leaderboard[2].name}
                      variant={podiumData.leaderboard[2].avatarSeed?.split(':')?.[0] as any || 'beam'}
                      colors={AVATAR_PALETTE}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-zinc-300 truncate max-w-full text-center px-0.5">
                    {podiumData.leaderboard[2].name}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-bold font-mono mb-1">
                    {podiumData.leaderboard[2].totalPoints} pts
                  </span>
                  <div className="w-full bg-gradient-to-b from-amber-800/30 to-amber-950/10 border border-amber-800/20 rounded-t-2xl flex flex-col items-center justify-center h-14 shadow-sm">
                    <span className="text-xl font-black text-amber-700">3</span>
                  </div>
                </div>
              ) : (
                <div className="w-1/3" />
              )}
            </div>

            {currentRankInfo && (
              <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 text-center space-y-1 w-full">
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Your Final Result</p>
                <p className="text-lg font-black text-zinc-200">
                  You finished in <span className="text-amber-400">#{currentRankInfo.rank}</span> place!
                </p>
                <p className="text-xs font-semibold text-violet-400 font-mono">{currentRankInfo.totalPoints} points total</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-xs">
            <div className="text-5xl">👋</div>
            <h1 className="text-xl font-bold text-zinc-100">
              Welcome, {guest?.name}!
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              You're connected to session{' '}
              <span className="font-mono font-bold text-zinc-300">{roomCode?.toUpperCase()}</span>.
              <br />
              Your presenter will take it from here.
            </p>

            <div className="flex flex-col gap-2 text-sm text-zinc-600">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Waiting for presenter…
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Persistent Overlays ────────────────────────── */}
      {/* Must be highest z-index to always appear on top */}
      <FreezeOverlay isVisible={isFrozen} />

      <BuzzAlert isVisible={isBuzzed} onDismiss={() => setIsBuzzed(false)} />

      {attendancePing && (
        <AttendanceModal
          isVisible={true}
          logId={attendancePing.logId}
          timeoutMs={attendancePing.timeoutMs}
          onAcknowledge={handleAcknowledge}
        />
      )}

      {snippet && (
        <SnippetOverlay
          isVisible={true}
          content={snippet.content}
          contentType={snippet.contentType}
          sentAt={snippet.sentAt}
          onDismiss={() => setSnippet(null)}
        />
      )}

      <ResourceToast
        resource={resource}
        onDismiss={() => setResource(null)}
      />

      {activeQuestion && (
        <QuizQuestion
          questionIndex={activeQuestion.questionIndex}
          text={activeQuestion.text}
          options={activeQuestion.options}
          secondsLeft={activeQuestion.secondsLeft}
          timeLimit={activeQuestion.timeLimit}
          hasAnswered={hasAnswered}
          answerResult={answerResult}
          onSubmit={handleSubmitAnswer}
          showFeedback={showQuizFeedback}
        />
      )}

      {/* Confusion toggle - always at bottom, above everything except critical overlays */}
      <ConfusionToggle onStatusChange={handleStatusChange} />

      {/* Handraise Button */}
      <button
        id="toggle-handraise-btn"
        onClick={handleToggleHandraise}
        className={`fixed bottom-6 right-6 z-[60] w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 cursor-pointer select-none
          ${isHandRaised
            ? 'bg-violet-600 text-white shadow-violet-900/50 glow-violet animate-pulse'
            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
        title={isHandRaised ? (handRaiseQuestion ? `Lower hand (Asked: "${handRaiseQuestion}")` : 'Lower your hand') : 'Raise your hand'}
      >
        <Hand className="w-5 h-5" />
      </button>

      {/* Handraise Modal */}
      {showHandraiseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="card max-w-sm w-full p-6 space-y-4 relative"
            style={{ boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.1), 0 32px 64px rgba(0,0,0,0.5)' }}
          >
            <button
              onClick={() => setShowHandraiseModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 btn-ghost p-1"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-950 border border-violet-850 flex items-center justify-center text-violet-400 shrink-0">
                <Hand className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-200">Raise Hand</h3>
                <p className="text-xs text-zinc-500">Ask the presenter a question (optional)</p>
              </div>
            </div>
            <form onSubmit={handleRaiseHandSubmit} className="space-y-4">
              <textarea
                placeholder="Type your question here..."
                value={tempQuestion}
                onChange={(e) => setTempQuestion(e.target.value)}
                maxLength={200}
                className="input min-h-[80px] text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowHandraiseModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Raise Hand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
