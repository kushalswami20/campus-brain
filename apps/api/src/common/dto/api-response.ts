/**
 * Canonical response envelopes shared by every endpoint. A stable contract on
 * the wire means the web tier never has to special-case shapes.
 */

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  /** Field-level validation details, when applicable. */
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    },
  };
}
