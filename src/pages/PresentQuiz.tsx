/**
 * @fileoverview PresentQuiz — Public presentation view of the quiz.
 * Designed to be opened in a new tab and presented/projected to the audience.
 *
 * Views:
 * - Lobby: Room info, QR Code, and floating physics-based attendee bubbles
 * - Question: Active countdown, question text, option labels, real-time submission counter
 * - Results: Option counts bar chart, correct option checkmark
 * - Scoreboard: Top player ranking leaderboard list
 * - Podium: 3D pedestal (1st, 2nd, 3rd) with player avatars and falling confetti rain
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, AlertCircle, Loader2 } from 'lucide-react';
import Avatar from 'boring-avatars';
import QRCode from 'react-qr-code';
import { socket } from '../socket';
import useSocket from '../hooks/useSocket';

const getValidComponent = (val: any): any => {
  if (!val) return null;
  
  const isValid = (x: any) => {
    if (!x) return false;
    if (typeof x === 'function' || typeof x === 'string') return true;
    if (typeof x === 'object' && (x.$$typeof || typeof x.render === 'function')) return true;
    return false;
  };

  if (isValid(val)) return val;
  if (val.default && isValid(val.default)) return val.default;
  if (val.QRCode && isValid(val.QRCode)) return val.QRCode;
  if (val.default && val.default.default && isValid(val.default.default)) return val.default.default;
  if (val.default && val.default.QRCode && isValid(val.default.QRCode)) return val.default.QRCode;
  
  return val;
};

const AvatarComponent = getValidComponent(Avatar);
const QRCodeComponent = getValidComponent(QRCode);

const playTickSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    console.error('Audio error:', e);
  }
};

const playFinalTickSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    console.error('Audio error:', e);
  }
};



interface Attendee {
  guestId: string;
  name: string;
  avatarSeed: string;
  isOnline: boolean;
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

interface LeaderboardEntry {
  guestId: string;
  name: string;
  avatarSeed: string;
  totalPoints: number;
  correctAnswers: number;
  rank: number;
}

interface QuizState {
  activeIndex: number;
  secondsLeft: number;
  questions: Question[];
  scores: LeaderboardEntry[];
  currentView: 'lobby' | 'question' | 'results' | 'scoreboard' | 'podium';
  correctIndex: number;
  optionCounts: number[];
}

const AVATAR_PALETTE = ['#18181b', '#3f3f46', '#7c3aed', '#a78bfa', '#f4f4f5'];
const OPTION_CLASSES = [
  { bg: 'from-red-600 to-rose-600 border-red-500 shadow-red-950/20', symbol: '▲', colorName: 'Red' },
  { bg: 'from-blue-600 to-indigo-600 border-blue-500 shadow-blue-950/20', symbol: '◆', colorName: 'Blue' },
  { bg: 'from-amber-500 to-yellow-500 border-amber-400 shadow-amber-950/20', symbol: '●', colorName: 'Yellow' },
  { bg: 'from-emerald-600 to-green-600 border-emerald-500 shadow-emerald-950/20', symbol: '■', colorName: 'Green' },
];

interface PhysicsBubble {
  id: string;
  name: string;
  avatarSeed: string;
  avatarVariant: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
}

export default function PresentQuiz() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const [roomStatus, setRoomStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [lastQuestionIndex, setLastQuestionIndex] = useState(-1);
  const [resultsCountdown, setResultsCountdown] = useState(5);

  // Core quiz state
  const [quizState, setQuizState] = useState<QuizState>({
    activeIndex: -1,
    secondsLeft: 0,
    questions: [],
    scores: [],
    currentView: 'lobby',
    correctIndex: -1,
    optionCounts: [],
  });

  // Physics animation loop refs
  const playgroundRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<PhysicsBubble[]>([]);
  const domRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const animationFrameId = useRef<number | null>(null);

  // Confetti canvas ref
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  // Validate room exists on mount
  useEffect(() => {
    if (!roomCode) {
      setRoomStatus('invalid');
      return;
    }

    const validate = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/api/sessions/${roomCode}`
        );
        const data = await res.json();
        if (!data.success) {
          setRoomStatus('invalid');
        } else {
          setRoomStatus('valid');
          // Connect socket if not connected
          if (!socket.connected) {
            socket.connect();
          }
          // Join the presentation room
          socket.emit('join_presentation', { roomCode: roomCode.toUpperCase() });
        }
      } catch {
        setRoomStatus('invalid');
      }
    };

    validate();
  }, [roomCode]);

  // Monitor socket connections
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      if (roomCode) {
        socket.emit('join_presentation', { roomCode: roomCode.toUpperCase() });
      }
    };
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomCode]);

  // Handle countdown with tick sounds when results screen is active
  useEffect(() => {
    if (quizState.currentView !== 'results') {
      setResultsCountdown(5);
      return;
    }

    // Play initial tick sound
    playTickSound();

    const intervalId = setInterval(() => {
      setResultsCountdown((prev) => {
        const next = prev - 1;
        if (next > 0) {
          playTickSound();
        } else if (next === 0) {
          playFinalTickSound();
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [quizState.currentView]);

  useSocket('presentation_state', useCallback((state: { attendees: Attendee[]; quizState: (QuizState & { lastQuestionIndex?: number }) | null }) => {
    setAttendees(state.attendees);
    if (state.quizState) {
      setQuizState(state.quizState);
      if (state.quizState.lastQuestionIndex !== undefined) {
        setLastQuestionIndex(state.quizState.lastQuestionIndex);
      } else if (state.quizState.activeIndex >= 0) {
        setLastQuestionIndex(state.quizState.activeIndex);
      }
    }
  }, []));

  useSocket('roster_update', useCallback(({ attendees: list }: { attendees: Attendee[] }) => {
    setAttendees(list);
  }, []));

  useSocket('question_start', useCallback((data: { questionIndex: number; text: string; options: string[]; timeLimit: number; secondsLeft: number }) => {
    setAnswerCount(0);
    setLastQuestionIndex(data.questionIndex);
    setQuizState((prev) => {
      // Create copy of questions if we need to
      const updatedQs = [...prev.questions];
      if (!updatedQs[data.questionIndex]) {
        updatedQs[data.questionIndex] = {
          text: data.text,
          options: data.options,
          correctIndex: -1,
          timeLimit: data.timeLimit,
        };
      }
      return {
        ...prev,
        activeIndex: data.questionIndex,
        secondsLeft: data.secondsLeft,
        questions: updatedQs,
        currentView: 'question',
        correctIndex: -1,
        optionCounts: [],
      };
    });
  }, []));

  useSocket('time_tick', useCallback(({ secondsLeft, questionIndex }: { secondsLeft: number; questionIndex: number }) => {
    setQuizState((prev) => {
      if (prev.activeIndex !== questionIndex) return prev;
      return { ...prev, secondsLeft };
    });
  }, []));

  useSocket('answer_submitted_update', useCallback(({ count }: { count: number }) => {
    setAnswerCount(count);
  }, []));

  useSocket('question_end', useCallback((data: { questionIndex: number; correctIndex: number; leaderboard: LeaderboardEntry[]; optionCounts: number[] }) => {
    setLastQuestionIndex(data.questionIndex);
    setQuizState((prev) => {
      const updatedQs = [...prev.questions];
      if (updatedQs[data.questionIndex]) {
        updatedQs[data.questionIndex].correctIndex = data.correctIndex;
      }
      return {
        ...prev,
        activeIndex: -1,
        correctIndex: data.correctIndex,
        scores: data.leaderboard,
        optionCounts: data.optionCounts,
        currentView: 'results',
        questions: updatedQs,
      };
    });
  }, []));

  useSocket('show_scoreboard', useCallback((data: { leaderboard: LeaderboardEntry[] }) => {
    setQuizState((prev) => ({
      ...prev,
      scores: data.leaderboard,
      currentView: 'scoreboard',
    }));
  }, []));

  useSocket('show_podium', useCallback((data: { leaderboard: LeaderboardEntry[] }) => {
    setQuizState((prev) => ({
      ...prev,
      scores: data.leaderboard,
      currentView: 'podium',
    }));
  }, []));

  useSocket('leaderboard_cleared', useCallback((data: { leaderboard: LeaderboardEntry[] }) => {
    setQuizState((prev) => ({
      ...prev,
      scores: data.leaderboard,
    }));
  }, []));

  useSocket('quiz_reset', useCallback(() => {
    setQuizState({
      activeIndex: -1,
      secondsLeft: 0,
      questions: [],
      scores: [],
      currentView: 'lobby',
      correctIndex: -1,
      optionCounts: [],
    });
    setLastQuestionIndex(-1);
    setResultsCountdown(5);
  }, []));

  useSocket('session_ended', useCallback(() => {
    alert('This session has been ended by the presenter.');
    navigate('/', { replace: true });
  }, [navigate]));

  // ── Physics Engine for floating player bubbles ────────
  useEffect(() => {
    if (quizState.currentView !== 'lobby' || roomStatus !== 'valid') {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      return;
    }

    // Sync attendees list with physics list
    const currentBubbles = [...bubblesRef.current];
    const onlineAttendees = attendees.filter((a) => a.isOnline);

    // Remove offline bubbles
    const filteredBubbles = currentBubbles.filter((bubble) =>
      onlineAttendees.some((att) => att.guestId === bubble.id)
    );

    // Add new bubbles
    const radius = 55; // 110px diameter bubble
    const mass = 1;
    const padding = 15;

    const newBubbles = onlineAttendees
      .filter((att) => !filteredBubbles.some((b) => b.id === att.guestId))
      .map((att) => {
        const width = playgroundRef.current?.clientWidth || 800;
        const height = playgroundRef.current?.clientHeight || 500;

        // Prefill variant and seed from DB avatarSeed
        const parts = att.avatarSeed.split(':');
        const variant = parts.length > 1 ? parts[0] : 'beam';
        const seed = parts.length > 1 ? parts.slice(1).join(':') : att.avatarSeed;

        // Spawn centered with slight random offset
        const x = width / 2 + (Math.random() - 0.5) * 100;
        const y = height / 2 + (Math.random() - 0.5) * 100;

        // Gentle random initial velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.0;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        return {
          id: att.guestId,
          name: att.name,
          avatarSeed: seed,
          avatarVariant: variant,
          x,
          y,
          vx,
          vy,
          radius,
          mass,
        };
      });

    bubblesRef.current = [...filteredBubbles, ...newBubbles];

    // Physics Update Loop
    const updatePhysics = () => {
      const container = playgroundRef.current;
      if (!container) {
        animationFrameId.current = requestAnimationFrame(updatePhysics);
        return;
      }

      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) {
        animationFrameId.current = requestAnimationFrame(updatePhysics);
        return;
      }

      const list = bubblesRef.current;
      const len = list.length;

      // 1. Move and check bounds
      for (let i = 0; i < len; i++) {
        const b = list[i];
        b.x += b.vx;
        b.y += b.vy;

        // Container bounds collision (damping and bounce)
        if (b.x - b.radius < padding) {
          b.x = b.radius + padding;
          b.vx = Math.abs(b.vx);
        } else if (b.x + b.radius > w - padding) {
          b.x = w - b.radius - padding;
          b.vx = -Math.abs(b.vx);
        }

        if (b.y - b.radius < padding) {
          b.y = b.radius + padding;
          b.vy = Math.abs(b.vy);
        } else if (b.y + b.radius > h - padding) {
          b.y = h - b.radius - padding;
          b.vy = -Math.abs(b.vy);
        }
      }

      // 2. Ball-to-ball elastic collisions
      for (let i = 0; i < len; i++) {
        for (let j = i + 1; j < len; j++) {
          const b1 = list[i];
          const b2 = list[j];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = b1.radius + b2.radius + 6; // buffer separation

          if (dist < minDist) {
            // Overlap correction (separation)
            const overlap = minDist - dist;
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);

            // Shift positions equally
            b1.x -= nx * overlap * 0.5;
            b1.y -= ny * overlap * 0.5;
            b2.x += nx * overlap * 0.5;
            b2.y += ny * overlap * 0.5;

            // Elastic Collision Response (velocities)
            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const vn = kx * nx + ky * ny; // relative normal velocity

            // Update only if moving towards each other
            if (vn > 0) {
              const impulse = (2 * vn) / (b1.mass + b2.mass);
              b1.vx -= impulse * b2.mass * nx;
              b1.vy -= impulse * b2.mass * ny;
              b2.vx += impulse * b1.mass * nx;
              b2.vy += impulse * b1.mass * ny;
            }
          }
        }
      }

      // 3. Render styles via direct DOM refs (bypass React rerender lag)
      for (let i = 0; i < len; i++) {
        const b = list[i];
        const el = domRefs.current.get(b.id);
        if (el) {
          el.style.transform = `translate3d(${b.x - b.radius}px, ${b.y - b.radius}px, 0)`;
        }
      }

      animationFrameId.current = requestAnimationFrame(updatePhysics);
    };

    animationFrameId.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [attendees, quizState.currentView, roomStatus]);

  // ── Confetti Particle System ─────────────────────────
  useEffect(() => {
    if (quizState.currentView !== 'podium' || !confettiCanvasRef.current) return;

    const canvas = confettiCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#a78bfa', '#8b5cf6', '#6d28d9', '#ec4899', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b'];
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
    }> = [];

    // Initialize particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * -height - 20,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: -2 + Math.random() * 4,
        speedY: 2 + Math.random() * 5,
        rotation: Math.random() * 360,
        rotationSpeed: -3 + Math.random() * 6,
      });
    }

    const drawConfetti = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;

        // Reset if goes off-screen
        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      animId = requestAnimationFrame(drawConfetti);
    };

    drawConfetti();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [quizState.currentView]);

  // Loading view
  if (roomStatus === 'loading') {
    return (
      <div className="min-h-dvh bg-zinc-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <p className="text-sm">Connecting to Presentation View…</p>
        </div>
      </div>
    );
  }

  // Room not active view
  if (roomStatus === 'invalid') {
    return (
      <div className="min-h-dvh bg-zinc-950 flex items-center justify-center p-4">
        <div className="card max-w-sm w-full p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Presentation View Error</h1>
          <p className="text-sm text-zinc-400">
            Room Code "{roomCode?.toUpperCase()}" doesn't exist, has ended, or host disconnected.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active quiz metadata
  const currentQuestionIndex = quizState.activeIndex;
  const activeQuestion = currentQuestionIndex >= 0 ? quizState.questions[currentQuestionIndex] : null;

  return (
    <div
      className="min-h-dvh bg-zinc-950 flex flex-col text-zinc-100 font-sans relative overflow-hidden select-none"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.05) 0%, transparent 80%)',
      }}
    >
      {/* Confetti Rain Layer */}
      {quizState.currentView === 'podium' && (
        <canvas ref={confettiCanvasRef} className="fixed inset-0 pointer-events-none z-50" />
      )}

      {/* Header status */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/60 backdrop-blur-md bg-zinc-950/40 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-extrabold tracking-wide uppercase text-zinc-300">SynClass Presentation</h2>
            <p className="text-[10px] text-zinc-500 font-medium">Room Code: <span className="font-mono text-violet-400 font-bold">{roomCode?.toUpperCase()}</span></p>
          </div>
        </div>

        {/* Display live counts */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 rounded-full">
            <Users className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-bold text-zinc-300">
              {attendees.filter((a) => a.isOnline).length} Joined
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-zinc-400 font-medium">
              {isConnected ? 'Sync Active' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* ────────── LOBBY VIEW ────────── */}
        {quizState.currentView === 'lobby' && (
          <div className="w-full h-full flex flex-col max-w-6xl mx-auto space-y-6">
            {/* Top row instruction cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-900/40 border border-zinc-900/80 rounded-3xl p-6 backdrop-blur-sm shadow-2xl items-center relative z-10 shrink-0">
              <div className="text-left space-y-2 md:col-span-2">
                <p className="text-sm text-zinc-500 font-bold tracking-wider uppercase">Join the Class Session!</p>
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                  Go to <span className="text-violet-400 underline underline-offset-4 font-mono">{window.location.origin}</span>
                </h1>
                <p className="text-lg text-zinc-400 font-medium">
                  Enter Room Code:&nbsp;
                  <span className="font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 text-3xl tracking-widest bg-zinc-900/80 px-4 py-1 rounded-xl ring-1 ring-violet-500/20">
                    {roomCode?.toUpperCase()}
                  </span>
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center md:justify-end">
                <div className="bg-white p-3.5 rounded-3xl shadow-2xl ring-4 ring-violet-500/10 shrink-0">
                  <QRCodeComponent
                    value={`${window.location.origin}/room/${roomCode}`}
                    size={130}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  />
                </div>
              </div>
            </div>

            {/* Bouncing Bubbles Playground */}
            <div className="flex-1 flex flex-col min-h-[350px] relative bg-zinc-950/20 border border-zinc-900/80 rounded-3xl overflow-hidden shadow-inner">
              {/* Background watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none">
                <Users className="w-96 h-96" />
              </div>

              {/* Playground bounds */}
              <div ref={playgroundRef} className="absolute inset-0 overflow-hidden relative">
                {attendees.filter((a) => a.isOnline).length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600 animate-pulse text-sm font-medium">
                    Waiting for players to connect...
                  </div>
                )}

                {/* Physics floating avatar elements */}
                {attendees.filter((a) => a.isOnline).map((att) => {
                  return (
                    <div
                      key={att.guestId}
                      ref={(el) => {
                        if (el) {
                          domRefs.current.set(att.guestId, el);
                        } else {
                          domRefs.current.delete(att.guestId);
                        }
                      }}
                      className="absolute w-[110px] h-[110px] rounded-full bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center p-2 shadow-2xl transition-all duration-300 scale-100 hover:scale-105 select-none touch-none hover:border-violet-500/30"
                      style={{
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                        left: '0px',
                        top: '0px',
                      }}
                    >
                      <div className="relative rounded-full overflow-hidden shrink-0 pointer-events-none mb-1 ring-1 ring-zinc-700">
                        <AvatarComponent
                          size={44}
                          name={att.avatarSeed.split(':').slice(1).join(':') || att.name}
                          variant={att.avatarSeed.split(':')[0] as any || 'beam'}
                          colors={AVATAR_PALETTE}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-300 font-bold truncate max-w-full text-center px-1 pointer-events-none select-none">
                        {att.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ────────── ACTIVE QUESTION VIEW ────────── */}
        {quizState.currentView === 'question' && activeQuestion && (
          <div className="w-full max-w-5xl flex flex-col h-full justify-between space-y-8 animate-in fade-in duration-300">
            {/* Question title */}
            <div className="bg-zinc-900/40 border border-zinc-900/60 p-6 rounded-3xl text-center shadow-xl">
              <span className="text-xs text-violet-400 font-bold uppercase tracking-wider">
                Question {currentQuestionIndex + 1}
              </span>
              <h1 className="text-2xl md:text-4xl font-extrabold text-white mt-1 leading-snug">
                {activeQuestion.text}
              </h1>
            </div>

            {/* Mid row: Countdown Timer + Image Placeholder + Answers Submitted */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-8 items-center py-4">
              {/* Timer circle */}
              <div className="flex flex-col items-center justify-center text-center md:col-span-1">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-violet-500/20 bg-zinc-900/20 flex flex-col items-center justify-center shadow-2xl relative select-none animate-pulse">
                  {/* Dynamic indicator circle */}
                  <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 border-r-transparent border-b-transparent border-l-transparent animate-spin duration-1000 opacity-60" />
                  <span className="text-4xl md:text-5xl font-black text-violet-400 font-mono">
                    {quizState.secondsLeft}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Seconds</span>
                </div>
              </div>

              {/* Graphic center space */}
              <div className="md:col-span-2 h-48 md:h-64 rounded-3xl bg-gradient-to-br from-violet-950/10 via-zinc-900/30 to-fuchsia-950/10 border border-zinc-900 flex flex-col items-center justify-center relative p-6 text-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.04),_transparent)]" />
                <span className="text-4xl mb-2">🤔</span>
                <p className="text-sm text-zinc-400 font-semibold max-w-xs leading-relaxed">
                  Look at the choices below. Answer on your device!
                </p>
              </div>

              {/* Submissions count */}
              <div className="flex flex-col items-center justify-center text-center md:col-span-1">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-fuchsia-500/20 bg-zinc-900/20 flex flex-col items-center justify-center shadow-2xl relative select-none">
                  <span className="text-4xl md:text-5xl font-black text-fuchsia-400 font-mono animate-bounce">
                    {answerCount}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Answers</span>
                </div>
              </div>
            </div>

            {/* Bottom row: Option Panels (Kahoot style shapes and colors) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
              {activeQuestion.options.map((option, idx) => {
                const optStyle = OPTION_CLASSES[idx] || OPTION_CLASSES[0];
                return (
                  <div
                    key={idx}
                    className={`bg-gradient-to-r ${optStyle.bg} border-2 rounded-2xl p-5 flex items-center gap-4 shadow-lg text-left`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl font-bold select-none shrink-0">
                      {optStyle.symbol}
                    </div>
                    <span className="text-lg font-bold text-white leading-tight">
                      {option}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ────────── ANSWER RESULTS VIEW ────────── */}
        {quizState.currentView === 'results' && activeQuestion && (
          <div className="w-full max-w-5xl flex flex-col h-full justify-between space-y-8 animate-in scale-in duration-300">
            {/* Question title */}
            <div className="bg-zinc-900/40 border border-zinc-900/60 p-6 rounded-3xl text-center shadow-xl shrink-0 relative">
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                Results for Question {quizState.questions.length > 0 ? (quizState.questions.findIndex((q) => q.text === activeQuestion.text) + 1) : ''}
              </span>

              {/* Automatic Scoreboard Countdown Pill */}
              <div className="absolute top-4 right-6 flex items-center gap-2 bg-zinc-950/60 border border-zinc-800/80 px-3 py-1.5 rounded-full select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Next in</span>
                <span className="text-xs text-amber-400 font-black font-mono">{resultsCountdown}s</span>
              </div>

              <h1 className="text-2xl md:text-4xl font-extrabold text-white mt-1 leading-snug">
                {activeQuestion.text}
              </h1>
            </div>

            {/* Graph area */}
            <div className="flex-1 flex flex-col justify-end min-h-[300px] bg-zinc-950/20 border border-zinc-900/80 rounded-3xl p-8 shadow-inner relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.02),_transparent_60%)]" />

              {/* Massive centered countdown overlay */}
              {resultsCountdown > 0 && (
                <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-40 rounded-3xl animate-in fade-in duration-300">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-amber-500/20 flex flex-col items-center justify-center relative shadow-2xl bg-zinc-900/95 ring-8 ring-amber-500/10">
                    <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1s' }} />
                    <span className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 to-yellow-500 font-mono select-none">
                      {resultsCountdown}
                    </span>
                  </div>
                  <div className="text-center space-y-2 max-w-xs px-4">
                    <h3 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
                      {lastQuestionIndex === quizState.questions.length - 1 ? '🏆 Final Podium' : '📊 Scoreboard'}
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                      Automatically displaying the rankings in {resultsCountdown} seconds...
                    </p>
                  </div>
                </div>
              )}

              {/* Render bar charts */}
              <div className="h-full flex items-end justify-around gap-6 relative z-10 w-full">
                {activeQuestion.options.map((_, idx) => {
                  const optStyle = OPTION_CLASSES[idx] || OPTION_CLASSES[0];
                  const count = quizState.optionCounts[idx] || 0;

                  // Find max responses to scale heights
                  const total = quizState.optionCounts.reduce((a, b) => a + b, 0) || 1;
                  const percent = Math.max(8, Math.round((count / total) * 100)); // min 8% for visibility

                  const isCorrect = idx === quizState.correctIndex;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center space-y-4 max-w-[120px]">
                      {/* Bar count */}
                      <span className="text-sm font-extrabold text-zinc-300 font-mono">{count}</span>

                      {/* Animated vertical bar */}
                      <div
                        className={`w-full rounded-2xl bg-gradient-to-t ${optStyle.bg} border-2 border-transparent transition-all duration-700 ease-out relative flex items-end justify-center`}
                        style={{
                          height: `${percent}%`,
                          minHeight: '2rem',
                          boxShadow: isCorrect ? '0 0 32px rgba(16,185,129,0.3)' : 'none',
                          opacity: isCorrect ? 1.0 : 0.35,
                        }}
                      >
                        {isCorrect && (
                          <div className="absolute -top-3 bg-emerald-500 text-white rounded-full p-1 border-2 border-zinc-950 shadow-lg shadow-emerald-950/30 animate-bounce">
                            <svg
                              className="w-3.5 h-3.5 fill-none stroke-current stroke-3"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        <span className="text-white text-xl font-bold p-2 select-none">{optStyle.symbol}</span>
                      </div>

                      {/* Geometric tag */}
                      <span className={`text-[10px] font-bold ${isCorrect ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {isCorrect ? 'Correct ✓' : optStyle.colorName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom option summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
              {activeQuestion.options.map((option, idx) => {
                const optStyle = OPTION_CLASSES[idx] || OPTION_CLASSES[0];
                const isCorrect = idx === quizState.correctIndex;
                return (
                  <div
                    key={idx}
                    className={`bg-zinc-900/60 border rounded-2xl p-4 flex items-center justify-between gap-4 transition-all duration-300
                      ${isCorrect ? 'border-emerald-500 bg-emerald-950/10 shadow-lg shadow-emerald-950/5' : 'border-zinc-900 opacity-60'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${optStyle.bg} flex items-center justify-center text-white text-base font-bold shrink-0`}
                      >
                        {optStyle.symbol}
                      </div>
                      <span className="text-sm font-bold text-zinc-300 truncate">
                        {option}
                      </span>
                    </div>

                    {isCorrect && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider">
                        Answer
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ────────── SCOREBOARD/LEADERBOARD VIEW ────────── */}
        {quizState.currentView === 'scoreboard' && (
          <div className="w-full max-w-3xl flex flex-col h-full space-y-6 justify-center animate-in slide-in-from-bottom-10 duration-500">
            <div className="text-center space-y-2">
              <span className="text-xs text-violet-400 font-bold uppercase tracking-wider">Leaderboard Standings</span>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Scoreboard</h1>
              <p className="text-sm text-zinc-500">Real-time point totals based on speed and accuracy</p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-900/60 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-3 max-h-[450px] overflow-auto">
              {quizState.scores.length === 0 ? (
                <div className="text-center text-zinc-500 py-12 text-sm">No scores submitted yet.</div>
              ) : (
                quizState.scores.slice(0, 5).map((entry, idx) => {
                  const isTop3 = idx < 3;
                  const medalColors = ['bg-amber-400 text-zinc-950 border-amber-300', 'bg-zinc-400 text-zinc-950 border-zinc-300', 'bg-amber-700 text-white border-amber-600'];

                  return (
                    <div
                      key={entry.guestId}
                      className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/80 rounded-2xl px-5 py-4 transition-all duration-300 hover:border-violet-500/20"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Rank */}
                        {isTop3 ? (
                          <div
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-black text-xs ${medalColors[idx]}`}
                          >
                            {idx + 1}
                          </div>
                        ) : (
                          <div className="w-7 h-7 flex items-center justify-center font-bold text-zinc-500 text-xs font-mono">
                            {idx + 1}
                          </div>
                        )}

                        {/* Avatar */}
                        <div className="relative rounded-full overflow-hidden shrink-0 ring-1 ring-zinc-700">
                          <AvatarComponent
                            size={36}
                            name={entry.avatarSeed?.split(':')?.slice(1)?.join(':') || entry.name}
                            variant={entry.avatarSeed?.split(':')?.[0] as any || 'beam'}
                            colors={AVATAR_PALETTE}
                          />
                        </div>

                        {/* Name */}
                        <span className="text-base font-extrabold text-zinc-200 truncate">
                          {entry.name}
                        </span>
                      </div>

                      {/* Points */}
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-violet-400 font-mono">
                          {entry.totalPoints}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                          {entry.correctAnswers} correct
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ────────── FINAL PODIUM VIEW ────────── */}
        {quizState.currentView === 'podium' && (
          <div className="w-full max-w-4xl flex flex-col h-full justify-between items-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-2">
              <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Congratulations! 🏆</span>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">Final Podium</h1>
              <p className="text-sm text-zinc-500">The champions of this quiz session</p>
            </div>

            {/* Pedestals columns wrapper */}
            <div className="flex items-end justify-center w-full max-w-2xl gap-4 md:gap-8 min-h-[420px] pb-6">
              {/* 2nd Place (Silver, Left) */}
              {quizState.scores[1] && quizState.scores[1].totalPoints > 0 ? (
                <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom-32 duration-1000 delay-300">
                  <div className="relative rounded-full overflow-hidden border-2 border-zinc-400 bg-zinc-900 shadow-2xl scale-95 mb-3">
                    <AvatarComponent
                      size={64}
                      name={quizState.scores[1].avatarSeed?.split(':')?.slice(1)?.join(':') || quizState.scores[1].name}
                      variant={quizState.scores[1].avatarSeed?.split(':')?.[0] as any || 'beam'}
                      colors={AVATAR_PALETTE}
                    />
                  </div>
                  <span className="text-sm font-extrabold text-zinc-300 truncate max-w-full text-center">
                    {quizState.scores[1].name}
                  </span>
                  <span className="text-xs text-zinc-500 font-bold font-mono mb-2">
                    {quizState.scores[1].totalPoints} pts
                  </span>

                  {/* Silver pedestal */}
                  <div
                    className="w-full bg-gradient-to-b from-zinc-500/30 to-zinc-700/10 border border-zinc-500/20 rounded-t-3xl flex flex-col items-center justify-center shadow-xl shadow-zinc-950/30"
                    style={{ height: '180px' }}
                  >
                    <span className="text-5xl font-black text-zinc-300 select-none">2</span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Silver</span>
                  </div>
                </div>
              ) : (
                <div className="w-1/3" />
              )}

              {/* 1st Place (Gold, Center) */}
              {quizState.scores[0] && quizState.scores[0].totalPoints > 0 ? (
                <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom-40 duration-1000">
                  <div className="relative mb-2">
                    {/* Crown emoji */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl animate-bounce">👑</div>
                    <div className="relative rounded-full overflow-hidden border-4 border-amber-400 bg-zinc-900 shadow-2xl scale-110 mb-2">
                      <AvatarComponent
                        size={80}
                        name={quizState.scores[0].avatarSeed?.split(':')?.slice(1)?.join(':') || quizState.scores[0].name}
                        variant={quizState.scores[0].avatarSeed?.split(':')?.[0] as any || 'beam'}
                        colors={AVATAR_PALETTE}
                      />
                    </div>
                  </div>
                  <span className="text-base font-extrabold text-white truncate max-w-full text-center">
                    {quizState.scores[0].name}
                  </span>
                  <span className="text-sm text-amber-400 font-black font-mono mb-3 animate-pulse">
                    {quizState.scores[0].totalPoints} pts
                  </span>

                  {/* Gold pedestal */}
                  <div
                    className="w-full bg-gradient-to-b from-amber-500/30 to-amber-700/10 border border-amber-500/20 rounded-t-3xl flex flex-col items-center justify-center shadow-2xl shadow-amber-950/30"
                    style={{ height: '240px' }}
                  >
                    <span className="text-6xl font-black text-amber-400 select-none">1</span>
                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-1">Champion</span>
                  </div>
                </div>
              ) : (
                <div className="w-1/3" />
              )}

              {/* 3rd Place (Bronze, Right) */}
              {quizState.scores[2] && quizState.scores[2].totalPoints > 0 ? (
                <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom-24 duration-1000 delay-500">
                  <div className="relative rounded-full overflow-hidden border-2 border-amber-700 bg-zinc-900 shadow-2xl scale-90 mb-3">
                    <AvatarComponent
                      size={56}
                      name={quizState.scores[2].avatarSeed?.split(':')?.slice(1)?.join(':') || quizState.scores[2].name}
                      variant={quizState.scores[2].avatarSeed?.split(':')?.[0] as any || 'beam'}
                      colors={AVATAR_PALETTE}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-zinc-300 truncate max-w-full text-center">
                    {quizState.scores[2].name}
                  </span>
                  <span className="text-xs text-zinc-500 font-bold font-mono mb-2">
                    {quizState.scores[2].totalPoints} pts
                  </span>

                  {/* Bronze pedestal */}
                  <div
                    className="w-full bg-gradient-to-b from-amber-800/30 to-amber-950/10 border border-amber-800/20 rounded-t-3xl flex flex-col items-center justify-center shadow-xl shadow-zinc-950/30"
                    style={{ height: '130px' }}
                  >
                    <span className="text-4xl font-black text-amber-700 select-none">3</span>
                    <span className="text-[10px] text-amber-800/70 font-bold uppercase tracking-wider mt-1 font-medium">Bronze</span>
                  </div>
                </div>
              ) : (
                <div className="w-1/3" />
              )}
            </div>

            {/* Back to lobby or reset instructions button */}
            <p className="text-xs text-zinc-600 z-10">Use your Host Dashboard to reset the quiz or start a new room.</p>
          </div>
        )}
        {/* Floating Presentation Control Overlay */}
        {(quizState.currentView === 'results' || quizState.currentView === 'scoreboard') && (
          <div className="absolute bottom-8 right-8 flex items-center gap-3 z-30 animate-in slide-in-from-bottom-5 duration-300">
            {quizState.currentView === 'results' && (
              <button
                onClick={() => socket.emit('host_show_scoreboard', { roomCode: roomCode?.toUpperCase() })}
                className="px-5 py-2.5 bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 text-sm font-bold rounded-xl shadow-2xl transition-all duration-155 hover:scale-105 active:scale-95 cursor-pointer text-zinc-300 backdrop-blur-md"
              >
                📊 Show Leaderboard
              </button>
            )}
            {lastQuestionIndex + 1 < quizState.questions.length ? (
              <button
                onClick={() => socket.emit('launch_question', { roomCode: roomCode?.toUpperCase(), questionIndex: lastQuestionIndex + 1 })}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-bold rounded-xl shadow-2xl shadow-violet-900/10 transition-all duration-155 hover:scale-105 active:scale-95 cursor-pointer border border-transparent"
              >
                Next Question ➔
              </button>
            ) : (
              <button
                onClick={() => socket.emit('host_show_podium', { roomCode: roomCode?.toUpperCase() })}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-450 hover:to-yellow-450 text-zinc-950 text-sm font-bold rounded-xl shadow-2xl shadow-amber-900/10 transition-all duration-155 hover:scale-105 active:scale-95 cursor-pointer border border-transparent"
              >
                🏆 Show Final Podium
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer footer */}
      <footer className="border-t border-zinc-900/60 bg-zinc-950/30 px-6 py-3 text-center text-xs text-zinc-600 shrink-0">
        SynClass Live System &middot; Powering Interactive Classes
      </footer>
    </div>
  );
}
