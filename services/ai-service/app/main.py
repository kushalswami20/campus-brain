"""FastAPI application entrypoint for the CampusBrain AI service."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import health, ingest, rag
from app.core.config import get_settings
from app.core.errors import AIServiceError, error_body, resolve_request_id, to_response
from app.core.logging import configure_logging, get_logger


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = get_logger("startup")
    logger.info(
        "ai_service_starting",
        env=settings.app_env,
        providers_ready=settings.providers_ready,
    )
    yield
    get_logger("shutdown").info("ai_service_stopping")


def create_app() -> FastAPI:
    app = FastAPI(
        title="CampusBrain AI Service",
        description="Isolated RAG / multi-agent AI microservice.",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.include_router(health.router)
    app.include_router(ingest.router)
    app.include_router(rag.router)

    @app.exception_handler(AIServiceError)
    async def handle_domain_error(
        request: Request, exc: AIServiceError
    ) -> JSONResponse:
        return to_response(request, exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                **error_body(
                    "AI_VALIDATION_ERROR",
                    "Request failed validation.",
                    resolve_request_id(request),
                ),
                "detail": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        get_logger("error").error("unhandled_exception", error=str(exc))
        return JSONResponse(
            status_code=500,
            content=error_body(
                "AI_INTERNAL_ERROR",
                "An unexpected error occurred.",
                resolve_request_id(request),
            ),
        )

    return app


app = create_app()
