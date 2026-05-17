"""Integration tests for the project members (RBAC) API."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
OTHER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _login(creds: dict[str, str]) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(token: str, name: str = "Test Project") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201
    return res.json()["id"]


def _get_user_id(token: str) -> str:
    res = client.get("/api/users/me", headers=_auth(token))
    assert res.status_code == 200
    return res.json()["id"]


# ---- Auth guard ----


def test_members_requires_auth() -> None:
    pid = str(uuid.uuid4())
    res = client.get(f"/api/projects/{pid}/members")
    assert res.status_code == 401


# ---- List members ----


def test_list_members_empty() -> None:
    token = _login(DEMO_CREDS)
    pid = _create_project(token)
    res = client.get(f"/api/projects/{pid}/members", headers=_auth(token))
    assert res.status_code == 200
    assert res.json() == []


# ---- Add member ----


def test_add_member_returns_201() -> None:
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["user_id"] == other_id
    assert body["role"] == "editor"
    assert body["project_id"] == pid


def test_add_member_updates_existing_role() -> None:
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    assert res.json()["role"] == "viewer"


def test_add_member_invalid_role_rejected() -> None:
    token = _login(DEMO_CREDS)
    pid = _create_project(token)
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": str(uuid.uuid4()), "role": "superuser"},
        headers=_auth(token),
    )
    assert res.status_code in (400, 422)


# ---- Remove member ----


def test_remove_member_returns_204() -> None:
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers=_auth(token),
    )
    res = client.delete(f"/api/projects/{pid}/members/{other_id}", headers=_auth(token))
    assert res.status_code == 204


def test_remove_nonexistent_member_returns_404() -> None:
    token = _login(DEMO_CREDS)
    pid = _create_project(token)
    fake_uid = str(uuid.uuid4())
    res = client.delete(f"/api/projects/{pid}/members/{fake_uid}", headers=_auth(token))
    assert res.status_code == 404


# ---- IDOR protection ----


def test_other_user_cannot_list_members() -> None:
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)

    res = client.get(f"/api/projects/{pid}/members", headers=_auth(other_token))
    assert res.status_code == 404
