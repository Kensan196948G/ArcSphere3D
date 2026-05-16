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
    assert res.json()["status"] == "ready"
