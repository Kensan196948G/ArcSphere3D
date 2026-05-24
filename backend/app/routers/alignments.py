"""Alignment CRUD — horizontal alignment (IP method) stored per project."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import AlignmentCreate, AlignmentOut, CurrentUser, IpPointCreate, IpPointOut

router = APIRouter(prefix="/api/projects/{project_id}/alignments", tags=["alignments"])

_Responses = dict[int | str, dict[str, Any]]
_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_404: _Responses = {404: {"description": "not found"}}
_422: _Responses = {422: {"description": "validation error"}}


_ROLE_RANK = {"owner": 3, "editor": 2, "viewer": 1}


async def _require_project(
    project_id: UUID, session: Any, user_id: UUID, min_role: str = "viewer"
) -> None:
    """Raise 404/403 if the user lacks the required role on this project."""
    if await crud.get_project(session, project_id, user_id) is not None:
        return  # owner always has full access
    role = await crud.get_member_role(session, project_id, user_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if _ROLE_RANK.get(role, 0) < _ROLE_RANK.get(min_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient role")


_403: _Responses = {403: {"description": "insufficient role"}}


@router.get("", response_model=list[AlignmentOut], responses={**_401, **_404})
async def list_alignments(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AlignmentOut]:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="viewer")
    return await crud.list_alignments(session, project_id, skip=skip, limit=limit)


@router.post(
    "",
    response_model=AlignmentOut,
    status_code=status.HTTP_201_CREATED,
    responses={**_400, **_401, **_403, **_404, **_422},
)
async def create_alignment(
    project_id: UUID,
    body: AlignmentCreate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> AlignmentOut:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="editor")
    return await crud.create_alignment(session, project_id, body)


@router.get("/{alignment_id}", response_model=AlignmentOut, responses={**_401, **_404})
async def get_alignment(
    project_id: UUID,
    alignment_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> AlignmentOut:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="viewer")
    a = await crud.get_alignment(session, alignment_id, project_id)
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="alignment not found")
    return crud.alignment_to_out(a)


@router.delete(
    "/{alignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={**_401, **_403, **_404},
)
async def delete_alignment(
    project_id: UUID,
    alignment_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="editor")
    a = await crud.get_alignment(session, alignment_id, project_id)
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="alignment not found")
    await crud.delete_alignment(session, alignment_id)


@router.put(
    "/{alignment_id}/ip-points",
    response_model=list[IpPointOut],
    responses={**_400, **_401, **_403, **_404, **_422},
)
async def replace_ip_points(
    project_id: UUID,
    alignment_id: UUID,
    body: list[IpPointCreate],
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> list[IpPointOut]:
    """Replace all IP points for an alignment (idempotent full sync)."""
    db_user = await crud.upsert_user(session, user)
    await _require_project(project_id, session, db_user.id, min_role="editor")
    a = await crud.get_alignment(session, alignment_id, project_id)
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="alignment not found")
    return await crud.upsert_ip_points(session, alignment_id, body)
