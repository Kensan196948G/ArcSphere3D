/**
 * CAD Panel — Three.js-backed primitive shape generator.
 *
 * Provides a UI for creating parametric primitives (Box, Sphere, Cylinder,
 * Cone, Torus) and adding them to the scene.  The panel is structured so the
 * generation logic (cadPrimitives.ts) can be replaced with an OpenCascade.js
 * WASM kernel without touching this component.
 */

import { useState } from "react";
import { useSceneStore } from "@/state/sceneStore";
import { getActiveScene } from "@/lib/threeContext";
import {
  createPrimitive,
  primitiveLabel,
  type BoxParams,
  type SphereParams,
  type CylinderParams,
  type ConeParams,
  type TorusParams,
  type PrimitiveType,
} from "./cadPrimitives";

// ---- per-shape defaults ------------------------------------------------

const BOX_DEFAULTS: Omit<BoxParams, "type"> = { width: 1, height: 1, depth: 1 };
const SPHERE_DEFAULTS: Omit<SphereParams, "type"> = { radius: 0.5, segments: 32 };
const CYL_DEFAULTS: Omit<CylinderParams, "type"> = {
  radiusTop: 0.5,
  radiusBottom: 0.5,
  height: 1,
  segments: 32,
};
const CONE_DEFAULTS: Omit<ConeParams, "type"> = {
  radius: 0.5,
  height: 1,
  segments: 32,
};
const TORUS_DEFAULTS: Omit<TorusParams, "type"> = {
  radius: 0.5,
  tube: 0.15,
  radialSegments: 16,
  tubularSegments: 48,
};

type TabId = PrimitiveType;
const TABS: { id: TabId; label: string }[] = [
  { id: "box", label: "直方体" },
  { id: "sphere", label: "球" },
  { id: "cylinder", label: "円柱" },
  { id: "cone", label: "円錐" },
  { id: "torus", label: "トーラス" },
];

// ---- small helpers ----------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
  min = 0.01,
  step = 0.1,
  testId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        data-testid={testId}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= min) onChange(v);
        }}
        className="w-20 rounded bg-slate-100 px-2 py-0.5 text-right text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
      />
    </label>
  );
}

// ---- main component ---------------------------------------------------

export default function CadPanel() {
  const addObject = useSceneStore((s) => s.addObject);
  const log = useSceneStore((s) => s.log);

  const [tab, setTab] = useState<TabId>("box");
  const [box, setBox] = useState(BOX_DEFAULTS);
  const [sphere, setSphere] = useState(SPHERE_DEFAULTS);
  const [cyl, setCyl] = useState(CYL_DEFAULTS);
  const [cone, setCone] = useState(CONE_DEFAULTS);
  const [torus, setTorus] = useState(TORUS_DEFAULTS);

  function handleAdd() {
    const scene = getActiveScene();
    if (!scene) {
      log("[CAD] ✗ 3D シーンが初期化されていません");
      return;
    }

    let spec: Parameters<typeof createPrimitive>[0];
    switch (tab) {
      case "box":
        spec = { type: "box", ...box };
        break;
      case "sphere":
        spec = { type: "sphere", ...sphere };
        break;
      case "cylinder":
        spec = { type: "cylinder", ...cyl };
        break;
      case "cone":
        spec = { type: "cone", ...cone };
        break;
      case "torus":
        spec = { type: "torus", ...torus };
        break;
    }

    const mesh = createPrimitive(spec);
    const name = primitiveLabel(spec);
    mesh.name = name;
    scene.add(mesh);
    const id = `cad-${Date.now()}`;
    addObject({ id, name, object: mesh });
    log(`[CAD] ✓ ${name} をシーンに追加`);
  }

  return (
    <div className="flex flex-col gap-3 text-xs" data-testid="cad-panel">
      {/* タブ */}
      <div className="flex flex-wrap gap-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={[
              "rounded px-2 py-1 text-[11px] transition",
              tab === id
                ? "bg-arc-accent/80 text-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* パラメータ入力 */}
      <div className="flex flex-col gap-2 rounded bg-slate-100/60 p-2 dark:bg-slate-800/40">
        {tab === "box" && (
          <>
            <NumberField label="幅 (m)" value={box.width} onChange={(v) => setBox((p) => ({ ...p, width: v }))} testId="cad-box-width" />
            <NumberField label="高さ (m)" value={box.height} onChange={(v) => setBox((p) => ({ ...p, height: v }))} testId="cad-box-height" />
            <NumberField label="奥行き (m)" value={box.depth} onChange={(v) => setBox((p) => ({ ...p, depth: v }))} testId="cad-box-depth" />
          </>
        )}
        {tab === "sphere" && (
          <>
            <NumberField label="半径 (m)" value={sphere.radius} onChange={(v) => setSphere((p) => ({ ...p, radius: v }))} testId="cad-sphere-radius" />
            <NumberField label="セグメント" value={sphere.segments} onChange={(v) => setSphere((p) => ({ ...p, segments: Math.round(v) }))} min={4} step={1} />
          </>
        )}
        {tab === "cylinder" && (
          <>
            <NumberField label="上部半径 (m)" value={cyl.radiusTop} onChange={(v) => setCyl((p) => ({ ...p, radiusTop: v }))} testId="cad-cyl-radius" />
            <NumberField label="下部半径 (m)" value={cyl.radiusBottom} onChange={(v) => setCyl((p) => ({ ...p, radiusBottom: v }))} />
            <NumberField label="高さ (m)" value={cyl.height} onChange={(v) => setCyl((p) => ({ ...p, height: v }))} />
            <NumberField label="セグメント" value={cyl.segments} onChange={(v) => setCyl((p) => ({ ...p, segments: Math.round(v) }))} min={4} step={1} />
          </>
        )}
        {tab === "cone" && (
          <>
            <NumberField label="半径 (m)" value={cone.radius} onChange={(v) => setCone((p) => ({ ...p, radius: v }))} testId="cad-cone-radius" />
            <NumberField label="高さ (m)" value={cone.height} onChange={(v) => setCone((p) => ({ ...p, height: v }))} />
            <NumberField label="セグメント" value={cone.segments} onChange={(v) => setCone((p) => ({ ...p, segments: Math.round(v) }))} min={4} step={1} />
          </>
        )}
        {tab === "torus" && (
          <>
            <NumberField label="外半径 (m)" value={torus.radius} onChange={(v) => setTorus((p) => ({ ...p, radius: v }))} testId="cad-torus-radius" />
            <NumberField label="チューブ半径 (m)" value={torus.tube} onChange={(v) => setTorus((p) => ({ ...p, tube: v }))} />
            <NumberField label="ラジアル分割" value={torus.radialSegments} onChange={(v) => setTorus((p) => ({ ...p, radialSegments: Math.round(v) }))} min={3} step={1} />
            <NumberField label="チューブ分割" value={torus.tubularSegments} onChange={(v) => setTorus((p) => ({ ...p, tubularSegments: Math.round(v) }))} min={3} step={1} />
          </>
        )}
      </div>

      {/* 追加ボタン */}
      <button
        type="button"
        onClick={handleAdd}
        data-testid="cad-add-btn"
        className="w-full rounded bg-arc-accent/80 py-1.5 text-[12px] font-medium text-white hover:bg-arc-accent dark:text-slate-900"
      >
        📐 シーンに追加
      </button>

      {/* ガイドメッセージ */}
      <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        形状を選択してパラメータを設定し「シーンに追加」を押すと 3D
        ビューポートに表示されます。
      </p>

      {/* OCC 統合ロードマップ */}
      <details className="rounded bg-slate-100/40 p-2 dark:bg-slate-800/30">
        <summary className="cursor-pointer text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          ▶ OpenCascade.js 統合ロードマップ
        </summary>
        <ul className="mt-1 list-disc pl-4 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          <li>STEP / IGES ファイル読み込み</li>
          <li>B-Rep ブーリアン演算 (Union / Difference / Intersection)</li>
          <li>押し出し (Extrude) / 回転 (Revolve)</li>
          <li>フィレット / チャンファー</li>
          <li>Three.js への高品質テセレーション</li>
        </ul>
      </details>
    </div>
  );
}
