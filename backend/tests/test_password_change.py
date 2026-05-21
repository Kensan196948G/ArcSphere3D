"""Tests for POST /api/auth/password — password change endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_EMAIL = "demo@arcsphere3d.dev"
DEMO_PASSWORD = "arcsphere-demo"
OTHER_EMAIL = "other@arcsphere3d.dev"


def _login(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _change_password(token: str, current: str, new: str) -> int:
    res = client.post(
        "/api/auth/password",
        json={"current_password": current, "new_password": new},
        headers={"Authorization": f"Bearer {token}"},
    )
    return res.status_code


def test_change_password_success() -> None:
    token = _login(DEMO_EMAIL, DEMO_PASSWORD)
    assert _change_password(token, DEMO_PASSWORD, "new-password-123") == 204
    # New password must work
    token2 = _login(DEMO_EMAIL, "new-password-123")
    assert token2
    # Restore original password for other tests
    assert _change_password(token2, "new-password-123", DEMO_PASSWORD) == 204


def test_change_password_wrong_current_password() -> None:
    token = _login(DEMO_EMAIL, DEMO_PASSWORD)
    res = client.post(
        "/api/auth/password",
        json={"current_password": "completely-wrong!", "new_password": "new-valid-pw"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
    assert "current password" in res.json()["detail"].lower()


def test_change_password_too_short_new_password() -> None:
    token = _login(DEMO_EMAIL, DEMO_PASSWORD)
    res = client.post(
        "/api/auth/password",
        json={"current_password": DEMO_PASSWORD, "new_password": "short"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Pydantic min_length=8 gives 422
    assert res.status_code in (400, 422)


def test_change_password_unauthenticated() -> None:
    res = client.post(
        "/api/auth/password",
        json={"current_password": DEMO_PASSWORD, "new_password": "new-valid-pw"},
    )
    assert res.status_code == 401


def test_change_password_other_user() -> None:
    token = _login(OTHER_EMAIL, DEMO_PASSWORD)
    assert _change_password(token, DEMO_PASSWORD, "other-new-pw-456") == 204
    token2 = _login(OTHER_EMAIL, "other-new-pw-456")
    assert token2
    assert _change_password(token2, "other-new-pw-456", DEMO_PASSWORD) == 204


def test_change_password_audit_log_recorded() -> None:
    """Password change must produce a password_changed audit event (admin can see it)."""
    token = _login(DEMO_EMAIL, DEMO_PASSWORD)
    assert _change_password(token, DEMO_PASSWORD, "audit-test-pw-99") == 204

    audit_res = client.get(
        "/api/admin/audit-logs?action=password_changed",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert audit_res.status_code == 200
    entries = audit_res.json()
    assert any(e["action"] == "password_changed" for e in entries)

    # Restore
    token2 = _login(DEMO_EMAIL, "audit-test-pw-99")
    _change_password(token2, "audit-test-pw-99", DEMO_PASSWORD)
