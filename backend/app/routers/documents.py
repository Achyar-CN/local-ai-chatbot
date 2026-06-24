from fastapi import APIRouter

from ..rag.faiss_store import get_store
from ..rag.files import delete_original

router = APIRouter()


@router.get("/api/documents")
async def list_documents():
    return {"documents": get_store().list_documents()}


@router.delete("/api/documents")
async def delete_document(id: str):
    store = get_store()
    doc = store.get_document(id)
    if doc and doc.get("ext"):
        delete_original(id, doc["ext"])
    store.delete_document(id)
    return {"ok": True}
