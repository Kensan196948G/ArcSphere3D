"""File upload / list / delete / download — persists to S3 + PostgreSQL."""

from __future__ import annotations

import hashlib
from pathlib import PurePosixPath
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.logging import logger
from app.s3 import delete_object, generate_presigned_url, put_object
from app.schemas import CurrentUser, DownloadUrl, FileMetadata, FilePatch

router = APIRouter(prefix="/api/files", tags=["files"])

_Responses = dict[int | str, dict[str, Any]]

_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_403: _Responses = {403: {"description": "insufficient role"}}
_404: _Responses = {404: {"description": "not found"}}

_ROLE_RANK = {"owner": 3, "editor": 2, "viewer": 1}


async def _require_project(project_id: UUID, session: Any, user_id: UUID, min_role: str) -> None:
    if await crud.get_project(session, project_id, user_id) is not None:
        return
    role = await crud.get_member_role(session, project_id, user_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if _ROLE_RANK.get(role, 0) < _ROLE_RANK.get(min_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient role")


ALLOWED_EXTS = {".stl", ".obj", ".gltf", ".glb", ".ifc", ".step"}
MAX_BYTES = 200 * 1024 * 1024  # 200 MB


def _safe_filename(raw: str | None) -> str:
    # Strip directory prefix (path-traversal defence) and reject control bytes.
    # Whitespace-only names are rejected: S3 accepts them but they are
    # indistinguishable in any UI listing.
    name = PurePosixPath(raw or "").name
    if not name or not name.strip() or "\x00" in name or any(ord(c) < 0x20 for c in name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid filename",
        )
    return name


@router.post(
    "/upload",
    response_model=FileMetadata,
    status_code=status.HTTP_201_CREATED,
    responses={
        **_401,
        **_403,
        **_404,
        200: {"description": "duplicate — existing file returned"},
        400: {"description": "invalid filename"},
        413: {"description": "file too large"},
        415: {"description": "unsupported extension"},
    },
)
async def upload(
    project_id: UUID,
    session: DbDep,
    upload_file: UploadFile = File(...),
    user: CurrentUser = CurrentUserDep,
) -> FileMetadata | JSONResponse:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="editor")
    safe_name = _safe_filename(upload_file.filename)
    if PurePosixPath(safe_name).suffix.lower() not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"extension not allowed; expected one of {sorted(ALLOWED_EXTS)}",
        )

    digest = hashlib.sha256()
    chunks: list[bytes] = []
    total = 0
    while chunk := await upload_file.read(1024 * 1024):
        total += len(chunk)
        if total > MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"file exceeds {MAX_BYTES} bytes",
            )
        digest.update(chunk)
        chunks.append(chunk)

    sha256_bytes = digest.digest()

    # Content-based dedup: if the same bytes already exist in this project,
    # return the existing row without re-uploading to S3.
    existing = await crud.get_file_by_sha256(session, project_id, sha256_bytes)
    if existing is not None:
        payload = FileMetadata(
            id=existing.id,
            project_id=existing.project_id,
            filename=existing.filename,
            size_bytes=existing.size_bytes,
            content_type=existing.content_type,
            uploaded_at=existing.uploaded_at,
        )
        return JSONResponse(status_code=status.HTTP_200_OK, content=payload.model_dump(mode="json"))

    body = b"".join(chunks)
    file_id = uuid4()
    s3_key = f"{project_id}/{file_id}/{safe_name}"
    content_type = upload_file.content_type or "application/octet-stream"

    await put_object(s3_key, body, content_type)

    db_file = await crud.create_file(
        session,
        project_id=project_id,
        filename=safe_name,
        size_bytes=total,
        content_type=content_type,
        s3_key=s3_key,
        sha256=sha256_bytes,
    )
    return FileMetadata(
        id=db_file.id,
        project_id=db_file.project_id,
        filename=db_file.filename,
        size_bytes=db_file.size_bytes,
        content_type=db_file.content_type,
        uploaded_at=db_file.uploaded_at,
    )


# IMPORTANT: /{project_id}/{file_id}/download MUST be registered BEFORE
# /{project_id} — FastAPI matches routes in declaration order, and the
# 1-segment pattern would otherwise swallow 2-segment paths.
@router.get(
    "/{project_id}/{file_id}/download",
    response_model=DownloadUrl,
    responses={**_401, **_403, **_404},
)
async def download_url(
    project_id: UUID,
    file_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> DownloadUrl:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="viewer")
    db_file = await crud.get_file(session, file_id, project_id)
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="file not found",
        )
    expires = 3600
    url = await generate_presigned_url(db_file.s3_key, expires)
    return DownloadUrl(url=url, expires_in=expires)


@router.delete(
    "/{file_id}", status_code=status.HTTP_204_NO_CONTENT, responses={**_401, **_403, **_404}
)
async def delete_file(
    file_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    db_user = await crud.upsert_user(session, user)
    db_file = await crud.get_file_by_id(session, file_id)
    if db_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="file not found")
    await _require_project(db_file.project_id, session, db_user.id, min_role="editor")
    s3_key = db_file.s3_key
    # DB deletion is transactional; S3 deletion is best-effort.
    await crud.delete_file(session, file_id)
    try:
        await delete_object(s3_key)
    except Exception as exc:
        logger.warning("s3_delete_failed", key=s3_key, error=str(exc))


@router.get("/{project_id}", response_model=list[FileMetadata], responses={**_401, **_403, **_404})
async def list_files(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[FileMetadata]:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="viewer")
    return await crud.list_files(session, project_id, skip=skip, limit=limit)


@router.patch("/{file_id}", response_model=FileMetadata, responses={**_400, **_401, **_403, **_404})
async def rename_file(
    file_id: UUID,
    body: FilePatch,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> FileMetadata:
    """Rename an uploaded file. Owner and editor may rename; viewer gets 403."""
    db_user = await crud.upsert_user(session, user)
    db_file = await crud.get_file_by_id(session, file_id)
    if db_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="file not found")
    await _require_project(db_file.project_id, session, db_user.id, min_role="editor")
    db_file.filename = body.filename
    await session.commit()
    await session.refresh(db_file)
    return FileMetadata(
        id=db_file.id,
        project_id=db_file.project_id,
        filename=db_file.filename,
        size_bytes=db_file.size_bytes,
        content_type=db_file.content_type,
        uploaded_at=db_file.uploaded_at,
    )
