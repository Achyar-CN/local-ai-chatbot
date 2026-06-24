from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import chat, conversations, documents, files, ingest, misc

app = FastAPI(title="Atlas Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allow_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (chat, ingest, documents, conversations, files, misc):
    app.include_router(module.router)


@app.get("/")
async def root():
    return {"name": "Atlas Backend", "status": "ok"}
