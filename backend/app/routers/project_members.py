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
_409: _Responses = {409: {"description": "conflict — e.g. removing last owner"}}


async def _require_owner(project_id: UUID, session: Any, user: CurrentUser) -> None:
    """3-tier access guard for write operations (owner only).

    - no access (project missing OR non-member) -> 404
    - member but not owner (editor / viewer)     -> 403
    - owner                                      -> pass through
    """
    db_user = await crud.upsert_user(session, user)
    role = await crud.get_access_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner only")


async def _require_member(project_id: UUID, session: Any, user: CurrentUser) -> None:
    """3-tier access guard for read operations (any member role).

    - no access (project missing OR non-member) -> 404
    - any member (owner / editor / viewer)      -> pass through
    """
    db_user = await crud.upsert_user(session, user)
    role = await crud.get_access_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")


@router.get("", response_model=list[MemberOut], responses={**_401, **_404})
async def list_members(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> list[MemberOut]:
    """List project members. Any member (owner/editor/viewer) may call this."""
    await _require_member(project_id, session, user)
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
    db_user = await crud.upsert_user(session, user)
    member = await crud.add_member(session, project_id, body.user_id, body.role)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    await crud.log_audit_event(
        session,
        action="member_added",
        user_id=db_user.id,
        resource_type="project",
        resource_id=str(project_id),
        detail=f"user_id={body.user_id} role={body.role}",
    )
    await session.commit()
    return member


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**_401, **_403, **_404, **_409},
)
async def remove_member(
    project_id: UUID,
    user_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    """Remove a member from a project. Only the project owner may call this."""
    await _require_owner(project_id, session, user)
    db_user = await crud.upsert_user(session, user)
    result = await crud.remove_member(session, project_id, user_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="cannot remove the last owner",
        )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="member not found")
    await crud.log_audit_event(
        session,
        action="member_removed",
        user_id=db_user.id,
        resource_type="project",
        resource_id=str(project_id),
        detail=f"user_id={user_id}",
    )
    await session.commit()
