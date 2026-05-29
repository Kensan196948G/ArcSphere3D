# ☸️ Kubernetes マニフェスト (初期 base)

ArcSphere3D を Kubernetes 上に配置するための **kustomize base** です。
設計判断は [ADR-0004](../../docs/adr/0004-kubernetes-deployment.md) を参照。

## 📁 構成

```
infra/k8s/
└── base/
    ├── kustomization.yaml   # base 一括適用 (kubectl apply -k)
    ├── namespace.yaml       # arcsphere3d Namespace
    ├── configmap.yaml       # 非機密設定
    ├── secret.yaml          # 機密プレースホルダ (要差し替え)
    ├── postgres.yaml        # PostgreSQL 16 + PVC + Service
    ├── redis.yaml           # Redis 7 + Service
    ├── minio.yaml           # MinIO + PVC + Service
    └── backend.yaml         # FastAPI backend + Service
```

## 🚀 適用手順

```bash
# 1. シークレットを実値に差し替える (重要)
#    infra/k8s/base/secret.yaml の CHANGE_ME_* を本番値に置換するか、
#    本番では external-secrets-operator の ExternalSecret に差し替える。

# 2. base を適用
kubectl apply -k infra/k8s/base

# 3. 状態確認
kubectl -n arcsphere3d get pods,svc,pvc

# 4. backend へポートフォワード (動作確認)
kubectl -n arcsphere3d port-forward svc/backend 8000:8000
curl http://localhost:8000/healthz
```

## ⚠️ 本番前の必須対応

| 項目            | 対応                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| 🔐 シークレット | `secret.yaml` の `CHANGE_ME_*` を全て差し替え / ExternalSecret 化                    |
| 🪣 MinIO 権限   | root 資格情報を backend と共有しない。scoped service user を provisioning Job で発行 |
| 🧱 Redis 認証   | `--requirepass` + NetworkPolicy で backend からのみ ingress 許可                     |
| 🛡️ 強化         | postgres/redis/minio に securityContext を実機検証して overlay 導入                  |
| 🌐 公開         | frontend(nginx) Deployment + Ingress(TLS) を overlay で追加                          |
| 📈 スケール     | overlay (prod) で `replicas` / HPA / PDB を上書き                                    |
| 🏷️ イメージ     | `backend.yaml` の `:latest` を固定タグ (commit SHA / digest) に                      |
| 🧪 CI 検証      | `kubeconform` / `kustomize build` を CI に追加 (後続)                                |

> 詳細は [ADR-0004 の Security hardening backlog](../../docs/adr/0004-kubernetes-deployment.md#security-hardening-backlog-自動セキュリティレビュー指摘-本番前必須) を参照。

## 🧩 overlay 拡張の指針

```
infra/k8s/overlays/prod/kustomization.yaml
---
resources:
  - ../../base
patches:
  - path: replicas-patch.yaml     # backend replicas を 3 に
images:
  - name: ghcr.io/kensan196948g/arcsphere3d/backend
    newTag: <commit-sha>
```
