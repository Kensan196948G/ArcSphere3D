# ArcSphere3D
# 詳細設計仕様書
# AI Native Web 3D CAD Platform

---

# 1. システムアーキテクチャ

```text
Browser
  ↓
React Frontend
  ↓
Three.js Rendering Engine
  ↓
CAD Engine (OpenCascade.js)
  ↓
FastAPI Backend
  ↓
PostgreSQL / MinIO
````

---

# 2. ディレクトリ構成

```text
ArcSphere3D/
├── frontend/
├── backend/
├── cad-engine/
├── bim-engine/
├── ai-services/
├── infra/
├── docs/
├── docker/
├── tests/
└── .github/
```

---

# 3. フロントエンド設計

## 3.1 使用技術

| 分野        | 技術           |
| --------- | ------------ |
| Framework | React        |
| Language  | TypeScript   |
| UI        | TailwindCSS  |
| 3D        | Three.js     |
| State     | Zustand      |
| Router    | React Router |

---

## 3.2 画面構成

### メイン画面

```text
+------------------------------------------------+
| Header                                         |
+------+----------------------+------------------+
| Left | 3D Viewport          | Right Panel      |
| Menu |                      | Property/Layer   |
+------+----------------------+------------------+
| Bottom Console                                 |
+------------------------------------------------+
```

---

## 3.3 左メニュー

* Project
* Model
* Layer
* BIM
* Material
* AI Assist
* Settings

---

## 3.4 Viewport機能

* OrbitControls
* GridHelper
* TransformControls
* Selection
* Raycast

---

# 4. 3Dエンジン設計

## 4.1 Three.js

### 主機能

* Scene管理
* Camera管理
* Renderer管理
* Lighting
* PostProcessing

---

## 4.2 OpenCascade.js

### CAD処理

* B-Rep
* Extrude
* Boolean
* Fillet
* Tessellation

---

## 4.3 IFC.js

### BIM機能

* IFC Import
* BIM Property
* Spatial Tree

---

# 5. バックエンド設計

## 5.1 使用技術

| 分野      | 技術           |
| ------- | ------------ |
| API     | FastAPI      |
| ORM     | SQLAlchemy   |
| Auth    | JWT / OAuth2 |
| Queue   | Redis        |
| Storage | MinIO        |

---

## 5.2 API構成

### Auth API

```text
/api/auth/login
/api/auth/logout
/api/auth/refresh
```

---

### Project API

```text
/api/projects
/api/projects/{id}
```

---

### File API

```text
/api/files/upload
/api/files/download
```

---

### CAD API

```text
/api/cad/extrude
/api/cad/boolean
/api/cad/export
```

---

# 6. データベース設計

## 6.1 テーブル一覧

| テーブル       | 用途     |
| ---------- | ------ |
| users      | ユーザー   |
| projects   | プロジェクト |
| models     | CADモデル |
| files      | ファイル   |
| comments   | コメント   |
| audit_logs | 監査ログ   |

---

## 6.2 projects テーブル

| カラム        | 型         |
| ---------- | --------- |
| id         | UUID      |
| name       | VARCHAR   |
| owner_id   | UUID      |
| created_at | TIMESTAMP |

---

# 7. 認証設計

## 7.1 認証方式

* OAuth2
* OpenID Connect
* JWT

---

## 7.2 Entra ID連携

* SSO
* MFA
* Group Mapping

---

# 8. AI機能設計

## 8.1 AI Assist

### 機能

* 自然言語CAD
* AI補完
* AI部材推定
* AI干渉検知

---

## 8.2 AI構成

```text
User Prompt
   ↓
AI Service
   ↓
CAD Command Generator
   ↓
3D Engine
```

---

# 9. インフラ設計

## 9.1 Docker構成

```text
Frontend Container
Backend Container
PostgreSQL Container
Redis Container
MinIO Container
```

---

## 9.2 Kubernetes対応

将来対応予定。

---

# 10. セキュリティ設計

## 対応項目

* HTTPS
* CSP
* RBAC
* Audit Log
* Encryption

---

# 11. CI/CD設計

## GitHub Actions

### 対応内容

* Build
* Test
* Lint
* Security Scan
* Docker Build
* Auto Deploy

---

# 12. テスト設計

## フロントエンド

* Vitest
* Playwright

---

## バックエンド

* Pytest

---

# 13. ログ設計

## ログ種類

* Access Log
* Error Log
* Audit Log
* AI Log

---

# 14. 将来拡張

* VR対応
* AR対応
* GIS統合
* モバイル対応
* AI自動設計

---

```
```
