"""Tag management — project tagging and tag CRUD."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, TagCreate, TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])

_Responses = dict[int | str, dict[str, Any]]

_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_403: _Responses = {403: {"description": "insufficient role"}}
_404: _Responses = {404: {"description": "not found"}}
_409: _Responses = {409: {"description": "conflict — tag name already exists"}}


@router.get("", response_model=list[TagOut], responses=_401)
async def list_tags(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> list[TagOut]:
    await crud.upsert_user(session, user)
    return await crud.list_tags(session)


@router.post(
    "",
    response_model=TagOut,
    status_code=status.HTTP_201_CREATED,
    responses={**_400, **_401, **_409},
)
async def create_tag(
    body: TagCreate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> TagOut:
    db_user = await crud.upsert_user(session, user)
    existing = await crud.get_tag_by_name(session, body.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag name already exists")
    return await crud.create_tag(session, body, db_user.id)


@router.delete(
    "/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={**_401, **_403, **_404},
)
async def delete_tag(
    tag_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    db_user = await crud.upsert_user(session, user)
    tag = await crud.get_tag(session, tag_id)
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    if tag.created_by != db_user.id and db_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    await crud.delete_tag(session, tag_id)
