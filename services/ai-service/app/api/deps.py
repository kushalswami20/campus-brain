"""Shared FastAPI dependencies: settings, auth, and service wiring."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header

from app.core.config import Settings, get_settings
from app.core.errors import UnauthorizedServiceError
from app.services.rag_service import RagService

SettingsDep = Annotated[Settings, Depends(get_settings)]


def verify_service_key(
    settings: SettingsDep,
    x_service_key: Annotated[str | None, Header()] = None,
) -> None:
    """Enforce the shared service secret when one is configured.

    When ``service_api_key`` is empty (local dev) this is a no-op; when set,
    every request must present a matching ``x-service-key`` header.
    """
    expected = settings.service_api_key
    if not expected:
        return
    if x_service_key != expected:
        raise UnauthorizedServiceError("Invalid or missing service key.")


def get_rag_service(settings: SettingsDep) -> RagService:
    return RagService(settings)


RagServiceDep = Annotated[RagService, Depends(get_rag_service)]
