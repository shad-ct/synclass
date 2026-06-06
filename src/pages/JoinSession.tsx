/**
 * @fileoverview JoinSession — Attendee entry screen.
 *
 * Features:
 * - Validates room existence via REST API before rendering the form
 * - Dynamic avatar rendering with selectable variants (boring-avatars)
 * - "Shuffle" button for manual avatar seed override
 * - UUID guestId generation + localStorage persistence
 * - Navigates directly to live session without duplicate socket connects
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Avatar from 'boring-avatars';
const AvatarComponent = (Avatar as any).default || Avatar;
import { v4 as uuidv4 } from 'uuid';
import { Shuffle, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';

interface GuestProfile {
  guestId: string;
  name: string;
  avatarSeed: string;
  roomCode: string;
}

const AVATAR_PALETTE = ['#18181b', '#3f3f46', '#7c3aed', '#a78bfa', '#f4f4f5'];

type RoomStatus = 'loading' | 'valid' | 'invalid' | 'ended';

export default function JoinSession() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  // Persisted guest profile for page-refresh survival
  const [savedGuest, setSavedGuest] = useLocalStorage<GuestProfile | null>(
    'synclass_guest',
    null
  );

  const [name, setName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(uuidv4());
  const [avatarVariant, setAvatarVariant] = useState<'marble' | 'beam' | 'pixel' | 'sunset' | 'ring' | 'bauhaus'>('beam');
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('loading');
  const [error, setError] = useState('');

  // Parse existing guest profile on mount
  useEffect(() => {
    if (savedGuest && savedGuest.roomCode === roomCode?.toUpperCase()) {
      setName(savedGuest.name);
      const parts = savedGuest.avatarSeed.split(':');
      if (parts.length > 1) {
        setAvatarVariant(parts[0] as any);
        setAvatarSeed(parts.slice(1).join(':'));
      } else {
        setAvatarVariant('beam');
        setAvatarSeed(savedGuest.avatarSeed);
      }
    }
  }, [savedGuest, roomCode]);

  // When the name changes, update avatar seed to be deterministic (unless shuffled)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (val.trim()) {
      setAvatarSeed(val.trim().toLowerCase());
    }
  };

  // Shuffle button: break determinism intentionally
  const handleShuffle = () => {
    setAvatarSeed(uuidv4());
  };

  // Validate room on mount
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
          setRoomStatus(res.status === 410 ? 'ended' : 'invalid');
        } else {
          setRoomStatus('valid');

          // If we have a saved profile, we prefill it (already done on mount) but let them modify it.
          // Hence, we disable the automatic immediate redirect.
        }
      } catch {
        setRoomStatus('invalid');
      }
    };

    validate();
  }, [roomCode, savedGuest, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name before joining.');
      return;
    }

    const guestId = savedGuest?.guestId || uuidv4();
    const combinedSeed = `${avatarVariant}:${avatarSeed}`;
    const profile: GuestProfile = {
      guestId,
      name: name.trim(),
      avatarSeed: combinedSeed,
      roomCode: roomCode?.toUpperCase() || '',
    };

    setSavedGuest(profile);
    navigate(`/room/${roomCode}/live`, { replace: true });
  };

  // ── Loading state ──────────────────────────────────────
  if (roomStatus === 'loading') {
    return (
      <div className="min-h-dvh bg-zinc-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <p className="text-sm">Verifying room…</p>
        </div>
      </div>
    );
  }

  // ── Invalid / Ended room ───────────────────────────────
  if (roomStatus === 'invalid' || roomStatus === 'ended') {
    return (
      <div className="min-h-dvh bg-zinc-950 flex items-center justify-center p-4">
        <div className="card max-w-sm w-full p-8 text-center slide-up">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">
            {roomStatus === 'ended' ? 'Session Ended' : 'Room Not Found'}
          </h1>
          <p className="text-sm text-zinc-400">
            {roomStatus === 'ended'
              ? 'This session has already ended. Ask your presenter for a new link.'
              : `Room "${roomCode?.toUpperCase()}" doesn't exist. Check the code and try again.`}
          </p>
        </div>
      </div>
    );
  }

  // ── Main Join Form ─────────────────────────────────────
  return (
    <div className="min-h-dvh bg-zinc-950 flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
      }}
    >
      {/* Saved Profile in Top Right Corner */}
      {savedGuest && (
        <div className="absolute top-4 right-4 flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg animate-in fade-in duration-200 z-50">
          <div className="relative rounded-full overflow-hidden ring-1 ring-zinc-700">
            <AvatarComponent
              size={32}
              name={savedGuest.avatarSeed.split(':').slice(1).join(':') || savedGuest.name}
              variant={savedGuest.avatarSeed.split(':')[0] as any || 'beam'}
              colors={AVATAR_PALETTE}
            />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Saved Profile</p>
            <p className="text-xs text-zinc-200 font-semibold truncate max-w-[120px]">{savedGuest.name}</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm slide-up">
        {/* Room code badge */}
        <div className="flex justify-center mb-6">
          <div className="badge-violet text-xs px-3 py-1.5 rounded-full font-mono tracking-widest">
            Room&nbsp;·&nbsp;<span className="font-bold">{roomCode?.toUpperCase()}</span>
          </div>
        </div>

        <div className="card p-8 space-y-6"
          style={{ boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.1), 0 32px 64px rgba(0,0,0,0.5)' }}
        >
          {/* Avatar display */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              {/* Glow ring behind avatar */}
              <div className="absolute inset-0 rounded-full bg-violet-600/20 blur-xl scale-110 transition-all duration-300 group-hover:bg-violet-600/30" />
              <div className="relative rounded-full overflow-hidden ring-2 ring-zinc-700 ring-offset-2 ring-offset-zinc-900 transition-all duration-200 hover:ring-violet-600/50">
                <AvatarComponent
                  size={88}
                  name={avatarSeed}
                  variant={avatarVariant}
                  colors={AVATAR_PALETTE}
                />
              </div>
              {/* Shuffle button overlaid on avatar bottom-right */}
              <button
                type="button"
                id="avatar-shuffle-btn"
                onClick={handleShuffle}
                title="Randomize avatar seed"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full
                           bg-zinc-800 border border-zinc-700 flex items-center justify-center
                           hover:bg-zinc-700 hover:border-violet-600 transition-all duration-150
                           shadow-lg cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>

            {/* Helper text */}
            <p className="text-xs text-zinc-500 text-center">
              {name.trim()
                ? 'Your avatar updates as you type ·'
                : 'Enter your name to see your avatar ·'}{' '}
              <button
                type="button"
                onClick={handleShuffle}
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors cursor-pointer"
              >
                shuffle seed
              </button>
            </p>
          </div>

          {/* Style selector */}
          <div className="space-y-2">
            <label className="section-title text-zinc-400">Avatar Style</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['beam', 'marble', 'pixel', 'sunset', 'ring', 'bauhaus'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAvatarVariant(v)}
                  className={`px-2 py-1.5 rounded-lg border text-xs capitalize transition-all duration-150 cursor-pointer font-medium select-none
                    ${avatarVariant === v
                      ? 'bg-violet-900/30 border-violet-600 text-violet-200 shadow-md shadow-violet-950/50'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-850'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Join form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="guest-name" className="section-title">
                Your Name
              </label>
              <input
                id="guest-name"
                type="text"
                autoComplete="given-name"
                autoFocus
                maxLength={40}
                value={name}
                onChange={handleNameChange}
                placeholder="Enter your name"
                className="input text-base py-3.5"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 animate-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              id="join-room-btn"
              type="submit"
              disabled={!name.trim()}
              className="btn-primary btn-lg w-full mt-2"
            >
              Join Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Powered by&nbsp;
          <span className="text-zinc-400 font-medium">SynClass</span>
        </p>
      </div>
    </div>
  );
}
