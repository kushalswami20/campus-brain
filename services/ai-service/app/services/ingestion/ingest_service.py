"""Ingestion orchestrator: bytes -> text -> chunks -> vectors -> store.

The single entrypoint the API calls (via BullMQ in M4b). Returns per-chunk
records so the API can persist EmbeddingMetadata rows (the citation source of
truth) keyed by the same vector ids stored in the vector database.
"""

from __future__ import annotations

import base64
import time

from app.core.logging import get_logger
from app.schemas.ingest import ChunkRecord, IngestRequest, IngestResponse
from app.services.providers.embeddings import EmbeddingProvider
from app.services.providers.vector_store import VectorRecord, VectorStore

from .chunking import chunk_text
from .metadata import extract_metadata
from .text_extraction import extract

logger = get_logger(__name__)


class IngestService:
    def __init__(
        self, embeddings: EmbeddingProvider, vector_store: VectorStore
    ) -> None:
        self._embeddings = embeddings
        self._store = vector_store

    def ingest(self, request: IngestRequest) -> IngestResponse:
        started = time.perf_counter()
        log = logger.bind(
            request_id=request.request_id, document_id=request.document_id
        )

        data = base64.b64decode(request.content_base64)
        extraction = extract(data, request.mime_type)

        detected = extract_metadata(
            filename=request.filename,
            text=extraction.text,
            provided_type=request.document_type,
        )

        chunks = chunk_text(extraction.text)
        if not chunks:
            log.warning("ingest_empty_document")
            return IngestResponse(
                request_id=request.request_id,
                document_id=request.document_id,
                status="ready",
                chunk_count=0,
                page_count=extraction.page_count,
                ocr_applied=extraction.ocr_applied,
                detected_metadata=detected,
            )

        vectors = self._embeddings.embed([chunk.content for chunk in chunks])

        records: list[ChunkRecord] = []
        vector_records: list[VectorRecord] = []
        for chunk, vector in zip(chunks, vectors, strict=True):
            vector_id = f"{request.document_id}:{chunk.index}"
            chunk_metadata = {
                "document_id": request.document_id,
                "chunk_index": chunk.index,
                "subject_id": request.subject_id,
                **detected,
            }
            records.append(
                ChunkRecord(
                    vector_id=vector_id,
                    chunk_index=chunk.index,
                    content=chunk.content,
                    token_count=chunk.token_count,
                    metadata=chunk_metadata,
                )
            )
            vector_records.append(
                VectorRecord(
                    vector_id=vector_id,
                    values=vector,
                    # Store the text in vector metadata so retrieval can build
                    # citations without a second lookup.
                    metadata={**chunk_metadata, "content": chunk.content},
                )
            )

        self._store.upsert(vector_records)

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        log.info(
            "ingest_completed",
            chunk_count=len(records),
            ocr_applied=extraction.ocr_applied,
            elapsed_ms=elapsed_ms,
        )

        return IngestResponse(
            request_id=request.request_id,
            document_id=request.document_id,
            status="ready",
            chunk_count=len(records),
            page_count=extraction.page_count,
            ocr_applied=extraction.ocr_applied,
            detected_metadata=detected,
            chunks=records,
        )
