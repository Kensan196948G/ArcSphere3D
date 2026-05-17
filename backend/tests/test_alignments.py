"""Integration tests for the alignments CRUD API."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}


def _get_token() -> str:
    res = client.post("/api/auth/login", json=DEMO_CREDS)
    assert res.status_code == 200
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(token: str, name: str = "Test Project") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201
    return res.json()["id"]


# ---- Auth guard ----


def test_alignments_requires_auth() -> None:
    import uuid

    pid = str(uuid.uuid4())
    res = client.get(f"/api/projects/{pid}/alignments")
    assert res.status_code == 401


# ---- CRUD happy path ----


def test_create_alignment_returns_201() -> None:
    token = _get_token()
    pid = _create_project(token)
    res = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "Route A", "design_speed": 60},
        headers=_auth(token),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Route A"
    assert body["design_speed"] == 60
    assert body["project_id"] == pid
    assert body["ip_points"] == []


def test_list_alignments() -> None:
    token = _get_token()
    pid = _create_project(token)
    client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "Route B", "design_speed": 80},
        headers=_auth(token),
    )
    res = client.get(f"/api/projects/{pid}/alignments", headers=_auth(token))
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Route B"


def test_get_alignment() -> None:
    token = _get_token()
    pid = _create_project(token)
    created = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "Route C", "design_speed": 40},
        headers=_auth(token),
    ).json()
    aid = created["id"]

    res = client.get(f"/api/projects/{pid}/alignments/{aid}", headers=_auth(token))
    assert res.status_code == 200
    assert res.json()["id"] == aid


def test_delete_alignment() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "Route D"},
        headers=_auth(token),
    ).json()["id"]

    res = client.delete(f"/api/projects/{pid}/alignments/{aid}", headers=_auth(token))
    assert res.status_code == 204

    res2 = client.get(f"/api/projects/{pid}/alignments/{aid}", headers=_auth(token))
    assert res2.status_code == 404


# ---- IP point sync ----


def test_replace_ip_points() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "Route E"},
        headers=_auth(token),
    ).json()["id"]

    ip_payload = [
        {"seq": 0, "x": 100.0, "z": 200.0, "radius": 50.0},
        {"seq": 1, "x": 300.0, "z": 400.0, "radius": 80.0},
    ]
    res = client.put(
        f"/api/projects/{pid}/alignments/{aid}/ip-points",
        json=ip_payload,
        headers=_auth(token),
    )
    assert res.status_code == 200
    pts = res.json()
    assert len(pts) == 2
    assert pts[0]["seq"] == 0
    assert pts[1]["radius"] == 80.0


def test_replace_ip_points_clears_previous() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "Route F"},
        headers=_auth(token),
    ).json()["id"]

    base_url = f"/api/projects/{pid}/alignments/{aid}/ip-points"
    client.put(
        base_url, json=[{"seq": 0, "x": 1.0, "z": 2.0, "radius": 10.0}], headers=_auth(token)
    )
    res = client.put(base_url, json=[], headers=_auth(token))
    assert res.status_code == 200
    assert res.json() == []


# ---- Error cases ----


def test_get_alignment_not_found() -> None:
    import uuid

    token = _get_token()
    pid = _create_project(token)
    res = client.get(
        f"/api/projects/{pid}/alignments/{uuid.uuid4()}",
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_alignment_wrong_project_returns_404() -> None:
    """An alignment from project A must not be accessible via project B."""
    token = _get_token()
    pid_a = _create_project(token, "Project A")
    pid_b = _create_project(token, "Project B")
    aid = client.post(
        f"/api/projects/{pid_a}/alignments",
        json={"name": "Route G"},
        headers=_auth(token),
    ).json()["id"]

    res = client.get(f"/api/projects/{pid_b}/alignments/{aid}", headers=_auth(token))
    assert res.status_code == 404


# ---- RBAC member access ----

OTHER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _get_other_token() -> str:
    res = client.post("/api/auth/login", json=OTHER_CREDS)
    assert res.status_code == 200
    return res.json()["access_token"]


def _get_user_id(token: str) -> str:
    res = client.get("/api/users/me", headers=_auth(token))
    assert res.status_code == 200
    return res.json()["id"]


def _add_member(owner_token: str, project_id: str, user_id: str, role: str) -> None:
    res = client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": user_id, "role": role},
        headers=_auth(owner_token),
    )
    assert res.status_code == 201


def test_viewer_can_list_alignments() -> None:
    owner = _get_token()
    viewer = _get_other_token()
    pid = _create_project(owner)
    client.post(f"/api/projects/{pid}/alignments", json={"name": "R1"}, headers=_auth(owner))
    _add_member(owner, pid, _get_user_id(viewer), "viewer")
    res = client.get(f"/api/projects/{pid}/alignments", headers=_auth(viewer))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_viewer_cannot_create_alignment() -> None:
    owner = _get_token()
    viewer = _get_other_token()
    pid = _create_project(owner)
    _add_member(owner, pid, _get_user_id(viewer), "viewer")
    res = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "R1"},
        headers=_auth(viewer),
    )
    assert res.status_code == 403


def test_editor_can_create_alignment() -> None:
    owner = _get_token()
    editor = _get_other_token()
    pid = _create_project(owner)
    _add_member(owner, pid, _get_user_id(editor), "editor")
    res = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": "R1"},
        headers=_auth(editor),
    )
    assert res.status_code == 201


def test_non_member_gets_404_not_403() -> None:
    owner = _get_token()
    other = _get_other_token()
    pid = _create_project(owner)
    res = client.get(f"/api/projects/{pid}/alignments", headers=_auth(other))
    assert res.status_code == 404
