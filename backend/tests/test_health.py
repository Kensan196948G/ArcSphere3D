from fastapi.testclient import TestClient

from app.main import app


def test_healthz_ok() -> None:
    client = TestClient(app)
    res = client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_readyz_ok() -> None:
    client = TestClient(app)
    res = client.get("/readyz")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ready"
    assert body["db"] == "ok"


def test_healthz_does_not_check_db() -> None:
    """Liveness probe must return 200 regardless of DB state."""
    client = TestClient(app)
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json().get("db") is None
