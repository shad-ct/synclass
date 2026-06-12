/**
 * @fileoverview ResourceToast — Non-intrusive file push notification.
 * Slides up from the bottom, shows file info, and provides a download link.
 * Auto-dismisses after 8 seconds.
 */
import { useEffect } from 'react';
import { Download, FileText, Image, FileCode, X } from 'lucide-react';
import { SERVER_URL } from '../../config';

interface Resource {
  id: string;
  originalName: string;
  mimeType: string;
  publicUrl: string;
  description: string;
  sizeBytes: number;
}

interface ResourceToastProps {
  resource: Resource | null;
  onDismiss: () => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-400" />;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="w-5 h-5 text-red-400" />;
  if (mimeType.includes('text') || mimeType.includes('javascript') || mimeType.includes('json'))
    return <FileCode className="w-5 h-5 text-emerald-400" />;
  return <FileText className="w-5 h-5 text-zinc-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourceToast({ resource, onDismiss }: ResourceToastProps) {
  useEffect(() => {
    if (!resource) return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [resource, onDismiss]);

  if (!resource) return null;

  const downloadUrl = resource.publicUrl.startsWith('http')
    ? resource.publicUrl
    : `${SERVER_URL}${resource.publicUrl}`;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[75] slide-up max-w-sm mx-auto">
      <div className="card-glass p-4"
        style={{ boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.2), 0 16px 40px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-start gap-3">
          {/* File icon */}
          <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            {getFileIcon(resource.mimeType)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              📎 Resource Shared
            </p>
            <p className="text-sm font-medium text-zinc-100 truncate">
              {resource.originalName}
            </p>
            {resource.description && (
              <p className="text-xs text-zinc-500 truncate">{resource.description}</p>
            )}
            <p className="text-xs text-zinc-600">{formatBytes(resource.sizeBytes)}</p>
          </div>

          {/* Close */}
          <button onClick={onDismiss} className="btn-ghost p-1 rounded shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Download CTA */}
        <a
          id="resource-download-btn"
          href={downloadUrl}
          download={resource.originalName}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary w-full mt-3 no-underline"
          style={{ display: 'flex' }}
        >
          <Download className="w-4 h-4" />
          Download File
        </a>
      </div>
    </div>
  );
}
