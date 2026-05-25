"""WebSocket push-notification endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.security import decode_access_token
from app.ws_manager import manager

router = APIRouter(tags=["notifications"])


@router.websocket("/api/ws/notifications")
async def ws_notifications(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
) -> None:
    """Authenticate via JWT query param then keep the connection alive for push events."""
    try:
        claims = decode_access_token(token)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id: str = claims.get("sub", "")
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            # drain incoming frames to keep the connection alive; we don't
            # process client-to-server messages for now
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
