"""Integration tests for PUT /api/projects/{id} (project rename)."""

from __future__ import annotations

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


def _add_member(token: str, project_id: str, user_id: str, role: str = "editor") -> None:
    res = client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": user_id, "role": role},
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text


# ---- PUT /api/projects/{id} — rename ----------------------------------------


def test_rename_unauthenticated() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.put(f"/api/projects/{project_id}", json={"name": "New Name"})
    assert res.status_code == 401


def test_rename_by_owner() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token, "Original Name")
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Renamed Project"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Renamed Project"
    assert data["id"] == project_id


def test_rename_by_editor() -> None:
    owner_token = _login(DEMO_CREDS)
    editor_token = _login(OTHER_CREDS)
    project_id = _create_project(owner_token, "Editor Rename Test")
    editor_id = _get_user_id(editor_token)
    _add_member(owner_token, project_id, editor_id, role="editor")
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Editor Renamed"},
        headers=_auth(editor_token),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Editor Renamed"


def test_rename_by_viewer_forbidden() -> None:
    owner_token = _login(DEMO_CREDS)
    viewer_token = _login(OTHER_CREDS)
    project_id = _create_project(owner_token, "Viewer Rename Test")
    viewer_id = _get_user_id(viewer_token)
    _add_member(owner_token, project_id, viewer_id, role="viewer")
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Should Fail"},
        headers=_auth(viewer_token),
    )
    assert res.status_code == 403


def test_rename_nonexistent_project() -> None:
    token = _login(DEMO_CREDS)
    res = client.put(
        "/api/projects/00000000-0000-0000-0000-000000000000",
        json={"name": "Ghost"},
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_rename_other_users_project_not_found() -> None:
    owner_token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    project_id = _create_project(owner_token, "Private Project")
    # other user is not a member — must see 404 (not 403, IDOR protection)
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Hijack Attempt"},
        headers=_auth(other_token),
    )
    assert res.status_code == 404


def test_rename_empty_name_rejected() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": ""},
        headers=_auth(token),
    )
    assert res.status_code in (400, 422)


def test_rename_nul_byte_rejected() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "bad\x00name"},
        headers=_auth(token),
    )
    assert res.status_code in (400, 422)
