'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGenerateQuiz,
  useSubmitQuiz,
  type QuizQuestion,
} from '@/hooks/use-study';
import { cn } from '@/lib/utils';

export function QuizPanel({ topic }: { topic: string }): React.ReactElement {
  const generate = useGenerateQuiz();
  const submit = useSubmitQuiz();
  const { mutate, reset } = generate;
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);

  useEffect(() => {
    reset();
    setAnswers({});
    setGraded(false);
    mutate({ topic: topic || undefined, count: 5 });
  }, [topic, mutate, reset]);

  const questions: QuizQuestion[] = generate.data?.questions ?? [];

  if (generate.isPending) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        No quiz yet — upload material and generate.
      </p>
    );
  }

  const grade = () => {
    submit.mutate({
      questions,
      answers: Object.entries(answers).map(([q, s]) => ({
        questionIndex: Number(q),
        selectedIndex: s,
      })),
    });
    setGraded(true);
  };

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => (
        <div key={qi} className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">
            {qi + 1}. {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((option, oi) => {
              const selected = answers[qi] === oi;
              const isCorrect = graded && oi === q.answerIndex;
              const isWrong = graded && selected && oi !== q.answerIndex;
              return (
                <button
                  key={oi}
                  disabled={graded}
                  onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    isCorrect && 'border-emerald-500/60 bg-emerald-500/10',
                    isWrong && 'border-red-500/60 bg-red-500/10',
                    !graded && selected && 'border-primary bg-primary/10',
                    !graded && !selected && 'border-border hover:bg-surface-2',
                  )}
                >
                  {option}
                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  {isWrong && <XCircle className="h-4 w-4 text-red-400" />}
                </button>
              );
            })}
          </div>
          {graded && q.explanation && (
            <p className="mt-2 text-xs text-muted">{q.explanation}</p>
          )}
        </div>
      ))}

      {!graded ? (
        <Button
          onClick={grade}
          disabled={Object.keys(answers).length < questions.length}
          className="w-full"
        >
          Submit quiz
        </Button>
      ) : (
        submit.data && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-center">
            <p className="text-2xl font-semibold">
              {submit.data.correct} / {submit.data.total}
            </p>
            <p className="text-sm text-muted">
              {Math.round(submit.data.score * 100)}% correct
            </p>
          </div>
        )
      )}
    </div>
  );
}
