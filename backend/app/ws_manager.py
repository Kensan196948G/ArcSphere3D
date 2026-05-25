"""WebSocket connection manager — per-user connection registry."""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # Multiple tabs can open simultaneously for the same user.
        self._connections: dict[UUID, list[WebSocket]] = defaultdict(list)

    def connect(self, user_id: UUID, ws: WebSocket) -> None:
        self._connections[user_id].append(ws)

    def disconnect(self, user_id: UUID, ws: WebSocket) -> None:
        conns = self._connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: UUID, message: dict) -> None:
        """Send a JSON message to all connections for *user_id*."""
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast(self, message: dict) -> None:
        """Send a JSON message to every connected client."""
        dead: list[tuple[UUID, WebSocket]] = []
        for user_id, conns in list(self._connections.items()):
            for ws in list(conns):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append((user_id, ws))
        for user_id, ws in dead:
            self.disconnect(user_id, ws)


manager = ConnectionManager()
