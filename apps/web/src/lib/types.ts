/** Shapes mirrored from the NestJS API responses. */

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN';
  branch: string | null;
  semester: number | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface ChatSummary {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  vectorId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number | null;
  score: number;
  title?: string | null;
}

export interface MessageMetadata {
  citations?: Citation[];
  usage?: Record<string, unknown>;
  grounded?: boolean;
  trace?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  status: 'PENDING' | 'STREAMING' | 'COMPLETE' | 'ERROR';
  metadata: MessageMetadata | null;
  createdAt: string;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessage[];
}

export interface DocumentItem {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  type: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  chunkCount: number;
  pageCount: number | null;
  subjectId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
