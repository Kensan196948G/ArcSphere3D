import { useEffect, useState } from "react";
import { Color, Mesh, MeshStandardMaterial } from "three";
import { useSceneStore } from "@/state/sceneStore";

interface MatState {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type THREE_Object3D = any;

function collectMaterials(object: THREE_Object3D): MeshStandardMaterial[] {
  const mats: MeshStandardMaterial[] = [];
  object.traverse((o: THREE_Object3D) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = Array.isArray(m.material) ? m.material : [m.material];
    mat.forEach((x: unknown) => {
      if (x instanceof MeshStandardMaterial && !mats.includes(x)) mats.push(x);
    });
  });
  return mats;
}

function toHex(color: Color): string {
  return `#${color.getHexString()}`;
}

function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-arc-accent"
      />
      <span className="w-8 text-right text-[10px] text-slate-500 dark:text-slate-400">
        {value.toFixed(2)}
      </span>
    </label>
  );
}

export default function MaterialPanel() {
  const selectedId = useSceneStore((s) => s.selectedId);
  const objects = useSceneStore((s) => s.objects);
  const selected = objects.find((o) => o.id === selectedId);

  const [mat, setMat] = useState<MatState>({
    color: "#9ca3af",
    roughness: 0.5,
    metalness: 0.1,
    opacity: 1,
    transparent: false,
  });

  // Sync UI from Three.js material when selection changes
  useEffect(() => {
    if (!selected) return;
    const mats = collectMaterials(selected.object);
    if (mats.length === 0) return;
    const m = mats[0];
    setMat({
      color: toHex(m.color),
      roughness: m.roughness,
      metalness: m.metalness,
      opacity: m.opacity,
      transparent: m.transparent,
    });
  }, [selected]);

  function applyToMats(update: Partial<MatState>) {
    if (!selected) return;
    const next = { ...mat, ...update };
    setMat(next);
    collectMaterials(selected.object).forEach((m) => {
      m.color.set(next.color);
      m.roughness = next.roughness;
      m.metalness = next.metalness;
      m.opacity = next.opacity;
      m.transparent = next.transparent;
    });
  }

  if (!selected) {
    return (
      <div className="flex flex-col gap-3 text-xs">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          マテリアル
        </h3>
        <p className="text-slate-400 dark:text-slate-500">
          オブジェクトを選択してください。
        </p>
      </div>
    );
  }

  const mats = collectMaterials(selected.object);
  if (mats.length === 0) {
    return (
      <div className="flex flex-col gap-3 text-xs">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          マテリアル
        </h3>
        <p className="text-slate-400 dark:text-slate-500">
          マテリアルなし（このオブジェクト形式は非対応）。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        マテリアル — {selected.name}
      </h3>

      {/* カラーピッカー */}
      <label className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] text-slate-500 dark:text-slate-400">カラー</span>
        <input
          type="color"
          value={mat.color}
          onChange={(e) => applyToMats({ color: e.target.value })}
          className="h-7 w-16 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[10px] text-slate-400">{mat.color}</span>
      </label>

      <Slider
        label="粗さ"
        value={mat.roughness}
        onChange={(v) => applyToMats({ roughness: v })}
      />
      <Slider
        label="金属感"
        value={mat.metalness}
        onChange={(v) => applyToMats({ metalness: v })}
      />
      <Slider
        label="不透明度"
        value={mat.opacity}
        onChange={(v) =>
          applyToMats({ opacity: v, transparent: v < 1 })
        }
      />

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        {mats.length} マテリアル適用中
      </p>
    </div>
  );
}
