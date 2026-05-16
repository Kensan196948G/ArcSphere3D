# 🚀 ArcSphere3D · backend

FastAPI + SQLAlchemy + Alembic + JWT による REST API。MVP では **インメモリスタブ** で動作し、PostgreSQL + MinIO は post-MVP で接続する。

## Quick Start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env

uvicorn app.main:app --reload
# → http://localhost:8000/docs   (Swagger UI)
# → http://localhost:8000/healthz
```

## Endpoints (MVP)

| Method | Path | 説明 |
|---|---|---|
| GET  | `/healthz` | Liveness |
| GET  | `/readyz`  | Readiness |
| POST | `/api/auth/login`   | Email + Password → JWT |
| POST | `/api/auth/refresh` | アクセストークン再発行 |
| POST | `/api/auth/logout`  | (stateless) |
| GET  | `/api/projects`    | プロジェクト一覧 (auth required) |
| POST | `/api/projects`    | プロジェクト作成 |
| GET  | `/api/projects/{id}` | プロジェクト取得 |
| POST | `/api/files/upload?project_id=` | ファイルアップロード (200 MB 制限) |

### Demo credentials (MVP only)

```
email:    demo@arcsphere3d.dev
password: arcsphere-demo
```

## Tests

```bash
pytest -q
```

## Layout

```
backend/
├── pyproject.toml
├── app/
│   ├── main.py           # create_app()
│   ├── config.py         # Pydantic Settings
│   ├── logging.py        # structlog
│   ├── security.py       # JWT + bcrypt
│   ├── schemas.py        # Pydantic v2 models
│   ├── deps.py           # FastAPI dependencies (CurrentUser)
│   └── routers/
│       ├── health.py
│       ├── auth.py
│       ├── projects.py
│       └── files.py
└── tests/
    ├── test_health.py
    └── test_auth.py
```

## Roadmap

- [x] FastAPI スケルトン
- [x] JWT 発行 + 検証
- [x] In-memory project / file scaffold
- [ ] SQLAlchemy + Alembic (Postgres)
- [ ] MinIO 連携 (S3 互換)
- [ ] Entra ID SSO
- [ ] RBAC (`viewer` / `editor` / `admin`)
- [ ] Audit Log
