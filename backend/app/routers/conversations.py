from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .. import store

router = APIRouter()


@router.get("/api/conversations")
async def list_conversations():
    return {"conversations": store.list_conversations()}


@router.post("/api/conversations")
async def save_conversation(req: Request):
    body = await req.json()
    conv_id = body.get("id")
    messages = body.get("messages")
    if not conv_id or not isinstance(messages, list):
        return JSONResponse({"error": "id and messages are required."}, status_code=400)
    meta = store.save_conversation(conv_id, messages, body.get("title"))
    return {"conversation": meta}


@router.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    conv = store.get_conversation(conv_id)
    if not conv:
        return JSONResponse({"error": "Not found."}, status_code=404)
    return {"conversation": conv}


@router.patch("/api/conversations/{conv_id}")
async def rename_conversation(conv_id: str, req: Request):
    body = await req.json()
    title = (body.get("title") or "").strip()
    if not title:
        return JSONResponse({"error": "title is required."}, status_code=400)
    store.rename_conversation(conv_id, title)
    return {"ok": True}


@router.delete("/api/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    store.delete_conversation(conv_id)
    return {"ok": True}
