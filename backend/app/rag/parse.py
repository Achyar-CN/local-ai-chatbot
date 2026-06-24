"""Parse uploaded files into page-segmented text."""

import io
import re

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TEXT_EXTS = {"txt", "md", "markdown", "csv", "json"}


def ext_of(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "bin"
    return re.sub(r"[^a-z0-9]", "", ext) or "bin"


def parse_file(buffer: bytes, filename: str, mime: str) -> list[dict]:
    ext = ext_of(filename)

    if ext == "pdf" or mime == "application/pdf":
        return _parse_pdf(buffer)
    if ext == "docx" or mime == DOCX_MIME:
        return _parse_docx(buffer)
    if ext in TEXT_EXTS or mime.startswith("text/"):
        return [{"page": 1, "text": buffer.decode("utf-8", errors="replace")}]

    raise ValueError(f"Unsupported format: .{ext}. Use PDF, DOCX, TXT, or MD.")


def _parse_pdf(buffer: bytes) -> list[dict]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(buffer))
    pages: list[dict] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"page": i + 1, "text": text})
    return pages


def _parse_docx(buffer: bytes) -> list[dict]:
    import docx

    document = docx.Document(io.BytesIO(buffer))
    text = "\n".join(p.text for p in document.paragraphs)
    return [{"page": 1, "text": text}]
