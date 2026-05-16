# ADR 0002 — In-memory store から Postgres + SQLAlchemy 2 + Alembic への移行

- **Date**: 2026-05-16
- **Status**: Accepted
- **Deciders**: CTO (full delegation), engineering
- **Note on numbering**: ADR-0001 の Follow-ups では 0002 を「JWT 鍵管理」と予告したが、優先度を見直し本 ADR を Postgres 移行に充当する。JWT 鍵管理は **ADR-0003** に繰り下げ。

## Context

MVP 現状:

- `app/routers/projects.py` の `_PROJECTS: dict[UUID, ProjectOut]` (`threading.Lock` 保護) と `app/routers/files.py` の **uploaded byte は in-memory で破棄** という暫定実装。
- uvicorn 再起動で全データ消失 → demo session を跨ぐ評価ができない。
- 並行制約は H2 (本 PR #14) で lock 化済みだが、root-cause は store の永続化不在。
- ownership は H1 で `uuid5(NAMESPACE_DNS, 'arcsphere3d.dev/owner')` → `uuid5(ns, user.sub)` の deterministic 構造に固定済 → そのまま FK として Postgres に back-fill 可能。
- API contract は `docs/api/contract-v1.yaml` (FastAPI openapi export, x-frozen-at: 2026-05-16) で凍結済 → 移行は contract-preserving でなければならない。

## Decision

### スタック
- **RDBMS**: PostgreSQL 16 (compose の `db` サービス、既に provisioning 済)
- **Driver**: `psycopg[binary]` 3.x (FastAPI lifespan で async pool)
- **ORM**: SQLAlchemy 2.x (typed Mapped[] / Annotated style、`declarative_base` は使わず `MappedAsDataclass` ベース)
- **Migration**: Alembic 1.13+ (autogenerate + 手書き併用、autogenerate diff は **必ず人間レビュー**)
- **Object storage**: MinIO (compose の `minio` サービス、bucket = `arcsphere3d`、 ADR-0001 で確定)

### スキーマ (v1)

```sql
CREATE TABLE users (
    id           UUID PRIMARY KEY,
    sub          TEXT NOT NULL UNIQUE,   -- JWT sub と 1:1
    email        CITEXT NOT NULL UNIQUE,
    role         TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id           UUID PRIMARY KEY,
    owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_owner_idx ON projects(owner_id);

CREATE TABLE files (
    id            UUID PRIMARY KEY,
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    size_bytes    BIGINT NOT NULL CHECK (size_bytes >= 0),
    content_type  TEXT NOT NULL,
    s3_key        TEXT NOT NULL UNIQUE,    -- "{project_id}/{file_id}/{filename}"
    sha256        BYTEA NOT NULL,          -- 重複排除と整合性
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX files_project_idx ON files(project_id);
```

### 移行方針 (contract-preserving)

1. **新規 PR でモジュール構造のみ追加** (`app/db/`, `app/models/`, `alembic/`) — 既存 router は触らない。
2. **次の PR で router を切替**: `_PROJECTS` dict を SQLAlchemy session に置換。API path/response shape は `contract-v1.yaml` と diff ゼロを CI で強制 (`schemathesis` または手書き比較 script)。
3. **upload 実装**: in-memory `read()` ループを廃止し、MinIO に `put_object` (stream) → `files` テーブルに metadata 行を INSERT。`sha256` は upload 中に計算。
4. **owner_id back-fill**: 既存 demo データは存在しないため migration 不要。new user login 時に `users` 行を upsert (`ON CONFLICT (sub) DO NOTHING RETURNING id`)。

### Codex 対抗レビュー必須

CLAUDE.md 「認証・認可・DB スキーマ・並列処理変更時は **Codex 対抗レビュー (`/codex:adversarial-review`)** を必須」に該当 → 切替 PR で必ず実施 (本 ADR 採択 PR ではスキーマ提案のみのため不要)。

## Consequences (positive)

- demo session を跨いだ評価が可能 (uvicorn 再起動 = データ保全)
- IDOR / ownership は DB layer の FK + `WHERE owner_id = :uid` で defence-in-depth
- 6 ヶ月計画の Month 3-4 「品質向上」フェーズに自然に乗る
- `files.sha256 UNIQUE` で content-addressed dedup の余地

## Consequences (negative / mitigations)

| 短所 | 緩和策 |
|---|---|
| Alembic autogenerate は型推論が雑 (CITEXT, ENUM, partial index 漏れ) | 全 migration を人間 review、CI で `alembic check` 相当を実行 |
| async psycopg + SQLAlchemy 2 の `MappedAsDataclass` は学習コスト | 切替 PR の説明文に最小サンプル添付、後続レビュアーへのオンボーディング |
| MinIO の eventual consistency (古い MinIO) | MinIO 2024+ は strong consistency、compose 固定バージョンで担保 |
| FK CASCADE による意図せぬ大量削除 | `DELETE /projects/{id}` には 2-step confirm を実装 (frontend) |

## Out of scope (deferred)

- 行レベル暗号化 (pgcrypto): post-MVP、SOC2 準備時に再評価
- Read replica / connection pool 外出し (PgBouncer): MVP では不要
- multi-tenant 化: org_id 列の追加は **post-MVP**、ただし `projects` テーブルは将来 `org_id` を nullable で追加可能な構造

## Follow-ups

- **ADR-0003** — JWT 鍵管理 (HS256 → RS256 + KMS) ※ ADR-0001 の元 0002
- **ADR-0004** — Production 配置 (compose → K8s)
- **ADR-0005** — 大ファイル upload の resumable (TUS) 採用可否
