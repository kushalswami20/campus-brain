"""Document ingestion endpoint (called by the API's BullMQ worker)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import IngestServiceDep, verify_service_key
from app.schemas.ingest import IngestRequest, IngestResponse

router = APIRouter(
    prefix="/v1/ingest",
    tags=["ingest"],
    dependencies=[Depends(verify_service_key)],
)


@router.post("", response_model=IngestResponse)
def ingest(request: IngestRequest, service: IngestServiceDep) -> IngestResponse:
    """Extract, chunk, embed, and index a document; return per-chunk records."""
    return service.ingest(request)
