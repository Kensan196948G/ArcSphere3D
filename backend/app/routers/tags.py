"""Tag management router — Issue #229: project tagging & tag filtering."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, TagCreate, TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])

_401 = {401: {"description": "missing or invalid bearer token"}}
_403 = {403: {"description": "insufficient role"}}
_404 = {404: {"description": "not found"}}


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
    responses={**_401, 409: {"description": "tag name already exists"}},
)
async def create_tag(
    body: TagCreate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> TagOut:
    db_user = await crud.upsert_user(session, user)
    from sqlalchemy.exc import IntegrityError

    try:
        tag = await crud.create_tag(session, body, db_user.id)
        await session.commit()
        return tag
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="tag name already exists"
        ) from exc


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
    found = await crud.delete_tag(session, tag_id, db_user.id, user.role)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tag not found")
    await session.commit()
