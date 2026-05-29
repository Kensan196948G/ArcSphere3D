# ADR 0004 — Production 配置 (Docker Compose → Kubernetes)

- **Date**: 2026-05-29
- **Status**: Proposed
- **Deciders**: CTO (full delegation), engineering
- **Note on numbering**: Issue #240 は本件を「ADR-0003 フォローアップ」と記載するが、
  ADR-0002 の Follow-ups で **ADR-0003 = JWT 鍵管理 / ADR-0004 = Production 配置 (compose → K8s)**
  と番号を予約済みである。権威ある ADR-0002 の採番に従い、本 ADR を **0004** とする
  (Issue #240 の "ADR-0003" は誤記として reconcile)。JWT 鍵管理 (RS256/JWKS) は
  Issue #22 / #180 で実装済みだが ADR-0003 文書は未起票 — 後続でバックフィルする。

## Context

- 現行のローカル / 統合テスト基盤は Docker Compose (backend + frontend-nginx +
  PostgreSQL + MinIO)。ADR-0001 / ADR-0002 で確定済み。
- 本番リリース (2026-11-14) に向け、スケール・ローリングアップデート・宣言的構成・
  シークレット管理を備えた配置先が必要。
- まだ本番クラスタは確定していない (managed k8s か self-managed か未定) ため、
  **クラウド非依存な kustomize base** を先に用意し、環境差分は overlay で吸収する。

## Decision

### 構成方式

- **kustomize** を採用 (`kubectl apply -k`)。`infra/k8s/base/` に環境非依存の base を置き、
  将来 `infra/k8s/overlays/{dev,staging,prod}/` で差分 (replicas / resources / Ingress /
  ExternalSecret / image tag) を上書きする。

### base に含めるリソース (Issue #240)

| ファイル         | 内容                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| `namespace.yaml` | `arcsphere3d` Namespace                                               |
| `configmap.yaml` | 非機密設定 (S3_BUCKET / S3_ENDPOINT_URL / CORS_ORIGINS)               |
| `secret.yaml`    | 機密のプレースホルダ (`stringData`)。本番は ExternalSecret に差し替え |
| `postgres.yaml`  | PostgreSQL 16 + PVC(10Gi) + Service + `pg_isready` probe              |
| `redis.yaml`     | Redis 7 + Service + `redis-cli ping` probe                            |
| `minio.yaml`     | MinIO + PVC(50Gi) + Service + `/minio/health/live` probe              |
| `backend.yaml`   | FastAPI Deployment + Service + `/healthz` probe                       |

### 設計上の決定事項

1. **DATABASE_URL は ConfigMap に置かない**。接続文字列はシークレットのパスワードを
   含むため、Kubernetes の `$(VAR)` 展開が効く backend Deployment の明示 `env` で
   `postgresql+psycopg://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@postgres:5432/arcsphere3d`
   として組み立てる (envFrom 経由の ConfigMap 値は `$(VAR)` 展開されないため)。
2. **Secret は `stringData`** で平文プレースホルダを記述し、k8s に base64 化を任せる
   (手書き base64 の不正値で `kubectl apply` が落ちる事故を防止)。実値は必ず差し替える。
3. **backend に securityContext を適用** (`runAsNonRoot` / `readOnlyRootFilesystem` /
   `drop: [ALL]`)。読み取り専用 root のため `/tmp` を emptyDir でマウント。
   サードパーティ stateful イメージ (postgres / minio / redis) への厳格な hardening は
   イメージ毎の検証が必要なため overlay / 後続で段階導入する。
4. **全 Deployment に resource requests/limits** を設定 (スケジューリング安定化)。
5. **probe** は readiness/liveness を各サービスに設定済み。

## Consequences (positive)

- クラウド非依存の宣言的配置の土台ができ、overlay で環境差分を最小コストで吸収できる。
- シークレット参照を `secretKeyRef` に集約し、ConfigMap への機密混入を排除。
- リソース制限と probe により、本番でのスケジューリング/自己回復が機能する。

## Consequences (negative / mitigations)

| 短所                                                 | 緩和策                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Secret が平文プレースホルダで repo に存在            | 実値は ExternalSecret/vault。CI で実鍵混入を secret-scan |
| frontend / Ingress / HPA が base に未収録            | overlay と後続 Issue で追加 (本 PR は初期 base に限定)   |
| k8s マニフェストの CI 検証 (kubeconform 等) が未整備 | 後続で `kubeconform` / `kustomize build` を CI に追加    |
| 単一 replica (HA でない)                             | overlay (prod) で replicas/PDB/anti-affinity を上書き    |

## Out of scope (deferred / follow-ups)

- frontend (nginx) Deployment + Ingress (TLS) — 後続 Issue
- overlays/{dev,staging,prod} と ExternalSecret 連携
- HorizontalPodAutoscaler / PodDisruptionBudget
- k8s マニフェスト CI 検証 (kubeconform / kustomize build / kube-linter)
- StatefulSet 化 (postgres/minio を Deployment+PVC から StatefulSet へ) の要否評価
