"""Persistent notification inbox endpoints.

GET  /api/notifications          — list caller's notifications (newest first)
GET  /api/notifications/unread-count — unread count
PATCH /api/notifications/read-all    — mark all unread as read (must be before /{id}/read)
PATCH /api/notifications/{id}/read   — mark one notification as read
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query

from app.db.crud import (
    get_unread_count,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, UnreadCountOut, UserNotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

_Responses = dict[int | str, dict[str, Any]]
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_404: _Responses = {404: {"description": "not found"}}


@router.get("", response_model=list[UserNotificationOut], responses=_401)
async def get_notifications(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    unread_only: bool = Query(default=False),
) -> list[UserNotificationOut]:
    return await list_notifications(session, UUID(user.sub), limit, skip, unread_only)


@router.get("/unread-count", response_model=UnreadCountOut, responses=_401)
async def unread_count(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UnreadCountOut:
    return await get_unread_count(session, UUID(user.sub))


@router.patch("/read-all", response_model=UnreadCountOut, responses=_401)
async def read_all(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UnreadCountOut:
    updated = await mark_all_notifications_read(session, UUID(user.sub))
    await session.commit()
    return UnreadCountOut(count=updated)


@router.patch(
    "/{notification_id}/read",
    response_model=UserNotificationOut,
    responses={**_401, **_404},
)
async def read_one(
    notification_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UserNotificationOut:
    result = await mark_notification_read(session, notification_id, UUID(user.sub))
    await session.commit()
    return result
