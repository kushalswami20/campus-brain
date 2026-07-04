'use client';

import { useEffect, useState } from 'react';
import { Check, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGenerateFlashcards,
  useSaveFlashcards,
  type Flashcard,
} from '@/hooks/use-study';

function Card({ card }: { card: Flashcard }): React.ReactElement {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className="glass flex min-h-[120px] w-full flex-col justify-between rounded-2xl p-4 text-left transition-transform hover:scale-[1.01]"
    >
      <p className="text-sm">{flipped ? card.answer : card.question}</p>
      <span className="mt-3 flex items-center gap-1 text-xs text-muted">
        <RotateCw className="h-3 w-3" /> {flipped ? 'Answer' : 'Question'} · tap to flip
      </span>
    </button>
  );
}

export function FlashcardsPanel({ topic }: { topic: string }): React.ReactElement {
  const generate = useGenerateFlashcards();
  const save = useSaveFlashcards();
  const { mutate } = generate;

  useEffect(() => {
    mutate({ topic: topic || undefined, count: 8 });
  }, [topic, mutate]);

  if (generate.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const cards = generate.data?.flashcards ?? [];
  if (cards.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        No flashcards yet — upload material and generate.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{cards.length} cards</p>
        <Button
          size="sm"
          variant="outline"
          disabled={save.isPending || save.isSuccess}
          onClick={() => save.mutate({ flashcards: cards })}
        >
          {save.isSuccess ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            'Save to deck'
          )}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, i) => (
          <Card key={i} card={card} />
        ))}
      </div>
    </div>
  );
}
