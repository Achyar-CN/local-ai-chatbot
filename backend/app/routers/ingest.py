from fastapi import APIRouter, UploadFile
from fastapi.responses import JSONResponse

from ..rag.ingest import ingest_file

router = APIRouter()

MAX_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/api/ingest")
async def ingest(files: list[UploadFile]):
    if not files:
        return JSONResponse({"error": "No files were uploaded."}, status_code=400)
    results = []
    for file in files:
        buffer = await file.read()
        if len(buffer) > MAX_SIZE:
            return JSONResponse(
                {"error": f"{file.filename} is too large (max 25 MB)."}, status_code=400
            )
        try:
            meta = await ingest_file(buffer, file.filename or "file", file.content_type or "")
            results.append(meta)
        except ValueError as err:
            return JSONResponse({"error": str(err)}, status_code=400)
        except Exception as err:  # noqa: BLE001
            print("Ingest error:", err)
            return JSONResponse({"error": "Ingest failed."}, status_code=500)
    return {"documents": results}
