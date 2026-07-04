import { Injectable } from '@nestjs/common';
import { AiClient } from './ai.client';
import {
  AiReadiness,
  RagAnswer,
  RagQueryRequest,
  fromWireAnswer,
  toWireRequest,
} from './ai.types';

/**
 * Higher-level AI orchestration surface used by feature modules (chat, study
 * tools). Hides the wire format and streaming mechanics behind typed methods.
 */
@Injectable()
export class AiService {
  constructor(private readonly client: AiClient) {}

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
