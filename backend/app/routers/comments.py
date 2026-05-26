"""Project comment endpoints."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CommentCreate, CommentOut, CurrentUser

router = APIRouter(prefix="/api/projects/{project_id}/comments", tags=["comments"])

_Responses = dict[int | str, dict[str, Any]]

_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_403: _Responses = {403: {"description": "insufficient role"}}
_404: _Responses = {404: {"description": "not found"}}


async def _assert_member(session: Any, project_id: UUID, db_user: Any) -> Any:
    """Return project or raise 404 if user is not a member."""
    project = await crud.get_project_by_id(session, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if project.owner_id != db_user.id:
        role = await crud.get_access_role(session, project_id, db_user.id)
        if role is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return project


@router.get("", response_model=list[CommentOut], responses={**_401, **_404})
async def list_comments(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> list[CommentOut]:
    db_user = await crud.upsert_user(session, user)
    await _assert_member(session, project_id, db_user)
    return await crud.list_comments(session, project_id)


@router.post(
    "",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    responses={**_400, **_401, **_404},
)
async def create_comment(
    project_id: UUID,
    body: CommentCreate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> CommentOut:
    db_user = await crud.upsert_user(session, user)
    await _assert_member(session, project_id, db_user)
    return await crud.create_comment(session, project_id, db_user.id, body)


@router.delete(
    "/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={**_401, **_403, **_404},
)
async def delete_comment(
    project_id: UUID,
    comment_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    db_user = await crud.upsert_user(session, user)
    project = await _assert_member(session, project_id, db_user)
    deleted = await crud.delete_comment(session, comment_id, db_user.id, project.owner_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
