# 🐳 docker/ — local runtime

MVP は **backend が in-memory** で動くため compose 起動は必須ではないが、post-MVP の Postgres / MinIO 統合に向けて先に整備してある。

## Files

| File | 役割 |
|---|---|
| `docker-compose.yml` | db / redis / minio / minio-init / backend をまとめて起動 |
| `Dockerfile.backend` | FastAPI を `python:3.12-slim` で動かす |
| `Dockerfile.frontend` | Vite build → nginx 配信のマルチステージ |
| `nginx.conf` | SPA fallback + `/api/` を backend にプロキシ |

## Quick Start

```bash
cp .env.example .env

# インフラだけ起動 (frontend は host で `npm run dev` の方が DX 良い)
docker compose -f docker/docker-compose.yml up -d db redis minio minio-init

# フルスタック起動
docker compose -f docker/docker-compose.yml up --build
```

エンドポイント:

- backend  : http://localhost:8000/docs
- MinIO API: http://localhost:9000
- MinIO UI : http://localhost:9001  (`arc` / `arc-secret`)
- Postgres : `postgresql://arc:arc@localhost:5432/arcsphere3d`

## Notes

- `minio-init` は起動時にバケット `arcsphere3d` を作成する init コンテナ。
- backend は `/healthz` で healthcheck し、失敗時は restart される。
- Production では `JWT_SECRET` / DB / MinIO 認証情報を **Secrets Manager** から注入すること。compose の値は dev only。
