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

## Security hardening backlog (自動セキュリティレビュー指摘, 本番前必須)

base は **未デプロイの初期テンプレート**であり以下は現状で悪用不能だが、本番配置前に
overlay / 後続 Issue で必ず解消する。完全修正の多くはクラスタ実機検証を要する
(無検証適用は CrashLoop リスク: postgres/redis/minio 公式イメージは root 起動→
`gosu`/`su-exec` で権限降格するため `drop:[ALL]`/`runAsNonRoot` は entrypoint を壊す)。

| #   | 重大度 | 項目                                         | 本番対応                                                                                                                                                                                                                                |
| --- | ------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH   | MinIO root 資格情報を backend と共有         | provisioning Job で scoped service user (`mc admin user add` + `s3:*Object` on `arcsphere3d/*`) を作り、その鍵を `S3_ACCESS_KEY/SECRET_KEY` として backend に渡す。root は app に渡さない                                               |
| 2   | HIGH   | Redis 無認証 (ClusterIP)                     | `--requirepass $(REDIS_PASSWORD)` + backend の REDIS 接続にパスワード付与。加えて NetworkPolicy で ingress を backend ラベルに限定。NetworkPolicy は probe 経路 (kubelet 発) を CNI 依存でブロックし得るため実機検証して overlay で導入 |
| 3   | MED    | base に既知プレースホルダ Secret             | 本番は SealedSecret/ExternalSecret/SOPS。overlay が Secret を供給する fail-closed 構成へ。base の値は dev quickstart 専用                                                                                                               |
| 4   | MED    | postgres/redis/minio に securityContext 無し | overlay で `runAsNonRoot`/`readOnlyRootFilesystem` + 必要 emptyDir (`/tmp`, `/var/run/postgresql`) をイメージ毎に検証して導入                                                                                                           |
| 5   | MED    | backend image が mutable `:latest`           | release CI で commit SHA / digest pin。`imagePullPolicy` も併せて固定 (本 PR で `Always` を明示)                                                                                                                                        |

## Out of scope (deferred / follow-ups)

- frontend (nginx) Deployment + Ingress (TLS) — 後続 Issue
- overlays/{dev,staging} と ExternalSecret 連携 (prod overlay は Issue #242 で導入)
- HorizontalPodAutoscaler / PodDisruptionBudget
- ~~k8s マニフェスト CI 検証 (kubeconform / kustomize build / kube-linter)~~ → **Issue #242 で導入済み** (`.github/workflows/k8s-validate.yml`)
- StatefulSet 化 (postgres/minio を Deployment+PVC から StatefulSet へ) の要否評価

## Update 2026-05-29 — Issue #242 (本番前ハードニング 第1弾)

base は依然「未デプロイの dev quickstart テンプレート」とし、本番ハードニングは
**prod overlay** (`infra/k8s/overlays/prod/`) と **CI 構造検証**で段階導入する方針を確定。
本 PR で backlog 各項目を以下のとおり進めた:

| #                          | 状態                                           | 実装                                                                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 MinIO root 共有          | ✅ **base で解消**                             | root を `S3_ROOT_USER/PASSWORD` に分離 (MinIO server 専用)。`minio-provision.yaml` Job が bucket 作成 + scoped policy (`s3:*Object` on `arcsphere3d/*`) + service user (`S3_ACCESS_KEY/SECRET_KEY`) を発行。backend は scoped 鍵のみ使用。Job は冪等 (再適用可) |
| 2 Redis 無認証             | ✅ **base で AUTH / overlay で NetworkPolicy** | `redis.yaml` に `--requirepass $(REDIS_PASSWORD)` + `REDISCLI_AUTH` で probe も認証。NetworkPolicy (backend のみ ingress) は CNI 依存のため overlay へ。backend は現状 in-memory rate limiter で Redis 未配線 — AUTH は defense-in-depth                        |
| 3 placeholder Secret       | 🟡 **overlay 例 + 文書**                       | `secret.externalsecret.yaml.example` に external-secrets-operator の fail-closed 構成を記載 (CRD 依存のため `.example`、kustomization 非参照)                                                                                                                   |
| 4 stateful securityContext | 🟡 **overlay 安全サブセット適用**              | gosu/su-exec を壊さない `seccompProfile: RuntimeDefault` + `allowPrivilegeEscalation: false` を overlay patch で適用。`runAsNonRoot`/`readOnlyRootFilesystem`/cap drop はイメージ毎の実機検証が必要なため commented TODO + `.kube-linter.yaml` で除外して追跡   |
| 5 mutable `:latest`        | ✅ **overlay で pin 機構**                     | prod overlay の `images:` で base の `:latest` を固定タグに上書き (release CI が commit SHA を設定)。base は dev のため `:latest` 維持 (kustomize idiom)                                                                                                        |
| 6 CI 検証                  | ✅ **新規 workflow**                           | `kustomize build` (base+prod) + `kubeconform -strict` + `kube-linter` を全 blocking。stateful 強化の延期項目は per-object の `ignore-check.kube-linter.io/*` annotation で追跡。`infra/k8s/**` 変更時に実行                                                     |

**残課題 (要クラスタ実機検証 → 後続 Issue)**: stateful pods の `runAsNonRoot`/`readOnlyRootFilesystem`/cap drop、
NetworkPolicy の minio httpGet probe 経路 (CNI 別)、ExternalSecret の実接続、kube-linter の blocking 昇格。

## Update 2026-05-29 (2) — Issue #246 (JWT 鍵配線の deploy-breaking 欠陥修正)

Release Readiness 監査で、本 ADR の base マニフェストに 2 つの欠陥が判明し修正した:

1. **JWT 鍵 env 名の不一致**: backend は `config.py` で `jwt_private_key_pem`/`jwt_public_key_pem`
   (env `JWT_PRIVATE_KEY_PEM`/`JWT_PUBLIC_KEY_PEM`) を読むが、`backend.yaml`/`secret.yaml` は
   `_PEM` 無しの `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` を注入していた → 空 PEM 扱いで pod 毎 ephemeral
   鍵に静かに降格 (replicas:3 で JWT 検証破綻)。全箇所を `*_PEM` に統一。
2. **`APP_ENV` 不在で fail-closed 不発**: base ConfigMap に `APP_ENV` が無く既定 `development` のため
   `config.py: is_production_like` が偽となり、JWT 鍵未設定を検出する fail-closed invariant が発火
   しなかった。base に `APP_ENV: development` を明示し、prod overlay (`configmap-patch.yaml`) で
   `production` に上書きして invariant を実際に発火させる。

回帰防止として `k8s-validate.yml` に「rendered prod が `JWT_*_PEM` を配線し `APP_ENV=production`
であること、bare `JWT_PRIVATE_KEY` が無いこと」の blocking assertion を追加。
backend 側 invariant は既存テスト (`test_security_invariants.py`) でカバー済み。
