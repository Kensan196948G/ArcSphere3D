"""Tests for WebSocket push notification endpoint."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _get_demo_token() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_ws_connect_valid_token() -> None:
    token = _get_demo_token()
    with client.websocket_connect(f"/api/ws/notifications?token={token}") as ws:
        # Connection accepted — server waits for messages
        ws.send_text("ping")
        # No error raised means the connection is alive


def test_ws_rejects_invalid_token() -> None:
    with client.websocket_connect("/api/ws/notifications?token=invalid.token.here") as ws:
        # Server sends close with policy violation (1008)
        data = ws.receive()
        assert data["type"] == "websocket.close"


def test_ws_rejects_missing_token() -> None:
    res = client.get("/api/ws/notifications")
    # Missing query param → 422 Unprocessable Entity (HTTP upgrade rejected)
    assert res.status_code == 422


def test_ws_server_push() -> None:
    """Server can push a notification to a connected user."""
    import asyncio

    from app.ws_manager import manager

    token = _get_demo_token()
    payload = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    ).json()
    token = payload["access_token"]

    with client.websocket_connect(f"/api/ws/notifications?token={token}") as ws:
        from app.security import decode_access_token

        claims = decode_access_token(token)
        user_id = str(__import__("uuid").UUID(claims["sub"]))

        async def _push() -> None:
            await manager.send_to_user(user_id, {"type": "info", "message": "test push"})

        asyncio.get_event_loop().run_until_complete(_push())
        msg = ws.receive_text()
        data = json.loads(msg)
        assert data["type"] == "info"
        assert data["message"] == "test push"
