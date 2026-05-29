# ☸️ Kubernetes マニフェスト (base + prod overlay)

ArcSphere3D を Kubernetes 上に配置するための **kustomize** 構成です。
`base/` は環境非依存・dev quickstart 用、`overlays/prod/` が本番ハードニングを上乗せします。
設計判断は [ADR-0004](../../docs/adr/0004-kubernetes-deployment.md) を参照。

## 📁 構成

```
infra/k8s/
├── .kube-linter.yaml            # kube-linter 設定 (CI advisory)
├── base/                        # 環境非依存テンプレート (dev quickstart)
│   ├── kustomization.yaml
│   ├── namespace.yaml           # arcsphere3d Namespace
│   ├── configmap.yaml           # 非機密設定
│   ├── secret.yaml              # 機密プレースホルダ (要差し替え)
│   ├── postgres.yaml            # PostgreSQL 16 + PVC + Service
│   ├── redis.yaml               # Redis 7 (--requirepass) + Service
│   ├── minio.yaml               # MinIO (root は server 専用) + PVC + Service
│   ├── minio-provision.yaml     # scoped service user 発行 Job (ADR-0004 #1)
│   └── backend.yaml             # FastAPI backend + Service
└── overlays/
    └── prod/                    # 本番ハードニング (ADR-0004 #2 #4 #5)
        ├── kustomization.yaml   # base + image pin + patches
        ├── networkpolicy.yaml   # data store ingress を backend に限定
        ├── securitycontext-patch.yaml  # seccomp + allowPrivilegeEscalation:false
        ├── replicas-patch.yaml         # backend を 3 replicas に
        └── secret.externalsecret.yaml.example  # ExternalSecret 雛形 (非適用)
```

## 🚀 適用手順

| 用途                       | コマンド                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| 🧪 dev quickstart          | `kubectl apply -k infra/k8s/base`                                                           |
| 🚀 本番 (ハードニング込み) | `kubectl apply -k infra/k8s/overlays/prod`                                                  |
| 🔍 状態確認                | `kubectl -n arcsphere3d get pods,svc,pvc,job,netpol`                                        |
| 🔌 動作確認                | `kubectl -n arcsphere3d port-forward svc/backend 8000:8000` → `curl localhost:8000/healthz` |

> ⚠️ 適用前に `base/secret.yaml` の `CHANGE_ME_*` を全て差し替えること。
> 本番は `secret.externalsecret.yaml.example` を参考に ExternalSecret 化する。
> `minio-provision` Job が起動時に bucket とアプリ用 scoped 鍵を自動発行します。

## 🛡️ 本番前ハードニング 状況 (ADR-0004 backlog / Issue #242)

| #   | 項目                        | 状況                                                                       |
| --- | --------------------------- | -------------------------------------------------------------------------- |
| 1   | 🪣 MinIO root 共有解消      | ✅ base で解消 (root 分離 + provisioning Job が scoped user 発行)          |
| 2   | 🧱 Redis 認証               | ✅ base で `--requirepass` / 🟡 NetworkPolicy は prod overlay              |
| 3   | 🔐 Secret fail-closed       | 🟡 ExternalSecret 雛形 + 文書 (実接続は要設定)                             |
| 4   | 🔒 stateful securityContext | 🟡 安全サブセット(seccomp 等) を overlay 適用 / 厳格化は要クラスタ検証     |
| 5   | 🏷️ image pin                | ✅ prod overlay の `images:` で固定タグ上書き (base は dev `:latest`)      |
| 6   | 🧪 CI 検証                  | ✅ `kustomize build` + `kubeconform` (blocking) + `kube-linter` (advisory) |

> ✅=完了 / 🟡=部分対応・要クラスタ実機検証。詳細は
> [ADR-0004 Update 2026-05-29](../../docs/adr/0004-kubernetes-deployment.md#update-2026-05-29--issue-242-本番前ハードニング-第1弾)。

## 🧪 ローカル検証

CI と同じ検証はローカルでも実行できます (要 `kustomize` / `kubeconform`)。

```bash
kustomize build infra/k8s/base        | kubeconform -strict -summary -schema-location default
kustomize build infra/k8s/overlays/prod | kubeconform -strict -summary -schema-location default
```

`infra/k8s/**` を変更すると `.github/workflows/k8s-validate.yml` が PR 上で自動実行されます。
