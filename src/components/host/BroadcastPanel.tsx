/**
 * @fileoverview BroadcastPanel — Text/code snippet broadcaster for hosts.
 * Supports a language label and sends the snippet to all attendees via socket.
 */
import { useState } from 'react';
import { Send, Code2, FileText, ChevronDown } from 'lucide-react';

interface BroadcastPanelProps {
  onBroadcast: (content: string, contentType: 'code' | 'text') => void;
  recentBroadcasts: Array<{ content: string; type: string; sentAt: string }>;
}

export default function BroadcastPanel({ onBroadcast, recentBroadcasts }: BroadcastPanelProps) {
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'code' | 'text'>('code');
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    if (!content.trim()) return;
    setSending(true);
    onBroadcast(content.trim(), contentType);
    setTimeout(() => {
      setContent('');
      setSending(false);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-zinc-500" />
        <span className="text-sm font-semibold text-zinc-200">Broadcast</span>
      </div>

      {/* Type selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setContentType('code')}
          className={`btn btn-sm flex-1 ${contentType === 'code' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Code
        </button>
        <button
          onClick={() => setContentType('text')}
          className={`btn btn-sm flex-1 ${contentType === 'text' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileText className="w-3.5 h-3.5" />
          Text
        </button>
      </div>

      {/* Textarea */}
      <textarea
        id="broadcast-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={contentType === 'code'
          ? '// Paste your code snippet here…\nconst x = 42;'
          : 'Type a message to broadcast to your audience…'}
        rows={6}
        className="textarea w-full"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-600">Ctrl+Enter to send</p>
        <button
          id="broadcast-send-btn"
          onClick={handleSend}
          disabled={!content.trim() || sending}
          className="btn-primary btn-sm"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? 'Sent!' : 'Broadcast'}
        </button>
      </div>

      {/* Recent broadcasts history */}
      {recentBroadcasts.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 list-none">
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
            {recentBroadcasts.length} sent this session
          </summary>
          <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
            {recentBroadcasts.map((b, i) => (
              <div key={i} className="bg-zinc-800/60 rounded-lg p-2 flex items-start gap-2 cursor-pointer hover:bg-zinc-800"
                onClick={() => setContent(b.content)}>
                {b.type === 'code' ? <Code2 className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" /> : <FileText className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />}
                <p className="text-xs text-zinc-400 font-mono truncate">{b.content.slice(0, 60)}{b.content.length > 60 ? '…' : ''}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
