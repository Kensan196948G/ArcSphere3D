"""WebSocket notification endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_DEMO_EMAIL = "demo@arcsphere3d.dev"
_DEMO_PW = "arcsphere-demo"


def _login() -> str:
    res = client.post("/api/auth/login", json={"email": _DEMO_EMAIL, "password": _DEMO_PW})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_ws_connect_valid_token() -> None:
    token = _login()
    with client.websocket_connect(f"/api/ws/notifications?token={token}") as ws:
        # connection accepted — send a ping and verify no immediate close
        ws.send_text("ping")
        # if we get here without an exception the connection was accepted


def test_ws_rejects_invalid_token() -> None:
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises((WebSocketDisconnect, Exception)):
        with client.websocket_connect("/api/ws/notifications?token=invalid.token.here") as ws:
            ws.send_text("ping")
            ws.receive_text()


def test_ws_rejects_missing_token() -> None:
    res = client.get("/api/ws/notifications")
    # Without upgrading to WS, FastAPI returns 422 for missing required query param
    assert res.status_code == 422
