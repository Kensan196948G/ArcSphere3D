"""WebSocket push-notification endpoint."""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.security import decode_access_token
from app.ws_manager import ws_manager

router = APIRouter(tags=["notifications"])

_PING_INTERVAL = 30  # seconds


@router.websocket("/api/ws/notifications")
async def ws_notifications(
    websocket: WebSocket,
    token: str = Query(..., description="Bearer JWT access token"),
) -> None:
    """Authenticate via JWT query param, then keep a push channel open.

    Clients receive JSON messages:
      {"type": "success"|"error"|"info"|"warning", "message": "...", "timestamp": "..."}
    """
    try:
        claims = decode_access_token(token)
        user_id = str(UUID(claims["sub"]))
    except (ValueError, KeyError):
        await websocket.close(code=4001, reason="invalid token")
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # Interleave reading (to detect client disconnect) with a periodic ping.
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=_PING_INTERVAL)
            except TimeoutError:
                await websocket.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(user_id, websocket)
