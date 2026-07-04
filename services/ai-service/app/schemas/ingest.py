"""The api <-> ai ingestion contract (v1)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    request_id: str
    document_id: str
    filename: str
    mime_type: str
    # Base64-encoded file bytes. The AI service owns extraction/OCR so the API
    # never needs document-parsing dependencies.
    content_base64: str
    # Caller-known hints; the extractor augments these with detected metadata.
    subject_id: str | None = None
    document_type: str | None = None


class ChunkRecord(BaseModel):
    vector_id: str
    chunk_index: int
    content: str
    token_count: int
    page_number: int | None = None
    metadata: dict = Field(default_factory=dict)


class IngestResponse(BaseModel):
    request_id: str
    document_id: str
    status: str = "ready"
    chunk_count: int
    page_count: int | None = None
    ocr_applied: bool = False
    detected_metadata: dict = Field(default_factory=dict)
    chunks: list[ChunkRecord] = Field(default_factory=list)
