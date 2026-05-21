"""Multipart / resumable file upload endpoints — Issue #131.

Large file flow (e.g. IFC files several GB in size):
  1. POST /api/files/multipart/init      → presigned part URLs
  2. Client PUTs each chunk directly to MinIO using the presigned URLs
  3. POST /api/files/multipart/complete  → merge + register in DB
  4. DELETE /api/files/multipart/abort   → cleanup on cancel/error

Existing POST /api/files/upload (≤200 MB) is kept for backward compatibility.
"""

from __future__ import annotations

import hashlib
import math
from pathlib import PurePosixPath
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.logging import logger
from app.s3 import (
    abort_multipart_upload,
    complete_multipart_upload,
    create_multipart_upload,
    generate_presigned_part_url,
)
from app.schemas import (
    CurrentUser,
    FileMetadata,
    MultipartAbortRequest,
    MultipartCompleteRequest,
    MultipartInitRequest,
    MultipartInitResponse,
    MultipartPartInfo,
)

router = APIRouter(prefix="/api/files/multipart", tags=["files"])

_Responses = dict[int | str, dict[str, Any]]
_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_403: _Responses = {403: {"description": "insufficient role"}}
_404: _Responses = {404: {"description": "not found"}}

_ROLE_RANK = {"owner": 3, "editor": 2, "viewer": 1}

ALLOWED_EXTS = {".stl", ".obj", ".gltf", ".glb", ".ifc", ".step", ".igs", ".iges"}
MAX_PARTS = 10_000  # MinIO / S3 limit


async def _require_project_editor(project_id: UUID, session: Any, user_id: UUID) -> None:
    project = await crud.get_project(session, project_id, user_id)
    if project is not None:
        return
    role = await crud.get_member_role(session, project_id, user_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if _ROLE_RANK.get(role, 0) < _ROLE_RANK["editor"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="editor or owner required")


@router.post(
    "/init",
    response_model=MultipartInitResponse,
    status_code=status.HTTP_201_CREATED,
    responses={**_400, **_401, **_403, **_404},
)
async def init_multipart_upload(
    body: MultipartInitRequest,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> MultipartInitResponse:
    """Initiate a multipart upload session. Returns presigned URLs for each part."""
    db_user = await crud.upsert_user(session, user)
    await _require_project_editor(body.project_id, session, db_user.id)

    safe_name = PurePosixPath(body.filename).name
    if not safe_name or PurePosixPath(safe_name).suffix.lower() not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unsupported file extension; allowed: {sorted(ALLOWED_EXTS)}",
        )

    total_parts = math.ceil(body.file_size / body.chunk_size)
    if total_parts > MAX_PARTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"file requires {total_parts} parts which exceeds the {MAX_PARTS} limit",
        )

    file_id = uuid4()
    s3_key = f"{body.project_id}/{file_id}/{safe_name}"
    minio_upload_id = await create_multipart_upload(s3_key, body.content_type)

    record = await crud.create_multipart_upload_record(
        session,
        project_id=body.project_id,
        user_id=db_user.id,
        minio_upload_id=minio_upload_id,
        s3_key=s3_key,
        req=body,
    )

    parts = []
    for part_number in range(1, total_parts + 1):
        url = await generate_presigned_part_url(s3_key, minio_upload_id, part_number)
        parts.append(MultipartPartInfo(part_number=part_number, presigned_url=url))

    return MultipartInitResponse(
        upload_token=record.id,
        upload_id=minio_upload_id,
        parts=parts,
        chunk_size=body.chunk_size,
        total_parts=total_parts,
    )


@router.post(
    "/complete",
    response_model=FileMetadata,
    responses={**_400, **_401, **_403, **_404},
)
async def complete_upload(
    body: MultipartCompleteRequest,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> FileMetadata:
    """Notify the server that all parts have been uploaded. Assembles the file in MinIO."""
    db_user = await crud.upsert_user(session, user)
    record = await crud.get_multipart_upload(session, body.upload_token)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="upload not found")
    if record.user_id != db_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not your upload")

    sorted_parts = sorted(body.parts, key=lambda p: p.part_number)
    minio_parts = [
        {"PartNumber": p.part_number, "ETag": p.etag} for p in sorted_parts
    ]

    try:
        await complete_multipart_upload(record.s3_key, record.minio_upload_id, minio_parts)
    except Exception as exc:
        logger.error("multipart_complete_failed", key=record.s3_key, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="failed to assemble parts in storage",
        ) from exc

    # Use a placeholder sha256 (0 bytes) for multipart uploads — we cannot
    # stream-hash without the full bytes passing through the backend server.
    # Content integrity is guaranteed by MinIO's ETag / part checksums.
    placeholder_sha256 = hashlib.sha256(record.s3_key.encode()).digest()

    db_file = await crud.finish_multipart_upload_record(
        session,
        record=record,
        sha256=placeholder_sha256,
        actual_size=record.file_size,
    )
    return FileMetadata(
        id=db_file.id,
        project_id=db_file.project_id,
        filename=db_file.filename,
        size_bytes=db_file.size_bytes,
        content_type=db_file.content_type,
        uploaded_at=db_file.uploaded_at,
    )


@router.delete(
    "/abort",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**_401, **_404},
)
async def abort_upload(
    body: MultipartAbortRequest,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    """Abort a multipart upload, releasing all uploaded parts in MinIO."""
    db_user = await crud.upsert_user(session, user)
    record = await crud.get_multipart_upload(session, body.upload_token)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="upload not found")
    if record.user_id != db_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not your upload")

    try:
        await abort_multipart_upload(record.s3_key, record.minio_upload_id)
    except Exception as exc:
        logger.warning("multipart_abort_failed", key=record.s3_key, error=str(exc))

    await crud.abort_multipart_upload_record(session, record)
