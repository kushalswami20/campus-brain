'use client';

import { useState } from 'react';
import { BookOpen, FileText, HelpCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SummaryPanel } from '@/components/study/summary-panel';
import { FlashcardsPanel } from '@/components/study/flashcards-panel';
import { QuizPanel } from '@/components/study/quiz-panel';
import { cn } from '@/lib/utils';

type Tab = 'summary' | 'flashcards' | 'quiz';

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
];

export default function StudyPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('summary');
  const [topic, setTopic] = useState('');
  const [submitted, setSubmitted] = useState('');

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-6 flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-semibold">Study tools</h1>
            <p className="text-sm text-muted">
              Generate summaries, flashcards, and quizzes from your material.
            </p>
          </div>
        </header>

        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSubmitted(topic)}
            placeholder="Topic to focus on (optional, e.g. 'deadlocks')"
          />
          <Button onClick={() => setSubmitted(topic)}>Generate</Button>
        </div>

        <div className="mt-6 flex gap-1 rounded-xl border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
                tab === t.id ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'summary' && <SummaryPanel topic={submitted} />}
          {tab === 'flashcards' && <FlashcardsPanel topic={submitted} />}
          {tab === 'quiz' && <QuizPanel topic={submitted} />}
        </div>
      </div>
    </div>
  );
}
