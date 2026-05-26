"""Notification helper — persist to DB and push to active WebSocket connections."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud import create_notification
from app.models.user_notification import UserNotification
from app.ws_manager import manager

NotifyType = str  # "success" | "error" | "info" | "warning"

_WS_FIELDS = ("id", "user_id", "type", "message", "is_read", "created_at")


def _notif_payload(notif: UserNotification) -> dict:
    return {
        "id": str(notif.id),
        "user_id": str(notif.user_id),
        "type": notif.type,
        "message": notif.message,
        "is_read": notif.is_read,
        "created_at": notif.created_at.isoformat(),
    }


async def notify_user(
    db: AsyncSession,
    user_id: UUID,
    type: NotifyType,
    message: str,
) -> None:
    """Persist a notification row and push it to any active WebSocket connections.

    NOTE: call this AFTER session.commit() to avoid sending WS before DB is committed.
    Prefer create_notification + session.commit() + send_notification_ws for callers
    that control the transaction boundary.
    """
    notif = await create_notification(db, user_id, type, message)
    await manager.send_to_user(user_id, _notif_payload(notif))


async def send_notification_ws(user_id: UUID, notif: UserNotification) -> None:
    """Push an already-persisted notification to active WebSocket connections.

    Call this after session.commit() so the DB row is committed before the client
    receives the push and attempts to fetch it.
    """
    await manager.send_to_user(user_id, _notif_payload(notif))
