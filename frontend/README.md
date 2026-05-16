# ⚛️ ArcSphere3D · frontend

React 18 + TypeScript + Vite + TailwindCSS + Zustand + Three.js による Web 3D Viewport。

## Quick Start

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # type-check + production build
npm run typecheck
```

## Structure

```
src/
├── main.tsx                    # entry
├── App.tsx                     # mounts <AppShell>
├── app/layout/                 # Header / LeftMenu / RightPanel / BottomConsole / AppShell
├── features/viewport/
│   ├── Viewport.tsx            # mount point for the WebGL canvas
│   ├── useThreeScene.ts        # StrictMode-safe Three.js lifecycle hook
│   ├── loaders.ts              # STL / OBJ / glTF / GLB → Object3D
│   └── FileLoader.tsx          # right-panel "Open file" UI
├── state/sceneStore.ts         # Zustand store (objects + logs)
├── lib/threeContext.ts         # bridge between React UI and Three.js Scene
└── styles/index.css            # Tailwind layers
```

## MVP Features

- ✅ Three.js Scene (perspective camera, ambient + directional lights)
- ✅ OrbitControls (damped)
- ✅ GridHelper + AxesHelper
- ✅ STL / OBJ / glTF / GLB ローカル読込
- ✅ Header / LeftMenu / Viewport / RightPanel / BottomConsole レイアウト
- ⏳ TransformControls (Move/Rotate/Scale) — post-MVP
- ⏳ Auth (JWT) integration — Task #5 で backend を準備中

## Notes

- WebGL コンテキストは StrictMode で二重マウントされるため、`useThreeScene` で完全な disposal を実装している (`renderer.dispose()` / `controls.dispose()` / `geometry.dispose()` / `material.dispose()`)。
- `getActiveScene()` でグローバルにシーン参照を共有しているのは、ファイルローダーのような Three.js 直接操作 UI から `Scene` に追加するため。React state には `Object3D` 参照を入れていない (Zustand には ID と name のみ持たせるのが安全)。
