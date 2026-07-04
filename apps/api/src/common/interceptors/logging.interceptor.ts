import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Assigns/propagates a request id and logs one structured line per request with
 * method, path, status, and latency. The request id is echoed back on the
 * `x-request-id` response header so clients and the AI service can correlate.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();

    const incoming = request.headers['x-request-id'];
    const requestId =
      (typeof incoming === 'string' && incoming) || randomUUID();
    request.id = requestId;
    response.setHeader('x-request-id', requestId);

    const startedAt = process.hrtime.bigint();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => this.log(requestId, method, url, response.statusCode, startedAt),
        error: () => this.log(requestId, method, url, response.statusCode || 500, startedAt),
      }),
    );
  }

  private log(
    requestId: string,
    method: string,
    url: string,
    status: number,
    startedAt: bigint,
  ): void {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    this.logger.log(
      `[${requestId}] ${method} ${url} ${status} ${durationMs.toFixed(1)}ms`,
    );
  }
}
