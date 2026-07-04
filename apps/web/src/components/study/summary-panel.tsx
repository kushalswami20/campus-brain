'use client';

import { useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Skeleton } from '@/components/ui/skeleton';
import { useGenerateSummary } from '@/hooks/use-study';

export function SummaryPanel({ topic }: { topic: string }): React.ReactElement {
  const summary = useGenerateSummary();
  const { mutate } = summary;

  useEffect(() => {
    mutate({ topic: topic || undefined });
  }, [topic, mutate]);

  if (summary.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!summary.data) {
    return <p className="text-sm text-muted">Generate a summary to begin.</p>;
  }

  if (!summary.data.grounded) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        No indexed material matches this yet. Upload related notes and try again.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <div className="prose-chat text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{summary.data.summary}</Markdown>
        </div>
      </div>

      {summary.data.keyPoints.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted">Key points</h3>
          <ul className="space-y-2">
            {summary.data.keyPoints.map((point, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <span className="font-medium text-accent">{i + 1}.</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
