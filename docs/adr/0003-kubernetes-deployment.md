# ADR-0003: Kubernetes Deployment Architecture

**Date**: 2026-05-25
**Status**: Accepted
**Deciders**: CTO

---

## Context

ArcSphere3D は現在 Docker Compose (MVP) でデプロイされているが、本番運用に向けて
以下の課題がある:

- 単一ホスト障害でのサービス停止
- 水平スケーリング不可 (backend replicas)
- ゼロダウンタイムデプロイ不可
- リソース制限・オートスケーリング未整備

## Decision

**Kubernetes (k8s) を本番インフラとして採用する。**

### コンポーネント構成

| コンポーネント | Kind | replicas | Storage |
|---|---|---|---|
| PostgreSQL 16 | StatefulSet | 1 | 10Gi PVC |
| Redis 7 | Deployment | 1 | - (ephemeral) |
| MinIO | StatefulSet | 1 | 50Gi PVC |
| backend (FastAPI) | Deployment | 2 | - |
| frontend (nginx) | Deployment | 2 | - |

### 認証・Secret 管理

- `arcsphere3d-secrets` Secret に以下を格納:
  - `JWT_PRIVATE_KEY_PEM` / `JWT_PUBLIC_KEY_PEM` — RS256 非対称鍵
  - `POSTGRES_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- 本番では [External Secrets Operator](https://external-secrets.io/) または
  Azure Key Vault CSI Driver を使用する

### WebSocket サポート

- Ingress に `Upgrade` / `Connection: upgrade` ヘッダーを設定
- `/api/ws/*` エンドポイントは nginx ingress の sticky session 不要
  (JWT 認証がステートレスのため)

### スケーリング戦略

```yaml
# backend HPA (future)
minReplicas: 2
maxReplicas: 10
targetCPUUtilizationPercentage: 70
```

## Consequences

### Positive
- backend 2 replicas でゼロダウンタイムローリングアップデート
- PVC で PostgreSQL / MinIO データ永続化
- Ingress で TLS termination と WebSocket プロキシを一元管理

### Negative / Risks
- PostgreSQL は StatefulSet replicas=1 — HA には別途 Patroni または
  CloudSQL/AzureDB への移行が必要 (post-MVP)
- MinIO は single-node — 本番大規模利用時は AzureBlob/S3 ネイティブへの移行が望ましい

### Migration from Docker Compose
1. `kubectl apply -f infra/k8s/namespace.yaml`
2. `infra/k8s/secret.yaml.example` を `secret.yaml` にコピーして値を設定
3. `kubectl apply -f infra/k8s/`
4. `kubectl -n arcsphere3d exec deploy/backend -- alembic upgrade head`

## Files

```
infra/k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml.example        # テンプレート (実値は非コミット)
├── postgres-statefulset.yaml  # PostgreSQL StatefulSet + Service
├── redis-deployment.yaml      # Redis Deployment + Service
├── minio-statefulset.yaml     # MinIO StatefulSet + Service
├── backend-deployment.yaml    # FastAPI Deployment + Service
├── frontend-deployment.yaml   # nginx Deployment + Service
└── ingress.yaml               # nginx Ingress (TLS + WebSocket)
```
