"""Health/readiness response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LivenessResponse(BaseModel):
    status: str = "ok"
    service: str = "campusbrain-ai"
    version: str = "0.1.0"


class ReadinessResponse(BaseModel):
    status: str = Field(..., description='"ok" or "degraded".')
    providers_ready: bool
    checks: dict[str, str] = Field(default_factory=dict)
