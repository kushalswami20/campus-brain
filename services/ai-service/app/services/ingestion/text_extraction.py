"""Extract clean text (and page count) from uploaded bytes.

Text/markdown are decoded directly. PDF/DOCX use PyMuPDF/python-docx, imported
lazily so those heavy deps are only needed when such files are actually ingested
(they ship in the Docker image; the local text path needs nothing). Scanned PDFs
with no text layer trigger the OCR hook.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.errors import AIServiceError


@dataclass
class ExtractionResult:
    text: str
    page_count: int | None
    ocr_applied: bool


_TEXT_MIMES = {"text/plain", "text/markdown", "text/csv", "application/json"}


def extract(data: bytes, mime_type: str) -> ExtractionResult:
    if mime_type in _TEXT_MIMES or mime_type.startswith("text/"):
        text = _clean(data.decode("utf-8", errors="replace"))
        return ExtractionResult(text, page_count=None, ocr_applied=False)

    if mime_type == "application/pdf":
        return _extract_pdf(data)

    if mime_type in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    }:
        return _extract_docx(data)

    if mime_type.startswith("image/"):
        return ExtractionResult(_ocr_image(data), page_count=1, ocr_applied=True)

    raise AIServiceError(
        f"Unsupported content type for ingestion: {mime_type}",
        code="AI_UNSUPPORTED_MEDIA",
        status_code=415,
    )


def _extract_pdf(data: bytes) -> ExtractionResult:
    import fitz  # PyMuPDF — lazy import

    text_parts: list[str] = []
    ocr_applied = False
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            page_text = page.get_text().strip()
            if not page_text:
                page_text = _ocr_pixmap(page)
                ocr_applied = ocr_applied or bool(page_text)
            text_parts.append(page_text)
        page_count = doc.page_count
    return ExtractionResult(_clean("\n\n".join(text_parts)), page_count, ocr_applied)


def _extract_docx(data: bytes) -> ExtractionResult:
    import io

    import docx  # python-docx — lazy import

    document = docx.Document(io.BytesIO(data))
    text = "\n".join(p.text for p in document.paragraphs)
    return ExtractionResult(_clean(text), page_count=None, ocr_applied=False)


def _ocr_pixmap(page: object) -> str:
    """OCR a rendered PDF page. Uses pytesseract when available."""
    try:
        import io

        import fitz  # noqa: F401
        import pytesseract
        from PIL import Image

        pix = page.get_pixmap(dpi=200)  # type: ignore[attr-defined]
        image = Image.open(io.BytesIO(pix.tobytes("png")))
        return str(pytesseract.image_to_string(image)).strip()
    except Exception:
        return ""


def _ocr_image(data: bytes) -> str:
    try:
        import io

        import pytesseract
        from PIL import Image

        image = Image.open(io.BytesIO(data))
        return str(pytesseract.image_to_string(image)).strip()
    except Exception:
        return ""


def _clean(text: str) -> str:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    # Collapse runs of blank lines to at most one.
    cleaned: list[str] = []
    blank = False
    for line in lines:
        if line.strip() == "":
            if not blank:
                cleaned.append("")
            blank = True
        else:
            cleaned.append(line)
            blank = False
    return "\n".join(cleaned).strip()
