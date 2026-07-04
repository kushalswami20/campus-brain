/**
 * TypeScript mirror of the FastAPI RAG contract
 * (services/ai-service/app/schemas/rag.py). Kept in sync by hand for now; the
 * canonical shapes will move to `packages/shared-types` when workspaces are
 * formalised in Milestone 9.
 */

export interface RetrievalFilters {
  subjectId?: string;
  documentIds?: string[];
  documentType?: string;
  year?: number;
  unit?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RagQueryRequest {
  requestId: string;
  userId: string;
  query: string;
  chatId?: string;
  history?: ChatTurn[];
  filters?: RetrievalFilters;
  topK?: number;
  stream?: boolean;
}

export interface Citation {
  vectorId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  score: number;
  title?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
  costUsd: number;
}

export interface RagAnswer {
  requestId: string;
  answer: string;
  citations: Citation[];
  usage: TokenUsage;
  grounded: boolean;
  latencyMs: number;
}

export interface AiReadiness {
  status: string;
  providersReady: boolean;
  checks: Record<string, string>;
}

/**
 * The AI service speaks snake_case (Python). These helpers translate at the
 * boundary so the rest of the API stays camelCase.
 */
export function toWireRequest(req: RagQueryRequest): Record<string, unknown> {
  return {
    request_id: req.requestId,
    user_id: req.userId,
    query: req.query,
    chat_id: req.chatId,
    history: req.history ?? [],
    filters: req.filters
      ? {
          subject_id: req.filters.subjectId,
          document_ids: req.filters.documentIds,
          document_type: req.filters.documentType,
          year: req.filters.year,
          unit: req.filters.unit,
        }
      : undefined,
    top_k: req.topK,
    stream: req.stream ?? true,
  };
}

interface WireAnswer {
  request_id: string;
  answer: string;
  citations: Array<{
    vector_id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    page_number?: number;
    score: number;
    title?: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    model?: string;
    cost_usd: number;
  };
  grounded: boolean;
  latency_ms: number;
}

export function fromWireAnswer(wire: WireAnswer): RagAnswer {
  return {
    requestId: wire.request_id,
    answer: wire.answer,
    citations: wire.citations.map((c) => ({
      vectorId: c.vector_id,
      documentId: c.document_id,
      chunkIndex: c.chunk_index,
      content: c.content,
      pageNumber: c.page_number,
      score: c.score,
      title: c.title,
    })),
    usage: {
      promptTokens: wire.usage.prompt_tokens,
      completionTokens: wire.usage.completion_tokens,
      totalTokens: wire.usage.total_tokens,
      model: wire.usage.model,
      costUsd: wire.usage.cost_usd,
    },
    grounded: wire.grounded,
    latencyMs: wire.latency_ms,
  };
}
