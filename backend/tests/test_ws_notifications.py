"""WebSocket push notification tests."""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ws_manager import ws_manager

client = TestClient(app)

_DEMO_EMAIL = "demo@arcsphere3d.dev"
_DEMO_PASSWORD = "arcsphere-demo"


def _get_demo_token() -> str:
    res = client.post("/api/auth/login", json={"email": _DEMO_EMAIL, "password": _DEMO_PASSWORD})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_ws_connect_authenticated() -> None:
    token = _get_demo_token()
    with client.websocket_connect(f"/api/ws/notifications?token={token}") as ws:
        assert ws is not None


def test_ws_connect_invalid_token_closes() -> None:
    with pytest.raises(Exception):  # noqa: B017 — WS rejection raises impl-specific exc
        with client.websocket_connect("/api/ws/notifications?token=not.a.valid.jwt") as ws:
            ws.receive_text()


def test_ws_manager_send_to_nonexistent_user() -> None:
    """send_to_user must not raise when user has no connections."""
    asyncio.run(ws_manager.send_to_user("00000000-0000-0000-0000-000000000000", "info", "test"))


def test_ws_manager_broadcast_empty() -> None:
    """broadcast must not raise when nobody is connected."""
    asyncio.run(ws_manager.broadcast("success", "hello everyone"))


def test_ws_manager_connected_count_zero_after_disconnect() -> None:
    token = _get_demo_token()
    before = ws_manager.connected_user_count
    with client.websocket_connect(f"/api/ws/notifications?token={token}"):
        pass  # context manager exit triggers disconnect
    after = ws_manager.connected_user_count
    assert after == before
