/**
 * @fileoverview RoomHeader - compact room code, QR, and status controls.
 */
import { useState } from 'react';
import { QRCode } from 'react-qr-code';
import { Copy, Check, QrCode, X, Users, Wifi } from 'lucide-react';

interface RoomHeaderProps {
  roomCode: string;
  attendeeCount: number;
  isConnected: boolean;
}

export default function RoomHeader({ roomCode, attendeeCount, isConnected }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const joinUrl = `${window.location.origin}/room/${roomCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
        <span className="section-title shrink-0">Room</span>
        <span className="text-2xl font-bold font-mono tracking-widest text-white leading-none">
          {roomCode}
        </span>

        <button
          id="copy-room-link-btn"
          onClick={handleCopyLink}
          className="btn-ghost btn-sm px-2"
          title="Copy join link"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
            : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </button>

        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border shrink-0
          ${isConnected ? 'text-emerald-400 border-emerald-800 bg-emerald-900/20' : 'text-red-400 border-red-800 bg-red-900/20'}`}>
          <Wifi className="w-3 h-3" />
          {isConnected ? 'Live' : 'Reconnecting'}
        </div>

        <div className="badge-violet shrink-0">
          <Users className="w-3 h-3" />
          {attendeeCount}
        </div>

        <button
          id="toggle-qr-btn"
          onClick={() => setShowQR((v) => !v)}
          className="btn-secondary btn-sm px-2 shrink-0"
        >
          <QrCode className="w-3.5 h-3.5" />
          QR
        </button>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in">
          <div className="card max-w-sm w-full p-4 flex items-start gap-4 shadow-2xl">
            <div className="bg-white p-3 rounded-lg shrink-0">
              <QRCode
                value={joinUrl}
                size={132}
                level="M"
                style={{ display: 'block' }}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-200">Scan to join</p>
                <button onClick={() => setShowQR(false)} className="btn-ghost p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-500 break-all font-mono">{joinUrl}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
