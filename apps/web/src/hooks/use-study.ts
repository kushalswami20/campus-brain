'use client';

import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  grounded: boolean;
}
export interface Flashcard {
  question: string;
  answer: string;
}
export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface GenerateInput {
  topic?: string;
  count?: number;
}

export function useGenerateSummary() {
  return useMutation({
    mutationFn: (input: GenerateInput) =>
      apiRequest<SummaryResult>('/api/study/summary', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useGenerateFlashcards() {
  return useMutation({
    mutationFn: (input: GenerateInput) =>
      apiRequest<{ flashcards: Flashcard[]; grounded: boolean }>(
        '/api/study/flashcards/generate',
        { method: 'POST', body: input },
      ),
  });
}

export function useSaveFlashcards() {
  return useMutation({
    mutationFn: (input: { flashcards: Flashcard[]; subject?: string }) =>
      apiRequest<{ saved: number }>('/api/study/flashcards', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useGenerateQuiz() {
  return useMutation({
    mutationFn: (input: GenerateInput) =>
      apiRequest<{ questions: QuizQuestion[]; grounded: boolean }>(
        '/api/study/quiz/generate',
        { method: 'POST', body: input },
      ),
  });
}

export function useSubmitQuiz() {
  return useMutation({
    mutationFn: (input: {
      questions: QuizQuestion[];
      answers: { questionIndex: number; selectedIndex: number }[];
    }) =>
      apiRequest<{ score: number; correct: number; total: number }>(
        '/api/study/quiz/submit',
        { method: 'POST', body: input },
      ),
  });
}
