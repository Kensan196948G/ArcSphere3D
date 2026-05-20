import { useViewportStore } from "@/state/viewportStore";
import type { CameraPreset } from "@/state/viewportStore";
import { getRendererDomElement } from "@/lib/threeContext";

interface ToolBtnProps {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}

function ToolBtn({ label, title, active, onClick }: ToolBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        "rounded px-2 py-1 text-xs font-medium transition " +
        (active
          ? "bg-arc-accent/80 text-white dark:text-slate-900"
          : "bg-slate-800/70 text-slate-300 hover:bg-slate-700/80 dark:bg-slate-800/70")
      }
    >
      {label}
    </button>
  );
}

const PRESETS: { preset: CameraPreset; label: string; title: string }[] = [
  { preset: "perspective", label: "🔭 3D", title: "パース（3D）ビュー" },
  { preset: "top", label: "⬆ 上", title: "平面図ビュー（真上）" },
  { preset: "front", label: "正面", title: "正面ビュー" },
  { preset: "side", label: "側面", title: "側面ビュー（右）" },
];

export default function ViewportToolbar() {
  const {
    showGrid,
    showAxes,
    wireframe,
    ambientIntensity,
    dirIntensity,
    toggleGrid,
    toggleAxes,
    toggleWireframe,
    setAmbientIntensity,
    setDirIntensity,
    resetCamera,
    setCameraPreset,
  } = useViewportStore();

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur">
      <ToolBtn
        label="グリッド"
        title="グリッド表示切替"
        active={showGrid}
        onClick={toggleGrid}
      />
      <ToolBtn
        label="軸"
        title="座標軸表示切替"
        active={showAxes}
        onClick={toggleAxes}
      />
      <ToolBtn
        label="ワイヤー"
        title="ワイヤーフレーム切替"
        active={wireframe}
        onClick={toggleWireframe}
      />
      <ToolBtn
        label="カメラリセット"
        title="カメラ位置をリセット"
        onClick={resetCamera}
      />

      <div className="mx-1 h-4 w-px bg-slate-600" />

      {PRESETS.map(({ preset, label, title }) => (
        <ToolBtn
          key={preset}
          label={label}
          title={title}
          onClick={() => setCameraPreset(preset)}
        />
      ))}

      <div className="mx-1 h-4 w-px bg-slate-600" />

      <ToolBtn
        label="📷"
        title="スクリーンショットを保存 (PNG)"
        onClick={() => {
          const canvas = getRendererDomElement() as HTMLCanvasElement | null;
          if (!canvas || typeof canvas.toDataURL !== "function") return;
          const url = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `arcsphere3d-${Date.now()}.png`;
          a.click();
        }}
      />

      <div className="mx-1 h-4 w-px bg-slate-600" />

      <label className="flex items-center gap-1.5 text-xs text-slate-300">
        <span>環境光</span>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={ambientIntensity}
          onChange={(e) => setAmbientIntensity(Number(e.target.value))}
          className="w-20 accent-arc-accent"
        />
        <span className="w-6 text-right">{ambientIntensity.toFixed(1)}</span>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-slate-300">
        <span>指向光</span>
        <input
          type="range"
          min="0"
          max="3"
          step="0.05"
          value={dirIntensity}
          onChange={(e) => setDirIntensity(Number(e.target.value))}
          className="w-20 accent-arc-accent"
        />
        <span className="w-6 text-right">{dirIntensity.toFixed(1)}</span>
      </label>
    </div>
  );
}
