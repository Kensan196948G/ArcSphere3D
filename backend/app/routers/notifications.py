"""WebSocket push-notification endpoint.

Clients connect via:
  ws://host/api/ws/notifications?token=<jwt>

The JWT is validated on connect. Non-UUID or expired tokens are rejected
with a 4003 close code (policy violation) before entering the receive loop.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.security import decode_access_token
from app.ws_manager import manager

router = APIRouter(tags=["notifications"])


@router.websocket("/api/ws/notifications")
async def ws_notifications(
    websocket: WebSocket,
    token: str | None = None,
) -> None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        claims = decode_access_token(token)
        raw_sub = claims.get("sub")
        if not isinstance(raw_sub, str):
            raise ValueError("sub missing")
        user_id = UUID(raw_sub)
    except (ValueError, Exception):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    manager.connect(user_id, websocket)
    try:
        while True:
            # Keep-alive: clients may send pings; we discard the data.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
