"""Vertical alignment CRUD — VIP-based vertical alignment stored per horizontal alignment."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import (
    CurrentUser,
    VerticalAlignmentCreate,
    VerticalAlignmentOut,
    VipCreate,
    VipOut,
)

router = APIRouter(
    prefix="/api/projects/{project_id}/alignments/{alignment_id}/verticals",
    tags=["verticals"],
)

_Responses = dict[int | str, dict[str, Any]]
_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_403: _Responses = {403: {"description": "insufficient role"}}
_404: _Responses = {404: {"description": "not found"}}
_422: _Responses = {422: {"description": "validation error"}}

_ROLE_RANK = {"owner": 3, "editor": 2, "viewer": 1}


async def _require_project(
    project_id: UUID, session: Any, user_id: UUID, min_role: str = "viewer"
) -> None:
    """Raise 404/403 if the user lacks the required role on this project."""
    if await crud.get_project(session, project_id, user_id) is not None:
        return
    role = await crud.get_member_role(session, project_id, user_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if _ROLE_RANK.get(role, 0) < _ROLE_RANK.get(min_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient role")


async def _require_alignment(session: Any, alignment_id: UUID, project_id: UUID) -> None:
    """Raise 404 if the alignment does not belong to the project."""
    a = await crud.get_alignment(session, alignment_id, project_id)
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="alignment not found")


@router.get(
    "",
    response_model=list[VerticalAlignmentOut],
    responses={**_401, **_403, **_404},
)
async def list_verticals(
    project_id: UUID,
    alignment_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    limit: int = Query(default=100, ge=1, le=200),
) -> list[VerticalAlignmentOut]:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="viewer")
    await _require_alignment(session, alignment_id, project_id)
    return await crud.list_verticals(session, alignment_id, skip=skip, limit=limit)


@router.post(
    "",
    response_model=VerticalAlignmentOut,
    status_code=status.HTTP_201_CREATED,
    responses={**_400, **_401, **_403, **_404, **_422},
)
async def create_vertical(
    project_id: UUID,
    alignment_id: UUID,
    body: VerticalAlignmentCreate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> VerticalAlignmentOut:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="editor")
    await _require_alignment(session, alignment_id, project_id)
    return await crud.create_vertical(session, alignment_id, body)


@router.get(
    "/{vertical_id}",
    response_model=VerticalAlignmentOut,
    responses={**_401, **_403, **_404},
)
async def get_vertical(
    project_id: UUID,
    alignment_id: UUID,
    vertical_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> VerticalAlignmentOut:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="viewer")
    await _require_alignment(session, alignment_id, project_id)
    va = await crud.get_vertical(session, vertical_id, alignment_id)
    if va is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vertical not found")
    return crud.vertical_to_out(va)


@router.delete(
    "/{vertical_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={**_401, **_403, **_404},
)
async def delete_vertical(
    project_id: UUID,
    alignment_id: UUID,
    vertical_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="editor")
    await _require_alignment(session, alignment_id, project_id)
    va = await crud.get_vertical(session, vertical_id, alignment_id)
    if va is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vertical not found")
    await crud.delete_vertical(session, vertical_id)


@router.put(
    "/{vertical_id}/vips",
    response_model=list[VipOut],
    responses={**_400, **_401, **_403, **_404, **_422},
)
async def replace_vips(
    project_id: UUID,
    alignment_id: UUID,
    vertical_id: UUID,
    body: list[VipCreate],
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> list[VipOut]:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="editor")
    await _require_alignment(session, alignment_id, project_id)
    va = await crud.get_vertical(session, vertical_id, alignment_id)
    if va is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vertical not found")
    return await crud.upsert_vips(session, vertical_id, body)
