"""WebSocket connection manager — tracks per-user WS connections."""

from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[user_id].append(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)

    async def send_to_user(self, user_id: str, message: dict) -> None:  # type: ignore[type-arg]
        """Send a JSON message to all active connections for *user_id*."""
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast(self, message: dict) -> None:  # type: ignore[type-arg]
        """Send a JSON message to every connected user."""
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, message)


manager = ConnectionManager()
