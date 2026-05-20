"""Integration tests for the vertical alignment CRUD API."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
OTHER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _get_token(creds: dict[str, str] = DEMO_CREDS) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(token: str, name: str = "VA Project") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201
    return res.json()["id"]


def _create_alignment(token: str, pid: str, name: str = "Route A") -> str:
    res = client.post(
        f"/api/projects/{pid}/alignments",
        json={"name": name, "design_speed": 60},
        headers=_auth(token),
    )
    assert res.status_code == 201
    return res.json()["id"]


def _get_user_id(token: str) -> str:
    return client.get("/api/users/me", headers=_auth(token)).json()["id"]


def _add_member(owner_token: str, pid: str, user_id: str, role: str) -> None:
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": user_id, "role": role},
        headers=_auth(owner_token),
    )
    assert res.status_code == 201


# ---- Auth guard ----


def test_verticals_requires_auth() -> None:
    import uuid

    pid = str(uuid.uuid4())
    aid = str(uuid.uuid4())
    res = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals")
    assert res.status_code == 401


# ---- CRUD happy path ----


def test_create_vertical_returns_201() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    res = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断A"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "縦断A"
    assert body["alignment_id"] == aid
    assert body["vips"] == []


def test_list_verticals() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断B"},
        headers=_auth(token),
    )
    res = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals", headers=_auth(token))
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "縦断B"


def test_get_vertical() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    vid = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断C"},
        headers=_auth(token),
    ).json()["id"]

    res = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}", headers=_auth(token))
    assert res.status_code == 200
    assert res.json()["id"] == vid


def test_delete_vertical() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    vid = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断D"},
        headers=_auth(token),
    ).json()["id"]

    res = client.delete(
        f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}", headers=_auth(token)
    )
    assert res.status_code == 204

    res2 = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}", headers=_auth(token))
    assert res2.status_code == 404


# ---- VIP sync ----


def test_replace_vips() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    vid = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断E"},
        headers=_auth(token),
    ).json()["id"]

    base_url = f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}/vips"
    payload = [
        {"seq": 0, "station": 0.0, "elevation": 100.0, "vc_length": 0.0},
        {"seq": 1, "station": 500.0, "elevation": 120.0, "vc_length": 80.0},
        {"seq": 2, "station": 1000.0, "elevation": 110.0, "vc_length": 60.0},
    ]
    res = client.put(base_url, json=payload, headers=_auth(token))
    assert res.status_code == 200
    pts = res.json()
    assert len(pts) == 3
    assert pts[0]["seq"] == 0
    assert pts[1]["station"] == 500.0
    assert pts[1]["vc_length"] == 80.0


def test_replace_vips_clears_previous() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    vid = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断F"},
        headers=_auth(token),
    ).json()["id"]

    base_url = f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}/vips"
    client.put(
        base_url,
        json=[{"seq": 0, "station": 0.0, "elevation": 100.0, "vc_length": 0.0}],
        headers=_auth(token),
    )
    res = client.put(base_url, json=[], headers=_auth(token))
    assert res.status_code == 200
    assert res.json() == []


def test_vips_returned_with_vertical_detail() -> None:
    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    vid = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断G"},
        headers=_auth(token),
    ).json()["id"]

    client.put(
        f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}/vips",
        json=[{"seq": 0, "station": 0.0, "elevation": 100.0, "vc_length": 0.0}],
        headers=_auth(token),
    )

    res = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}", headers=_auth(token))
    assert res.status_code == 200
    assert len(res.json()["vips"]) == 1
    assert res.json()["vips"][0]["elevation"] == 100.0


# ---- Error cases ----


def test_get_vertical_not_found() -> None:
    import uuid

    token = _get_token()
    pid = _create_project(token)
    aid = _create_alignment(token, pid)
    res = client.get(
        f"/api/projects/{pid}/alignments/{aid}/verticals/{uuid.uuid4()}",
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_vertical_wrong_alignment_returns_404() -> None:
    """A vertical from alignment A must not be accessible via alignment B."""
    token = _get_token()
    pid = _create_project(token)
    aid_a = _create_alignment(token, pid, "Route A")
    aid_b = _create_alignment(token, pid, "Route B")
    vid = client.post(
        f"/api/projects/{pid}/alignments/{aid_a}/verticals",
        json={"name": "縦断H"},
        headers=_auth(token),
    ).json()["id"]

    res = client.get(
        f"/api/projects/{pid}/alignments/{aid_b}/verticals/{vid}", headers=_auth(token)
    )
    assert res.status_code == 404


def test_vertical_nonexistent_alignment_returns_404() -> None:
    import uuid

    token = _get_token()
    pid = _create_project(token)
    res = client.get(
        f"/api/projects/{pid}/alignments/{uuid.uuid4()}/verticals",
        headers=_auth(token),
    )
    assert res.status_code == 404


# ---- RBAC member access ----


def test_viewer_can_list_verticals() -> None:
    owner = _get_token()
    viewer = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断I"},
        headers=_auth(owner),
    )
    _add_member(owner, pid, _get_user_id(viewer), "viewer")
    res = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals", headers=_auth(viewer))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_viewer_cannot_create_vertical() -> None:
    owner = _get_token()
    viewer = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    _add_member(owner, pid, _get_user_id(viewer), "viewer")
    res = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断J"},
        headers=_auth(viewer),
    )
    assert res.status_code == 403


def test_editor_can_create_vertical() -> None:
    owner = _get_token()
    editor = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    _add_member(owner, pid, _get_user_id(editor), "editor")
    res = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": "縦断K"},
        headers=_auth(editor),
    )
    assert res.status_code == 201


def test_non_member_gets_404() -> None:
    owner = _get_token()
    other = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    res = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals", headers=_auth(other))
    assert res.status_code == 404


def _create_vertical(owner_token: str, pid: str, aid: str, name: str = "縦断L") -> str:
    res = client.post(
        f"/api/projects/{pid}/alignments/{aid}/verticals",
        json={"name": name},
        headers=_auth(owner_token),
    )
    assert res.status_code == 201
    return res.json()["id"]


# ---- RBAC: GET single / DELETE / PUT vips (Issue #85) ----


def test_viewer_can_get_vertical() -> None:
    """A viewer may read a single vertical alignment (min_role=viewer)."""
    owner = _get_token()
    viewer = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    vid = _create_vertical(owner, pid, aid)
    _add_member(owner, pid, _get_user_id(viewer), "viewer")

    res = client.get(f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}", headers=_auth(viewer))
    assert res.status_code == 200
    assert res.json()["id"] == vid


def test_viewer_cannot_delete_vertical_gets_403() -> None:
    """A viewer may not delete vertical alignments — min_role=editor required."""
    owner = _get_token()
    viewer = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    vid = _create_vertical(owner, pid, aid)
    _add_member(owner, pid, _get_user_id(viewer), "viewer")

    res = client.delete(
        f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}", headers=_auth(viewer)
    )
    assert res.status_code == 403


def test_editor_can_delete_vertical() -> None:
    """An editor may delete vertical alignments."""
    owner = _get_token()
    editor = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    vid = _create_vertical(owner, pid, aid)
    _add_member(owner, pid, _get_user_id(editor), "editor")

    res = client.delete(
        f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}", headers=_auth(editor)
    )
    assert res.status_code == 204


def test_viewer_cannot_replace_vips_gets_403() -> None:
    """A viewer may not update VIPs — min_role=editor required."""
    owner = _get_token()
    viewer = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    vid = _create_vertical(owner, pid, aid)
    _add_member(owner, pid, _get_user_id(viewer), "viewer")

    res = client.put(
        f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}/vips",
        json=[{"seq": 0, "station": 0.0, "elevation": 10.0, "vc_length": 0.0}],
        headers=_auth(viewer),
    )
    assert res.status_code == 403


def test_editor_can_replace_vips() -> None:
    """An editor may update VIPs."""
    owner = _get_token()
    editor = _get_token(OTHER_CREDS)
    pid = _create_project(owner)
    aid = _create_alignment(owner, pid)
    vid = _create_vertical(owner, pid, aid)
    _add_member(owner, pid, _get_user_id(editor), "editor")

    res = client.put(
        f"/api/projects/{pid}/alignments/{aid}/verticals/{vid}/vips",
        json=[
            {"seq": 0, "station": 0.0, "elevation": 10.0, "vc_length": 0.0},
            {"seq": 1, "station": 100.0, "elevation": 20.0, "vc_length": 50.0},
        ],
        headers=_auth(editor),
    )
    assert res.status_code == 200
    assert len(res.json()) == 2
