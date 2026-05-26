"""Integration tests for user notification inbox endpoints (Issue #227)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ADMIN_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
OTHER_CREDS = {"email": "notified@arcsphere3d.dev", "password": "arcsphere-demo"}


def _get_admin_token() -> str:
    res = client.post("/api/auth/login", json=ADMIN_CREDS)
    assert res.status_code == 200
    return res.json()["access_token"]


def _get_other_token() -> str:
    admin_token = _get_admin_token()
    client.post(
        "/api/admin/users",
        json=OTHER_CREDS | {"role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    res = client.post("/api/auth/login", json=OTHER_CREDS)
    assert res.status_code == 200
    return res.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---- list ----


def test_list_notifications_empty_initially() -> None:
    token = _get_admin_token()
    res = client.get("/api/notifications", headers=_headers(token))
    assert res.status_code == 200
    assert res.json() == []


def test_list_notifications_only_own() -> None:
    """Notifications created for user A must not appear for user B."""
    admin_token = _get_admin_token()
    other_token = _get_other_token()

    # Create a project and add 'other' as member — triggers a notification for 'other'
    proj_res = client.post(
        "/api/projects",
        json={"name": "notify-test-proj"},
        headers=_headers(admin_token),
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    other_user_res = client.get("/api/users/me", headers=_headers(other_token))
    assert other_user_res.status_code == 200
    other_user_id = other_user_res.json()["id"]

    client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": other_user_id, "role": "viewer"},
        headers=_headers(admin_token),
    )

    other_notifs = client.get("/api/notifications", headers=_headers(other_token))
    assert other_notifs.status_code == 200
    assert len(other_notifs.json()) >= 1

    admin_notifs = client.get("/api/notifications", headers=_headers(admin_token))
    assert admin_notifs.status_code == 200
    for n in admin_notifs.json():
        assert n["user_id"] != other_user_id


# ---- unread count ----


def test_unread_count_reflects_new_notifications() -> None:
    admin_token = _get_admin_token()
    other_token = _get_other_token()

    res = client.get("/api/notifications/unread-count", headers=_headers(other_token))
    assert res.status_code == 200
    initial_count = res.json()["count"]

    proj_res = client.post(
        "/api/projects",
        json={"name": "count-test-proj"},
        headers=_headers(admin_token),
    )
    project_id = proj_res.json()["id"]

    other_user_id = client.get("/api/users/me", headers=_headers(other_token)).json()["id"]
    client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": other_user_id, "role": "viewer"},
        headers=_headers(admin_token),
    )

    res = client.get("/api/notifications/unread-count", headers=_headers(other_token))
    assert res.json()["count"] == initial_count + 1


# ---- mark one as read ----


def test_mark_notification_read() -> None:
    admin_token = _get_admin_token()
    other_token = _get_other_token()

    proj_id = client.post(
        "/api/projects",
        json={"name": "read-one-proj"},
        headers=_headers(admin_token),
    ).json()["id"]
    other_id = client.get("/api/users/me", headers=_headers(other_token)).json()["id"]
    client.post(
        f"/api/projects/{proj_id}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_headers(admin_token),
    )

    notifs = client.get("/api/notifications", headers=_headers(other_token)).json()
    assert len(notifs) >= 1
    notif_id = notifs[0]["id"]
    assert not notifs[0]["is_read"]

    res = client.patch(f"/api/notifications/{notif_id}/read", headers=_headers(other_token))
    assert res.status_code == 200
    assert res.json()["is_read"] is True


def test_mark_notification_read_other_user_gets_404() -> None:
    """User A cannot mark user B's notification as read."""
    admin_token = _get_admin_token()
    other_token = _get_other_token()

    proj_id = client.post(
        "/api/projects",
        json={"name": "idor-proj"},
        headers=_headers(admin_token),
    ).json()["id"]
    other_id = client.get("/api/users/me", headers=_headers(other_token)).json()["id"]
    client.post(
        f"/api/projects/{proj_id}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers=_headers(admin_token),
    )

    notif_id = client.get("/api/notifications", headers=_headers(other_token)).json()[0]["id"]

    # admin tries to mark other user's notification
    res = client.patch(f"/api/notifications/{notif_id}/read", headers=_headers(admin_token))
    assert res.status_code == 404


# ---- mark all as read ----


def test_mark_all_notifications_read() -> None:
    admin_token = _get_admin_token()
    other_token = _get_other_token()
    other_id = client.get("/api/users/me", headers=_headers(other_token)).json()["id"]

    for i in range(3):
        proj_id = client.post(
            "/api/projects",
            json={"name": f"all-read-proj-{i}"},
            headers=_headers(admin_token),
        ).json()["id"]
        client.post(
            f"/api/projects/{proj_id}/members",
            json={"user_id": other_id, "role": "viewer"},
            headers=_headers(admin_token),
        )

    count_before = client.get(
        "/api/notifications/unread-count", headers=_headers(other_token)
    ).json()["count"]
    assert count_before >= 3

    res = client.patch("/api/notifications/read-all", headers=_headers(other_token))
    assert res.status_code == 200
    assert res.json()["count"] >= 3

    count_after = client.get(
        "/api/notifications/unread-count", headers=_headers(other_token)
    ).json()["count"]
    assert count_after == 0


# ---- unread_only filter ----


def test_list_notifications_unread_only() -> None:
    admin_token = _get_admin_token()
    other_token = _get_other_token()
    other_id = client.get("/api/users/me", headers=_headers(other_token)).json()["id"]

    for i in range(2):
        proj_id = client.post(
            "/api/projects",
            json={"name": f"unread-filter-proj-{i}"},
            headers=_headers(admin_token),
        ).json()["id"]
        client.post(
            f"/api/projects/{proj_id}/members",
            json={"user_id": other_id, "role": "viewer"},
            headers=_headers(admin_token),
        )

    all_notifs = client.get("/api/notifications", headers=_headers(other_token)).json()
    assert len(all_notifs) >= 2

    first_id = all_notifs[0]["id"]
    client.patch(f"/api/notifications/{first_id}/read", headers=_headers(other_token))

    unread = client.get("/api/notifications?unread_only=true", headers=_headers(other_token)).json()
    assert all(not n["is_read"] for n in unread)
    assert len(unread) == len(all_notifs) - 1
