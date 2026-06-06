/**
 * @fileoverview RoomHeader — Displays room code, QR code, and room controls.
 * Host-only component shown at the top of the dashboard.
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
      // ignore
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Room code display */}
        <div className="flex items-center gap-4">
          <div>
            <p className="section-title mb-1">Live Room</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold font-mono tracking-widest text-white">
                {roomCode}
              </span>
              <button
                id="copy-room-link-btn"
                onClick={handleCopyLink}
                className="btn-ghost btn-sm"
                title="Copy join link"
              >
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
                  : <><Copy className="w-3.5 h-3.5" />Copy link</>}
              </button>
            </div>
          </div>
        </div>

        {/* Stats + controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border
            ${isConnected ? 'text-emerald-400 border-emerald-800 bg-emerald-900/20' : 'text-red-400 border-red-800 bg-red-900/20'}`}>
            <Wifi className="w-3 h-3" />
            {isConnected ? 'Live' : 'Reconnecting…'}
          </div>

          {/* Attendee count */}
          <div className="badge-violet">
            <Users className="w-3 h-3" />
            {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
          </div>

          {/* QR code toggle */}
          <button
            id="toggle-qr-btn"
            onClick={() => setShowQR((v) => !v)}
            className="btn-secondary btn-sm"
          >
            <QrCode className="w-3.5 h-3.5" />
            {showQR ? 'Hide QR' : 'Show QR'}
          </button>
        </div>
      </div>

      {/* QR Code expandable panel */}
      {showQR && (
        <div className="mt-4 flex items-start gap-6 p-4 card animate-in">
          <div className="bg-white p-3 rounded-lg shrink-0">
            <QRCode
              value={joinUrl}
              size={128}
              level="M"
              style={{ display: 'block' }}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-semibold text-zinc-200">Scan to Join</p>
            <p className="text-xs text-zinc-500 break-all font-mono">{joinUrl}</p>
            <p className="text-xs text-zinc-600">
              Point your camera at the QR code, or share the link above with your audience.
            </p>
          </div>
          <button onClick={() => setShowQR(false)} className="btn-ghost p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
