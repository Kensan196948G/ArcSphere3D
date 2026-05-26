"""Integration tests for tag management — Issue #229."""

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


def _create_project(token: str, name: str = "Tag Test Project") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _create_tag(token: str, name: str = "test-tag", color: str = "#3b82f6") -> str:
    res = client.post("/api/tags", json={"name": name, "color": color}, headers=_auth(token))
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _get_user_id(token: str) -> str:
    res = client.get("/api/users/me", headers=_auth(token))
    assert res.status_code == 200
    return res.json()["id"]


# ---- GET /api/tags ----

def test_list_tags_empty() -> None:
    token = _login(DEMO_CREDS)
    res = client.get("/api/tags", headers=_auth(token))
    assert res.status_code == 200
    assert res.json() == []


def test_list_tags_unauthenticated() -> None:
    res = client.get("/api/tags")
    assert res.status_code == 401


# ---- POST /api/tags ----

def test_create_tag() -> None:
    token = _login(DEMO_CREDS)
    res = client.post("/api/tags", json={"name": "construction", "color": "#ef4444"}, headers=_auth(token))
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "construction"
    assert data["color"] == "#ef4444"
    assert "id" in data
    assert "created_at" in data


def test_create_tag_default_color() -> None:
    token = _login(DEMO_CREDS)
    res = client.post("/api/tags", json={"name": "no-color"}, headers=_auth(token))
    assert res.status_code == 201
    assert res.json()["color"] == "#6366f1"


def test_create_tag_duplicate_name() -> None:
    token = _login(DEMO_CREDS)
    client.post("/api/tags", json={"name": "duplicate"}, headers=_auth(token))
    res = client.post("/api/tags", json={"name": "duplicate"}, headers=_auth(token))
    assert res.status_code == 409


def test_create_tag_invalid_color() -> None:
    token = _login(DEMO_CREDS)
    res = client.post("/api/tags", json={"name": "bad-color", "color": "red"}, headers=_auth(token))
    assert res.status_code == 422


def test_create_tag_unauthenticated() -> None:
    res = client.post("/api/tags", json={"name": "unauth"})
    assert res.status_code == 401


def test_list_tags_after_create() -> None:
    token = _login(DEMO_CREDS)
    _create_tag(token, "alpha")
    _create_tag(token, "beta")
    res = client.get("/api/tags", headers=_auth(token))
    assert res.status_code == 200
    names = [t["name"] for t in res.json()]
    assert "alpha" in names
    assert "beta" in names


# ---- DELETE /api/tags/{id} ----

def test_delete_tag_by_creator() -> None:
    token = _login(DEMO_CREDS)
    tag_id = _create_tag(token, "to-delete")
    res = client.delete(f"/api/tags/{tag_id}", headers=_auth(token))
    assert res.status_code == 204
    # Confirm gone
    tags = client.get("/api/tags", headers=_auth(token)).json()
    assert all(t["id"] != tag_id for t in tags)


def test_delete_tag_not_found() -> None:
    token = _login(DEMO_CREDS)
    res = client.delete("/api/tags/00000000-0000-0000-0000-000000000000", headers=_auth(token))
    assert res.status_code == 404


def test_delete_tag_by_non_creator_non_admin() -> None:
    owner_token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    tag_id = _create_tag(owner_token, "owner-tag")
    res = client.delete(f"/api/tags/{tag_id}", headers=_auth(other_token))
    assert res.status_code == 403


# ---- GET /api/projects/{id}/tags ----

def test_list_project_tags_empty() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.get(f"/api/projects/{project_id}/tags", headers=_auth(token))
    assert res.status_code == 200
    assert res.json() == []


# ---- POST /api/projects/{id}/tags/{tag_id} ----

def test_add_tag_to_project() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    tag_id = _create_tag(token, "infra")
    res = client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
    assert res.status_code == 204
    tags = client.get(f"/api/projects/{project_id}/tags", headers=_auth(token)).json()
    assert any(t["id"] == tag_id for t in tags)


def test_add_tag_idempotent() -> None:
    """Adding the same tag twice should not fail."""
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    tag_id = _create_tag(token, "idempotent")
    client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
    res = client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
    assert res.status_code == 204


def test_add_tag_to_project_not_found() -> None:
    token = _login(DEMO_CREDS)
    tag_id = _create_tag(token, "orphan-tag")
    res = client.post(
        f"/api/projects/00000000-0000-0000-0000-000000000000/tags/{tag_id}",
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_add_tag_not_found() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.post(
        f"/api/projects/{project_id}/tags/00000000-0000-0000-0000-000000000000",
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_add_tag_viewer_forbidden() -> None:
    owner_token = _login(DEMO_CREDS)
    viewer_token = _login(OTHER_CREDS)
    project_id = _create_project(owner_token)
    tag_id = _create_tag(owner_token, "viewer-block")
    viewer_id = _get_user_id(viewer_token)
    # Add viewer as member
    client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": viewer_id, "role": "viewer"},
        headers=_auth(owner_token),
    )
    res = client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(viewer_token))
    assert res.status_code == 403


# ---- DELETE /api/projects/{id}/tags/{tag_id} ----

def test_remove_tag_from_project() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    tag_id = _create_tag(token, "to-remove")
    client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
    res = client.delete(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
    assert res.status_code == 204
    tags = client.get(f"/api/projects/{project_id}/tags", headers=_auth(token)).json()
    assert all(t["id"] != tag_id for t in tags)


def test_remove_tag_not_attached() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    tag_id = _create_tag(token, "not-attached")
    res = client.delete(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
    assert res.status_code == 404


# ---- GET /api/projects?tag=xxx ----

def test_list_projects_with_tag_filter() -> None:
    token = _login(DEMO_CREDS)
    p1_id = _create_project(token, "Project Alpha")
    p2_id = _create_project(token, "Project Beta")
    tag_id = _create_tag(token, "filter-tag")
    client.post(f"/api/projects/{p1_id}/tags/{tag_id}", headers=_auth(token))
    res = client.get("/api/projects?tag=filter-tag", headers=_auth(token))
    assert res.status_code == 200
    ids = [p["id"] for p in res.json()]
    assert p1_id in ids
    assert p2_id not in ids


def test_list_projects_include_tags_in_response() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token, "Tagged Project")
    tag_id = _create_tag(token, "response-tag")
    client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
    projects = client.get("/api/projects", headers=_auth(token)).json()
    project = next((p for p in projects if p["id"] == project_id), None)
    assert project is not None
    assert any(t["id"] == tag_id for t in project["tags"])
