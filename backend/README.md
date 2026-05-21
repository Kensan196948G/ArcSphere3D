# 🚀 ArcSphere3D · backend

FastAPI + SQLAlchemy + Alembic + JWT (RS256) による REST API。**PostgreSQL 16 + MinIO** に接続済み。認証は現状デモユーザー固定（本番化には Entra ID SSO + DB ユーザー管理が必要）。

## Quick Start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env

uvicorn app.main:app --reload
# → http://localhost:8000/docs   (Swagger UI)
# → http://localhost:8000/healthz
```

## Endpoints

| Method | Path                              | 説明                                     |
| ------ | --------------------------------- | ---------------------------------------- |
| GET    | `/healthz`                        | Liveness                                 |
| GET    | `/readyz`                         | Readiness                                |
| GET    | `/api/auth/.well-known/jwks.json` | JWKS (RS256 public key)                  |
| POST   | `/api/auth/login`                 | Email + Password → JWT                   |
| POST   | `/api/auth/refresh`               | アクセストークン再発行                   |
| POST   | `/api/auth/logout`                | (stateless)                              |
| GET    | `/api/projects`                   | プロジェクト一覧 (auth required)         |
| POST   | `/api/projects`                   | プロジェクト作成                         |
| GET    | `/api/projects/{id}`              | プロジェクト取得                         |
| GET    | `/api/projects/{id}/members`      | メンバー一覧 (RBAC: owner/editor/viewer) |
| POST   | `/api/projects/{id}/members`      | メンバー追加                             |
| GET    | `/api/files`                      | ファイル一覧                             |
| POST   | `/api/files/upload?project_id=`   | ファイルアップロード (200 MB 制限)       |
| GET    | `/api/alignments`                 | 線形データ一覧                           |
| GET    | `/api/verticals`                  | 縦断データ一覧                           |
| GET    | `/api/users/me`                   | 現在のユーザー情報                       |

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
│   ├── main.py           # create_app(), lifespan
│   ├── config.py         # Pydantic Settings (env, JWT RS256, DB, S3)
│   ├── logging.py        # structlog JSON
│   ├── security.py       # bcrypt + JWT RS256, JWKS
│   ├── schemas.py        # Pydantic v2 models
│   ├── deps.py           # CurrentUser DI
│   ├── ratelimit.py      # SimpleRateLimiter
│   ├── s3.py             # MinIO / S3 wrapper (boto3)
│   ├── db/
│   │   ├── session.py    # SQLAlchemy engine + session
│   │   ├── crud.py       # CRUD helpers + RBAC
│   │   └── base.py       # DeclarativeBase
│   ├── models/
│   │   ├── project.py
│   │   ├── file.py
│   │   ├── project_member.py
│   │   ├── user.py
│   │   └── alignment.py
│   └── routers/
│       ├── health.py
│       ├── auth.py       # demo users (MVP) — replace with DB + Entra ID
│       ├── projects.py
│       ├── files.py
│       ├── users.py
│       ├── alignments.py
│       ├── verticals.py
│       └── project_members.py
└── tests/
    └── ...               # pytest + httpx, coverage ≥ 80%
```

## Roadmap

- [x] FastAPI スケルトン + lifespan
- [x] JWT RS256 発行 + 検証 + JWKS endpoint
- [x] SQLAlchemy + Alembic (Postgres 16)
- [x] MinIO / S3 連携 (boto3)
- [x] RBAC: owner / editor / viewer (3 段階, IDOR 404 防御)
- [x] 線形・縦断 API (alignment / verticals)
- [x] Rate limiter (login brute-force 防御)
- [ ] Entra ID SSO + DB ユーザー管理 (demo users 廃止)
- [ ] Refresh token + セッション失効
- [ ] 監査ログ (audit_logs テーブル)
- [ ] Multipart / resumable upload (大容量対応)
- [ ] ウイルススキャン (ClamAV)
