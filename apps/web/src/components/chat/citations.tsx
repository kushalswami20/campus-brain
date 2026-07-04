'use client';

import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import type { Citation } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Citations({
  citations,
}: {
  citations: Citation[];
}): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  if (!citations.length) return null;

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
      >
        <FileText className="h-3.5 w-3.5" />
        {citations.length} source{citations.length > 1 ? 's' : ''}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {citations.map((citation, index) => (
            <li
              key={citation.vectorId}
              className="rounded-lg border border-border bg-surface-2/50 p-2.5 text-xs"
            >
              <div className="mb-1 flex items-center justify-between text-muted">
                <span className="font-medium text-fg">
                  [{index + 1}] {citation.title ?? citation.documentId}
                </span>
                <span>score {citation.score.toFixed(3)}</span>
              </div>
              <p className="line-clamp-3 text-muted">{citation.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
