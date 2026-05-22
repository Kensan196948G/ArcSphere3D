import { useEffect, useReducer } from "react";
import { useSceneStore } from "@/state/sceneStore";
import { useViewportStore } from "@/state/viewportStore";
import type { Object3D } from "three";

function Vec3Input({
  label,
  value,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: { x: number; y: number; z: number };
  step?: number;
  onChange: (axis: "x" | "y" | "z", v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex gap-1">
        {(["x", "y", "z"] as const).map((ax) => (
          <label key={ax} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[9px] text-slate-400">{ax.toUpperCase()}</span>
            <input
              type="number"
              step={step}
              value={Number(value[ax].toFixed(3))}
              onChange={(e) => onChange(ax, Number(e.target.value))}
              className="w-full rounded bg-slate-100 px-1 py-0.5 text-center text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function readTransforms(obj3d: Object3D) {
  return {
    position: { x: obj3d.position.x, y: obj3d.position.y, z: obj3d.position.z },
    rotation: {
      x: (obj3d.rotation.x * 180) / Math.PI,
      y: (obj3d.rotation.y * 180) / Math.PI,
      z: (obj3d.rotation.z * 180) / Math.PI,
    },
    scale: { x: obj3d.scale.x, y: obj3d.scale.y, z: obj3d.scale.z },
  };
}

export default function PropertiesPanel() {
  const objects = useSceneStore((s) => s.objects);
  const selectedId = useSceneStore((s) => s.selectedId);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  const selected = objects.find((o) => o.id === selectedId);
  const obj3d = selected?.object;

  useEffect(() => {
    forceUpdate();
  }, [selectedId]);

  if (!selected || !obj3d) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        オブジェクトを選択してください。
      </p>
    );
  }

  const t = readTransforms(obj3d);

  return (
    <div
      className="flex flex-col gap-3 text-xs"
      data-testid="properties-panel"
    >
      {/* オブジェクト名 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          オブジェクト
        </span>
        <span
          className="truncate rounded bg-slate-100/80 px-2 py-1 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
          title={selected.name}
        >
          {selected.name}
        </span>
      </div>

      {/* 位置 */}
      <Vec3Input
        label="位置"
        value={t.position}
        onChange={(ax, v) => {
          obj3d.position[ax] = v;
          forceUpdate();
        }}
      />

      {/* 回転 (deg) */}
      <Vec3Input
        label="回転 (deg)"
        step={1}
        value={t.rotation}
        onChange={(ax, v) => {
          obj3d.rotation[ax] = (v * Math.PI) / 180;
          forceUpdate();
        }}
      />

      {/* 拡縮 */}
      <Vec3Input
        label="拡縮"
        value={t.scale}
        onChange={(ax, v) => {
          obj3d.scale[ax] = Math.max(0.001, v);
          forceUpdate();
        }}
      />

      {/* ワールド座標 (読み取り専用) */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          ワールド座標
        </span>
        {(() => {
          const wp = obj3d.getWorldPosition(obj3d.position.clone());
          return (
            <div className="flex gap-1 text-[10px] text-slate-400">
              {(["x", "y", "z"] as const).map((ax) => (
                <span
                  key={ax}
                  className="flex flex-1 flex-col items-center rounded bg-slate-100/60 py-0.5 dark:bg-slate-800/40"
                >
                  <span className="text-[9px]">{ax.toUpperCase()}</span>
                  {wp[ax].toFixed(2)}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {/* アクション */}
      <div className="flex gap-1">
        <button
          type="button"
          data-testid="properties-center-btn"
          onClick={() => {
            obj3d.position.set(0, 0, 0);
            forceUpdate();
          }}
          className="flex-1 rounded bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          原点へ
        </button>
        <button
          type="button"
          data-testid="properties-focus-btn"
          onClick={() => useViewportStore.getState().focusObject()}
          className="flex-1 rounded bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          title="カメラをフォーカス (F)"
        >
          フォーカス
        </button>
        <button
          type="button"
          data-testid="properties-reset-scale-btn"
          onClick={() => {
            obj3d.scale.set(1, 1, 1);
            forceUpdate();
          }}
          className="flex-1 rounded bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          拡縮リセット
        </button>
      </div>
    </div>
  );
}
