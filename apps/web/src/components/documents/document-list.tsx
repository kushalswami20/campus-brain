'use client';

import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteDocument, useDocuments } from '@/hooks/use-documents';
import { formatRelativeTime } from '@/lib/utils';
import type { DocumentItem } from '@/lib/types';

function StatusBadge({ status }: { status: DocumentItem['status'] }): React.ReactElement {
  const map = {
    QUEUED: { icon: Clock, text: 'Queued', className: 'text-muted' },
    PROCESSING: { icon: Loader2, text: 'Processing', className: 'text-accent' },
    READY: { icon: CheckCircle2, text: 'Ready', className: 'text-emerald-400' },
    FAILED: { icon: XCircle, text: 'Failed', className: 'text-red-400' },
  } as const;
  const { icon: Icon, text, className } = map[status];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'PROCESSING' ? 'animate-spin' : ''}`} />
      {text}
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList(): React.ReactElement {
  const { data, isLoading } = useDocuments();
  const remove = useDeleteDocument();
  const documents = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No documents yet. Upload some to start asking questions.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.title}</p>
            <p className="text-xs text-muted">
              {doc.type} · {formatSize(doc.sizeBytes)} ·{' '}
              {doc.chunkCount > 0 && `${doc.chunkCount} chunks · `}
              {formatRelativeTime(doc.createdAt)}
            </p>
            {doc.status === 'FAILED' && doc.errorMessage && (
              <p className="mt-0.5 truncate text-xs text-red-400">
                {doc.errorMessage}
              </p>
            )}
          </div>
          <StatusBadge status={doc.status} />
          <button
            aria-label="Delete document"
            className="text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
            onClick={() => remove.mutate(doc.id)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
