/**
 * @fileoverview ResourceManager — File upload and push panel for hosts.
 * Supports drag-and-drop, shows upload progress, and allows pushing resources to attendees.
 */
import { useState, useRef } from 'react';
import { Upload, FileText, Image, FileCode, Send, Cloud } from 'lucide-react';
import { SERVER_URL } from '../../config';

interface Resource {
  id: string;
  originalName: string;
  mimeType: string;
  publicUrl: string;
  description: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface ResourceManagerProps {
  roomCode: string;
  resources: Resource[];
  onResourceUploaded: (resource: Resource) => void;
  onPushResource: (resourceId: string) => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-blue-400" />;
  if (mimeType.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.includes('text') || mimeType.includes('javascript'))
    return <FileCode className="w-4 h-4 text-emerald-400" />;
  return <FileText className="w-4 h-4 text-zinc-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export default function ResourceManager({
  roomCode,
  resources,
  onResourceUploaded,
  onPushResource,
}: ResourceManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', '');

      const res = await fetch(`${SERVER_URL}/api/resources/${roomCode}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        onResourceUploaded(data.resource);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const handlePush = (resourceId: string) => {
    onPushResource(resourceId);
    setPushedIds((prev) => new Set([...prev, resourceId]));
    setTimeout(() => {
      setPushedIds((prev) => {
        const next = new Set(prev);
        next.delete(resourceId);
        return next;
      });
    }, 3000);
  };

  return (
    <div className="card h-full min-h-0 p-3 space-y-2 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Cloud className="w-4 h-4 text-zinc-500" />
        <span className="text-sm font-semibold text-zinc-200">Resources</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer
                    transition-all duration-200 select-none
                    ${isDragging ? 'border-violet-500 bg-violet-900/20' : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'}
                    ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          id="resource-file-input"
          onChange={handleFileSelect}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-violet-400">
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <Upload className="w-5 h-5" />
            <p className="text-xs">
              <span className="text-zinc-300 font-medium">Drop a file</span> or click to upload
            </p>
            <p className="text-[10px] text-zinc-600">Max 50MB</p>
          </div>
        )}
      </div>

      {/* File list */}
      {resources.length > 0 && (
        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 p-2 bg-zinc-800/60 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                {getFileIcon(r.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">{r.originalName}</p>
                <p className="text-[10px] text-zinc-600">{formatBytes(r.sizeBytes)}</p>
              </div>
              <button
                id={`push-resource-${r.id}`}
                onClick={() => handlePush(r.id)}
                className={`btn btn-sm shrink-0 ${pushedIds.has(r.id) ? 'btn-secondary text-emerald-400' : 'btn-secondary'}`}
              >
                <Send className="w-3 h-3" />
                {pushedIds.has(r.id) ? 'Pushed!' : 'Push'}
              </button>
            </div>
          ))}
        </div>
      )}

      {resources.length === 0 && !uploading && (
        <p className="text-xs text-zinc-600 text-center mt-auto">No files uploaded yet</p>
      )}
    </div>
  );
}
