"""WebSocket push notification endpoint."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.security import decode_access_token
from app.ws_manager import manager

router = APIRouter(prefix="/api/ws", tags=["notifications"])


def _authenticate_ws(token: str) -> str | None:
    """Return normalized user UUID string from JWT, or None on failure."""
    try:
        claims = decode_access_token(token)
        raw_sub = claims.get("sub")
        if not isinstance(raw_sub, str):
            return None
        return str(UUID(raw_sub))
    except Exception:  # noqa: BLE001
        return None


@router.websocket("/notifications")
async def ws_notifications(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
) -> None:
    user_id = _authenticate_ws(token)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection alive; server-push only (no client messages processed)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
