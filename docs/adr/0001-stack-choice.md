# ADR 0001 — Stack choice for MVP

- **Date**: 2026-05-14
- **Status**: Accepted
- **Deciders**: CTO (full delegation), engineering

## Context

ArcSphere3D は「AI Native Web 3D CAD」の MVP を 6 ヶ月で出す。スタック選定にあたり、以下の制約があった:

- ブラウザだけで 3D を扱う (インストール不要)
- TypeScript 主体で frontend を構築できる開発者前提
- 6 ヶ月で外部 IT 不要なローカル demo まで持っていく
- post-MVP で Entra ID SSO / Postgres / MinIO に置き換え可能であること

## Considered options

| Frontend | Backend | 3D | 評価 |
|---|---|---|---|
| **React + TS + Vite** | **FastAPI (Python 3.12)** | **Three.js** | ★ 採用 |
| Next.js (App Router) | FastAPI | Three.js | SSR 不要、build 複雑度が増すだけ |
| Vue 3 + Vite | FastAPI | Three.js | 社内人材の React 比率が高い |
| React + TS + Vite | NestJS (Node) | Three.js | OSS の CAD-engine 候補が Python 寄り |
| React + TS + Vite | FastAPI | Babylon.js | ロード済 OSS / Loader 数で Three.js が優勢 |

## Decision

- **Frontend**: React 18 + TypeScript 5 + Vite 5 + TailwindCSS + Zustand
- **3D**: Three.js 0.169 (OrbitControls + GLTFLoader + OBJLoader + STLLoader)
- **Backend**: FastAPI 0.115 + Pydantic v2 + SQLAlchemy 2 (post-MVP) + Alembic
- **Auth**: JWT HS256 (MVP) → Entra ID SSO + RS256 (post-MVP)
- **Storage**: in-memory (MVP) → Postgres + MinIO (post-MVP)
- **Build/CI**: GitHub Actions (frontend = lint/typecheck/build, backend = ruff/mypy/pytest), CodeQL, Dependabot
- **Lint/format**: ESLint + Prettier (frontend), ruff + mypy (backend), pre-commit
- **Local infra**: docker-compose (db / redis / minio / backend)

## Consequences (positive)

- **Three.js は loader エコシステムが圧倒的** (glTF / OBJ / STL / IFC / DRACO / Meshopt)
- **FastAPI + Pydantic v2** で API スキーマ → OpenAPI → frontend 型生成が直線的
- **Vite + Zustand** は HMR が極めて速く、Three.js mount/unmount のデバッグ反復が短い
- **React StrictMode 問題は既知パターン**で対処可能 (`useThreeScene` の dispose で対応)

## Consequences (negative / mitigations)

| 短所 | 緩和策 |
|---|---|
| Three.js bundle が ~600KB と重い | manualChunks で `vendor-three` 分離、CDN cache、dynamic import 余地 |
| Pydantic v2 `EmailStr` が `.local` などを弾く | demo は `.dev` ドメイン、production は SSO 主体で local user 廃止 |
| `passlib` が事実上メンテ停止 | bcrypt 直接利用に切替 (本 ADR 内で確定) |
| FastAPI on_event は deprecation | 最初から `lifespan` ハンドラを採用 |

## Alternatives explicitly rejected

- **Next.js**: SSR 不要、SPA + REST で十分。複雑度コストに見合わない。
- **Babylon.js**: ECMAScript エコシステム / loader 数で Three に劣る。CAD 系 OSS との親和性も Three が上。
- **Django + DRF**: API speed (Pydantic v2 + ASGI) と OpenAPI 生成で FastAPI が優位。
- **passlib**: 本 ADR 内で bcrypt 直接使用に確定 (passlib 1.7.4 が bcrypt 4.x と非互換)。

## Follow-ups (見込み ADR)

- 0002 — JWT 鍵管理 (HS256 → RS256 + KMS)
- 0003 — Production 配置 (compose → K8s)
- 0004 — 大ファイル upload の resumable (TUS) 採用可否
