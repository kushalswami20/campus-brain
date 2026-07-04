import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '../dto/api-response';

/**
 * Centralised exception handling. Every error leaving the API is normalised
 * into the `{ error: { code, message, requestId } }` envelope, mapped to a
 * sensible HTTP status, and logged with the request id for tracing.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = this.resolveRequestId(request);

    const { status, code, message, details } = this.normalise(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} -> ${status} ${code}: ${message}`,
      );
    }

    const body: ApiErrorResponse = {
      error: { code, message, requestId, ...(details ? { details } : {}) },
    };
    response.status(status).json(body);
  }

  private resolveRequestId(request: Request): string {
    const header = request.headers['x-request-id'];
    if (typeof header === 'string' && header.length > 0) return header;
    if (Array.isArray(header) && header.length > 0) return header[0];
    return (request as Request & { id?: string }).id ?? 'unknown';
  }

  private normalise(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, code: this.codeFromStatus(status), message: res };
      }
      const obj = res as Record<string, unknown>;
      const message = Array.isArray(obj.message)
        ? (obj.message as string[]).join('; ')
        : String(obj.message ?? exception.message);
      return {
        status,
        code: (obj.code as string) ?? this.codeFromStatus(status),
        message,
        details: obj.errors ?? (Array.isArray(obj.message) ? obj.message : undefined),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'DB_VALIDATION_ERROR',
        message: 'Invalid database query.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
  } {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT',
          message: 'A record with these values already exists.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The requested record does not exist.',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'FK_CONSTRAINT',
          message: 'Related record constraint failed.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: `DB_${error.code}`,
          message: 'A database error occurred.',
        };
    }
  }

  private codeFromStatus(status: number): string {
    return HttpStatus[status] ?? `HTTP_${status}`;
  }
}
