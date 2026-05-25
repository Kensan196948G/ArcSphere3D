"""Integration tests for WebSocket notification endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app

client = TestClient(app)

ADMIN_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
USER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _login(creds: dict[str, str]) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _get_user_token() -> str:
    admin_token = _login(ADMIN_CREDS)
    client.post(
        "/api/admin/users",
        json=USER_CREDS | {"role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    return _login(USER_CREDS)


def test_ws_connect_valid_token() -> None:
    token = _get_user_token()
    with client.websocket_connect(f"/api/ws/notifications?token={token}") as ws:
        # Connection succeeds — no exception raised.
        assert ws is not None


def test_ws_connect_no_token_rejected() -> None:
    # Server sends 1008 before handshake completes — __enter__ raises disconnect.
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/ws/notifications"):
            pass
    assert exc_info.value.code == 1008


def test_ws_connect_invalid_token_rejected() -> None:
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/ws/notifications?token=not.a.valid.jwt"):
            pass
    assert exc_info.value.code == 1008


def test_ws_receive_broadcast() -> None:
    from app.ws_manager import manager

    token = _get_user_token()
    with client.websocket_connect(f"/api/ws/notifications?token={token}") as ws:
        import asyncio

        asyncio.get_event_loop().run_until_complete(
            manager.broadcast({"type": "info", "message": "hello"})
        )
        data = ws.receive_json()
        assert data["message"] == "hello"
        assert data["type"] == "info"
