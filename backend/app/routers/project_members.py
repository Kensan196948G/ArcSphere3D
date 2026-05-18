"""Project member management — RBAC (owner / editor / viewer roles)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, MemberAdd, MemberOut

router = APIRouter(
    prefix="/api/projects/{project_id}/members",
    tags=["members"],
)

_Responses = dict[int | str, dict[str, Any]]
_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_403: _Responses = {403: {"description": "insufficient role"}}
_404: _Responses = {404: {"description": "not found"}}


async def _require_owner(project_id: UUID, session: Any, user: CurrentUser) -> None:
    """3-tier access guard for member-management endpoints.

    - no access (project missing OR user is neither owner nor member) -> 404
    - access but not owner (editor / viewer member)                   -> 403
    - owner                                                            -> pass through

    Distinguishing 404 from 403 matters: returning 403 to a stranger leaks the
    existence of the project (an IDOR signal), so non-members always see 404.
    """
    db_user = await crud.upsert_user(session, user)
    role = await crud.get_access_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner only")


@router.get("", response_model=list[MemberOut], responses={**_401, **_403, **_404})
async def list_members(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> list[MemberOut]:
    await _require_owner(project_id, session, user)
    return await crud.list_members(session, project_id)


@router.post(
    "",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
    responses={**_400, **_401, **_403, **_404},
)
async def add_member(
    project_id: UUID,
    body: MemberAdd,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> MemberOut:
    """Add or update a member's role. Only the project owner may call this."""
    await _require_owner(project_id, session, user)
    return await crud.add_member(session, project_id, body.user_id, body.role)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**_401, **_403, **_404},
)
async def remove_member(
    project_id: UUID,
    user_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    """Remove a member from a project. Only the project owner may call this."""
    await _require_owner(project_id, session, user)
    removed = await crud.remove_member(session, project_id, user_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="member not found")
