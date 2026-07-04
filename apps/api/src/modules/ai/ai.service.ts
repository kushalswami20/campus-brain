import { Injectable } from '@nestjs/common';
import { AiClient } from './ai.client';
import {
  AiReadiness,
  FlashcardsResult,
  IngestRequest,
  IngestResult,
  QuizResult,
  RagAnswer,
  RagQueryRequest,
  StudyRequest,
  SummaryResult,
  fromWireAnswer,
  fromWireIngest,
  toWireIngest,
  toWireRequest,
  toWireStudy,
} from './ai.types';

interface WireSummary {
  summary: string;
  key_points: string[];
  grounded: boolean;
}
interface WireFlashcards {
  flashcards: { question: string; answer: string }[];
  grounded: boolean;
}
interface WireQuiz {
  questions: {
    question: string;
    options: string[];
    answer_index: number;
    explanation: string;
  }[];
  grounded: boolean;
}

/**
 * Higher-level AI orchestration surface used by feature modules (chat, study
 * tools). Hides the wire format and streaming mechanics behind typed methods.
 */
@Injectable()
export class AiService {
  constructor(private readonly client: AiClient) {}

  /** Ingest a document: extract, chunk, embed, and index it. */
  async ingest(req: IngestRequest): Promise<IngestResult> {
    const wire = await this.client.request<Parameters<typeof fromWireIngest>[0]>({
      path: '/v1/ingest',
      method: 'POST',
      body: toWireIngest(req),
      requestId: req.requestId,
      retryable: true,
    });
    return fromWireIngest(wire);
  }

  /** Non-streaming answer. */
  async query(req: RagQueryRequest): Promise<RagAnswer> {
    const wire = await this.client.request<Parameters<typeof fromWireAnswer>[0]>({
      path: '/v1/rag/query/sync',
      method: 'POST',
      body: toWireRequest({ ...req, stream: false }),
      requestId: req.requestId,
      retryable: true,
    });
    return fromWireAnswer(wire);
  }

  /** Streaming answer — returns the raw SSE Response for the caller to pipe. */
  streamQuery(req: RagQueryRequest): Promise<Response> {
    return this.client.stream({
      path: '/v1/rag/query',
      body: toWireRequest({ ...req, stream: true }),
      requestId: req.requestId,
      // Streams are not safely retryable once bytes flow; fail fast instead.
      retryable: false,
    });
  }

  async summarize(req: StudyRequest): Promise<SummaryResult> {
    const wire = await this.client.request<WireSummary>({
      path: '/v1/study/summary',
      method: 'POST',
      body: toWireStudy(req),
      requestId: req.requestId,
      retryable: true,
    });
    return {
      summary: wire.summary,
      keyPoints: wire.key_points,
      grounded: wire.grounded,
    };
  }

  async generateFlashcards(req: StudyRequest): Promise<FlashcardsResult> {
    const wire = await this.client.request<WireFlashcards>({
      path: '/v1/study/flashcards',
      method: 'POST',
      body: toWireStudy(req),
      requestId: req.requestId,
      retryable: true,
    });
    return { flashcards: wire.flashcards, grounded: wire.grounded };
  }

  async generateQuiz(req: StudyRequest): Promise<QuizResult> {
    const wire = await this.client.request<WireQuiz>({
      path: '/v1/study/quiz',
      method: 'POST',
      body: toWireStudy(req),
      requestId: req.requestId,
      retryable: true,
    });
    return {
      grounded: wire.grounded,
      questions: wire.questions.map((q) => ({
        question: q.question,
        options: q.options,
        answerIndex: q.answer_index,
        explanation: q.explanation,
      })),
    };
  }

  /** Readiness of the AI service and its providers. */
  health(requestId: string): Promise<AiReadiness> {
    return this.client
      .request<{
        status: string;
        providers_ready: boolean;
        checks: Record<string, string>;
      }>({
        path: '/health/ready',
        method: 'GET',
        requestId,
        retryable: true,
      })
      .then((res) => ({
        status: res.status,
        providersReady: res.providers_ready,
        checks: res.checks,
      }));
  }
}
