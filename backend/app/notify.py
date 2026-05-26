"""Notification helper — persist to DB and push to active WebSocket connections."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud import create_notification
from app.ws_manager import manager

NotifyType = str  # "success" | "error" | "info" | "warning"


async def notify_user(
    db: AsyncSession,
    user_id: UUID,
    type: NotifyType,
    message: str,
) -> None:
    """Persist a notification row and push it to any active WebSocket connections."""
    notif = await create_notification(db, user_id, type, message)
    await manager.send_to_user(
        user_id,
        {
            "id": str(notif.id),
            "user_id": str(notif.user_id),
            "type": notif.type,
            "message": notif.message,
            "is_read": notif.is_read,
            "created_at": notif.created_at.isoformat(),
        },
    )
