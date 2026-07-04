"""Domain errors and the shared error envelope.

Every error leaving the service is serialized as ``{"error": {code, message,
request_id}}`` — the same envelope the NestJS API uses — so the contract is
uniform across the whole system.
"""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


class AIServiceError(Exception):
    """Base class for expected, mapped failures in the AI service."""

    status_code: int = 500
    code: str = "AI_INTERNAL_ERROR"

    def __init__(self, message: str, *, code: str | None = None,
                 status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


class ProvidersNotConfiguredError(AIServiceError):
    status_code = 503
    code = "AI_PROVIDERS_NOT_CONFIGURED"


class RetrievalError(AIServiceError):
    status_code = 502
    code = "AI_RETRIEVAL_ERROR"


class UnauthorizedServiceError(AIServiceError):
    status_code = 401
    code = "AI_UNAUTHORIZED"


def error_body(code: str, message: str, request_id: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": message, "request_id": request_id}}


def resolve_request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "unknown")


def to_response(request: Request, exc: AIServiceError) -> JSONResponse:
    request_id = resolve_request_id(request)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, request_id),
    )
