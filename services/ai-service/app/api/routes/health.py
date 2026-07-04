"""Liveness and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.schemas.health import LivenessResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=LivenessResponse)
def liveness() -> LivenessResponse:
    return LivenessResponse()


@router.get("/health/ready", response_model=ReadinessResponse)
def readiness(settings: SettingsDep) -> ReadinessResponse:
    checks = {
        "openai": "up" if settings.openai_api_key else "not_configured",
        "pinecone": "up" if settings.pinecone_api_key else "not_configured",
    }
    # The skeleton is "ok" without providers; they become required at M4/M5.
    return ReadinessResponse(
        status="ok",
        providers_ready=settings.providers_ready,
        checks=checks,
    )
