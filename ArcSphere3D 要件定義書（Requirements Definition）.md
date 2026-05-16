# ArcSphere3D
# 要件定義書
# AI Native Web 3D CAD Platform

---

# 1. システム概要

## 1.1 システム名

ArcSphere3D

---

## 1.2 システム概要

ArcSphere3D は、
AI Native 技術を活用した
Webベースの3D CADプラットフォームである。

建設・製造・設計業務における
3Dモデリング、
BIM、
Digital Twin、
コラボレーションを統合し、
ブラウザ上で高度な3D設計を実現する。

---

# 2. システム目的

## 2.1 主目的

- Webブラウザのみで3D CADを利用可能にする
- 建設DX/BIM推進
- AIによる設計支援
- 図面・3Dモデルの一元管理
- クラウド型コラボレーション実現
- Enterpriseレベル運用

---

## 2.2 解決する課題

| 課題 | 解決内容 |
|---|---|
| 高価なCAD環境 | Web化による低コスト化 |
| ローカル依存 | ブラウザベース運用 |
| BIM連携不足 | IFC/BIM統合 |
| 属人化 | AI支援 |
| データ分散 | 統合管理 |
| コラボ困難 | リアルタイム共有 |

---

# 3. 対象ユーザー

## 3.1 想定利用者

- 建設会社
- 土木会社
- 設計事務所
- 製造業
- BIM運用部門
- DX推進部門

---

# 4. システム範囲

## 4.1 対応範囲

- WebUI 3D CAD
- BIM Viewer
- 3Dモデリング
- AI設計支援
- ファイル管理
- プロジェクト管理
- コラボレーション

---

## 4.2 対応予定ファイル形式

- STL
- OBJ
- glTF
- STEP
- IFC
- DXF
- DWG（将来）

---

# 5. 機能要件

# 5.1 3D表示機能

## 必須機能

- 3Dモデル表示
- Orbit
- Zoom
- Pan
- ワイヤーフレーム表示
- シェーディング
- ライト制御
- グリッド表示

---

# 5.2 CAD編集機能

## 基本編集

- Move
- Rotate
- Scale
- Push/Pull
- Extrude
- Copy
- Delete

---

# 5.3 BIM機能

- IFC読込
- BIM属性表示
- BIM階層表示
- 部材情報表示

---

# 5.4 AI機能

- AIモデリング支援
- AI部材提案
- AI寸法補完
- AI異常検知
- AI設計支援

---

# 5.5 ファイル管理

- アップロード
- ダウンロード
- バージョン管理
- 自動保存
- 監査ログ

---

# 5.6 ユーザー管理

- ログイン
- RBAC
- MFA
- SSO
- Entra ID連携

---

# 5.7 コラボレーション

- コメント
- リアルタイム同期
- 差分表示
- 共有URL

---

# 6. 非機能要件

# 6.1 パフォーマンス

| 項目 | 要件 |
|---|---|
| 初期表示 | 5秒以内 |
| モデル読込 | 10秒以内 |
| FPS | 30FPS以上 |
| 同時接続 | 500ユーザー以上 |

---

# 6.2 可用性

- 24時間365日運用
- 自動復旧
- 冗長化

---

# 6.3 セキュリティ

- HTTPS
- MFA
- JWT
- OAuth2
- 監査ログ
- 暗号化保存

---

# 6.4 保守性

- マイクロサービス対応
- Docker対応
- CI/CD対応
- APIドキュメント自動生成

---

# 7. システム構成

## フロントエンド

- React
- TypeScript
- Three.js

---

## バックエンド

- FastAPI
- Python

---

## データベース

- PostgreSQL

---

## ストレージ

- MinIO

---

## 認証

- Microsoft Entra ID

---

# 8. 開発方針

## 開発方式

- ハイブリッド開発
- 上流ウォーターフォール
- 下流アジャイル

---

## AI活用

- ClaudeCode
- AgentTeams
- GitHub Actions
- CodeRabbit
- Codex Review

---

# 9. MVP定義

## MVP対象

- 3D Viewer
- STL/OBJ/glTF読込
- 基本操作
- WebUI管理画面
- 認証

---

# 10. 今後の拡張

- IFC完全対応
- Digital Twin
- VR/AR
- AI自動設計
- GIS統合
- モバイル対応

---