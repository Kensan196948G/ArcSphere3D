"""File upload / download (scaffold — does not yet persist)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.deps import CurrentUserDep
from app.schemas import CurrentUser, FileMetadata

router = APIRouter(prefix="/api/files", tags=["files"])

ALLOWED_EXTS = {".stl", ".obj", ".gltf", ".glb", ".ifc", ".step"}
MAX_BYTES = 200 * 1024 * 1024  # 200 MB


@router.post("/upload", response_model=FileMetadata, status_code=status.HTTP_201_CREATED)
async def upload(
    project_id: UUID,
    upload_file: UploadFile = File(...),
    user: CurrentUser = CurrentUserDep,
) -> FileMetadata:
    _ = user
    name = (upload_file.filename or "").lower()
    if not any(name.endswith(ext) for ext in ALLOWED_EXTS):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"extension not allowed; expected one of {sorted(ALLOWED_EXTS)}",
        )

    # Stream to /dev/null in scaffold; cap size.
    total = 0
    while chunk := await upload_file.read(1024 * 1024):
        total += len(chunk)
        if total > MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"file exceeds {MAX_BYTES} bytes",
            )

    return FileMetadata(
        id=uuid4(),
        project_id=project_id,
        filename=upload_file.filename or "unknown",
        size_bytes=total,
        content_type=upload_file.content_type or "application/octet-stream",
        uploaded_at=datetime.now(UTC),
    )
