import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '@/config/config.module';

interface RequestOptions {
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
  requestId: string;
  /** Whether to retry idempotent-ish failures (timeouts / 5xx). */
  retryable?: boolean;
  /** Return the raw Response for streaming instead of parsing JSON. */
  raw?: boolean;
}

/**
 * Low-level HTTP client for the AI service. Owns cross-service concerns:
 * timeouts (AbortController), bounded retries with exponential backoff, the
 * shared service-key header, request-id propagation, and error normalisation.
 */
@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);

  constructor(private readonly config: AppConfigService) {}

  async request<T>(options: Omit<RequestOptions, 'raw'>): Promise<T> {
    const response = await this.send(options);
    if (!response.ok) {
      throw await this.toError(response);
    }
    return (await response.json()) as T;
  }

  /** Returns the raw streaming Response (SSE) — caller pipes the body. */
  async stream(options: Omit<RequestOptions, 'raw' | 'method'>): Promise<Response> {
    const response = await this.send({ ...options, method: 'POST', raw: true });
    if (!response.ok || !response.body) {
      throw await this.toError(response);
    }
    return response;
  }

  private async send(options: RequestOptions): Promise<Response> {
    const maxAttempts = options.retryable
      ? this.config.get('AI_SERVICE_RETRIES') + 1
      : 1;
    const timeoutMs = this.config.get('AI_SERVICE_TIMEOUT_MS');
    const url = `${this.config.get('AI_SERVICE_URL')}${options.path}`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: options.method,
          headers: this.headers(options.requestId),
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
        // Retry transient 5xx; return everything else to the caller to map.
        if (response.status >= 500 && attempt < maxAttempts && options.retryable) {
          lastError = new Error(`AI service ${response.status}`);
          await this.backoff(attempt);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `[${options.requestId}] AI request attempt ${attempt}/${maxAttempts} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (attempt < maxAttempts) {
          await this.backoff(attempt);
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw new ServiceUnavailableException({
      code: 'AI_UNREACHABLE',
      message: 'The AI service is currently unavailable.',
      cause: lastError instanceof Error ? lastError.message : undefined,
    });
  }

  private headers(requestId: string): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-request-id': requestId,
    };
    const key = this.config.get('AI_SERVICE_KEY');
    if (key) headers['x-service-key'] = key;
    return headers;
  }

  private async backoff(attempt: number): Promise<void> {
    const base = 200 * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    await new Promise((resolve) => setTimeout(resolve, base + jitter));
  }

  /** Translate an AI-service error envelope into a NestJS HttpException. */
  private async toError(response: Response): Promise<HttpException> {
    let code = 'AI_ERROR';
    let message = `AI service responded ${response.status}.`;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Non-JSON error body; keep the defaults.
    }
    return new HttpException({ code, message }, response.status);
  }
}
