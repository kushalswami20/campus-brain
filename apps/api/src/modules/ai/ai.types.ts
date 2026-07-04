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

// ─── Ingestion contract ───

export interface IngestRequest {
  requestId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  subjectId?: string;
  documentType?: string;
}

export interface IngestChunk {
  vectorId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber?: number;
  metadata: Record<string, unknown>;
}

export interface IngestResult {
  requestId: string;
  documentId: string;
  status: string;
  chunkCount: number;
  pageCount?: number;
  ocrApplied: boolean;
  detectedMetadata: Record<string, unknown>;
  chunks: IngestChunk[];
}

export function toWireIngest(req: IngestRequest): Record<string, unknown> {
  return {
    request_id: req.requestId,
    document_id: req.documentId,
    filename: req.filename,
    mime_type: req.mimeType,
    content_base64: req.contentBase64,
    subject_id: req.subjectId,
    document_type: req.documentType,
  };
}

interface WireIngestResult {
  request_id: string;
  document_id: string;
  status: string;
  chunk_count: number;
  page_count?: number;
  ocr_applied: boolean;
  detected_metadata: Record<string, unknown>;
  chunks: Array<{
    vector_id: string;
    chunk_index: number;
    content: string;
    token_count: number;
    page_number?: number;
    metadata: Record<string, unknown>;
  }>;
}

export function fromWireIngest(wire: WireIngestResult): IngestResult {
  return {
    requestId: wire.request_id,
    documentId: wire.document_id,
    status: wire.status,
    chunkCount: wire.chunk_count,
    pageCount: wire.page_count,
    ocrApplied: wire.ocr_applied,
    detectedMetadata: wire.detected_metadata,
    chunks: wire.chunks.map((c) => ({
      vectorId: c.vector_id,
      chunkIndex: c.chunk_index,
      content: c.content,
      tokenCount: c.token_count,
      pageNumber: c.page_number,
      metadata: c.metadata,
    })),
  };
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
