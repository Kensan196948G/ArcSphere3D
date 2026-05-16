"""File upload / download (scaffold — does not yet persist to S3)."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import PurePosixPath
from uuid import UUID, uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, FileMetadata

router = APIRouter(prefix="/api/files", tags=["files"])

ALLOWED_EXTS = {".stl", ".obj", ".gltf", ".glb", ".ifc", ".step"}
MAX_BYTES = 200 * 1024 * 1024  # 200 MB


def _safe_filename(raw: str | None) -> str:
    # Strip any directory prefix (path-traversal defence) and reject control
    # bytes — `.gltf\x00.bin` style tricks otherwise survive the extension
    # check but get reinterpreted by downstream object-store SDKs. Whitespace-
    # only names are also rejected: S3 accepts them as keys but they are
    # indistinguishable in any UI listing.
    name = PurePosixPath(raw or "").name
    if not name or not name.strip() or "\x00" in name or any(ord(c) < 0x20 for c in name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid filename",
        )
    return name


@router.post("/upload", response_model=FileMetadata, status_code=status.HTTP_201_CREATED)
async def upload(
    project_id: UUID,
    session: DbDep,
    upload_file: UploadFile = File(...),
    user: CurrentUser = CurrentUserDep,
) -> FileMetadata:
    db_user = await crud.upsert_user(session, user)
    if await crud.get_project(session, project_id, db_user.id) is None:
        # 404 not 403 — same information-leak rationale as projects.get_project.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="project not found",
        )

    safe_name = _safe_filename(upload_file.filename)
    if PurePosixPath(safe_name).suffix.lower() not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"extension not allowed; expected one of {sorted(ALLOWED_EXTS)}",
        )

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
        filename=safe_name,
        size_bytes=total,
        content_type=upload_file.content_type or "application/octet-stream",
        uploaded_at=datetime.now(UTC),
    )
