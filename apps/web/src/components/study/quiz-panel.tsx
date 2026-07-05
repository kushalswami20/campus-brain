'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGenerateQuiz,
  useSubmitQuiz,
  type QuizQuestion,
} from '@/hooks/use-study';
import { cn } from '@/lib/utils';

const LENGTHS = [5, 10, 15, 20];
const SECONDS_PER_QUESTION = 45;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QuizPanel({ topic }: { topic: string }): React.ReactElement {
  const generate = useGenerateQuiz();
  const submit = useSubmitQuiz();
  const { mutate, reset } = generate;
  const [count, setCount] = useState(10);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deadlineRef = useRef(0);

  useEffect(() => {
    reset();
    setAnswers({});
    setGraded(false);
    mutate({ topic: topic || undefined, count });
  }, [topic, count, mutate, reset]);

  const questions: QuizQuestion[] = generate.data?.questions ?? [];

  // Unanswered questions submit as -1 (wrong), so per-topic totals stay honest.
  const grade = useCallback(() => {
    setGraded((already) => {
      if (already) return already;
      submit.mutate({
        questions,
        answers: questions.map((_, qi) => ({
          questionIndex: qi,
          selectedIndex: answers[qi] ?? -1,
        })),
      });
      return true;
    });
  }, [questions, answers, submit]);

  // Keep the latest grade closure reachable from the interval.
  const gradeRef = useRef(grade);
  gradeRef.current = grade;

  // Start the countdown once a fresh set of questions arrives.
  useEffect(() => {
    if (questions.length === 0) return;
    deadlineRef.current = Date.now() + questions.length * SECONDS_PER_QUESTION * 1000;
    setSecondsLeft(questions.length * SECONDS_PER_QUESTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generate.data]);

  // Tick the timer; auto-submit at zero.
  useEffect(() => {
    if (graded || questions.length === 0) return;
    const id = setInterval(() => {
      const left = Math.max(
        0,
        Math.round((deadlineRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        gradeRef.current();
      }
    }, 500);
    return () => clearInterval(id);
  }, [graded, questions.length]);

  const answeredCount = Object.keys(answers).length;

  const toolbar = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted">Questions:</span>
        {LENGTHS.map((n) => (
          <button
            key={n}
            disabled={generate.isPending}
            onClick={() => setCount(n)}
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs transition-colors',
              n === count
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted hover:bg-surface-2',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {!graded && questions.length > 0 && (
        <span
          className={cn(
            'flex items-center gap-1 text-sm tabular-nums',
            secondsLeft <= 30 ? 'text-red-400' : 'text-muted',
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {formatTime(secondsLeft)}
        </span>
      )}
    </div>
  );

  if (generate.isPending) {
    return (
      <div className="space-y-4">
        {toolbar}
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        {toolbar}
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          No quiz yet — upload material and generate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toolbar}

      {questions.map((q, qi) => (
        <div key={qi} className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            {q.topic && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                {q.topic}
              </span>
            )}
          </div>
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
        <Button onClick={grade} className="w-full">
          Submit test ({answeredCount}/{questions.length} answered)
        </Button>
      ) : (
        submit.data && (
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="text-center">
              <p className="text-2xl font-semibold">
                {submit.data.correct} / {submit.data.total}
              </p>
              <p className="text-sm text-muted">
                {Math.round(submit.data.score * 100)}% correct
              </p>
            </div>

            {submit.data.byTopic.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted">
                  Performance by topic (weakest first)
                </p>
                {submit.data.byTopic.map((t) => {
                  const pct = Math.round(t.score * 100);
                  const tone =
                    pct >= 70
                      ? 'bg-emerald-500'
                      : pct >= 40
                        ? 'bg-amber-500'
                        : 'bg-red-500';
                  return (
                    <div key={t.topic} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{t.topic}</span>
                        <span className="tabular-nums text-muted">
                          {t.correct}/{t.total} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={cn('h-full rounded-full', tone)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] text-muted">
                  Focus your revision on the red topics.
                </p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
