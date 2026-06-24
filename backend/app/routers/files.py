from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import Response

from ..rag.faiss_store import get_store
from ..rag.files import MIME_BY_EXT, read_original

router = APIRouter()


@router.get("/api/files/{doc_id}")
async def get_file(doc_id: str):
    doc = get_store().get_document(doc_id)
    if not doc or not doc.get("ext"):
        return Response("Not found", status_code=404)
    buffer = read_original(doc_id, doc["ext"])
    if buffer is None:
        return Response("Not found", status_code=404)
    media = doc.get("mime") or MIME_BY_EXT.get(doc["ext"], "application/octet-stream")
    return Response(
        content=buffer,
        media_type=media,
        headers={
            "Content-Disposition": f'inline; filename="{quote(doc["name"])}"',
            "Cache-Control": "private, max-age=3600",
        },
    )
