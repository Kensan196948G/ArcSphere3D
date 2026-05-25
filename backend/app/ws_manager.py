"""WebSocket connection manager — tracks live connections per user."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import UTC, datetime
from typing import Literal

from fastapi import WebSocket

NotifType = Literal["success", "error", "info", "warning"]


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, notif_type: NotifType, message: str) -> None:
        payload = json.dumps(
            {
                "type": notif_type,
                "message": message,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast(self, notif_type: NotifType, message: str) -> None:
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, notif_type, message)

    @property
    def connected_user_count(self) -> int:
        return len(self._connections)


ws_manager = ConnectionManager()
