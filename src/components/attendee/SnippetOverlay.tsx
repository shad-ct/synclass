/**
 * @fileoverview SnippetOverlay — Popup displaying a broadcast code/text snippet.
 * Includes syntax-highlighted code block and clipboard copy functionality.
 */
import { useState } from 'react';
import { X, Copy, Check, Code2, FileText } from 'lucide-react';

interface SnippetOverlayProps {
  isVisible: boolean;
  content: string;
  contentType: 'code' | 'text';
  sentAt: string;
  onDismiss: () => void;
}

export default function SnippetOverlay({
  isVisible,
  content,
  contentType,
  sentAt,
  onDismiss,
}: SnippetOverlayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isVisible) return null;

  const time = sentAt ? new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="card w-full max-w-lg slide-up overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.15), 0 24px 60px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2">
            {contentType === 'code'
              ? <Code2 className="w-4 h-4 text-violet-400" />
              : <FileText className="w-4 h-4 text-blue-400" />}
            <span className="text-sm font-medium text-zinc-200">
              {contentType === 'code' ? 'Code Snippet' : 'Broadcast'}
            </span>
            {time && <span className="text-xs text-zinc-600">· {time}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              id="copy-snippet-btn"
              onClick={handleCopy}
              className="btn-ghost btn-sm flex items-center gap-1.5"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                : <><Copy className="w-3.5 h-3.5" />Copy</>}
            </button>
            <button onClick={onDismiss} className="btn-ghost p-1.5 rounded-md">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-auto">
          {contentType === 'code' ? (
            <pre className="p-4 text-sm font-mono text-zinc-200 leading-relaxed whitespace-pre-wrap break-words bg-[#0d0d0f]">
              <code>{content}</code>
            </pre>
          ) : (
            <div className="p-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          )}
        </div>

        {/* Dismiss hint */}
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-600 text-center">From your presenter</p>
        </div>
      </div>
    </div>
  );
}
