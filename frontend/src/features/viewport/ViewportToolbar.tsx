import { useState, useEffect, useRef } from "react";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { useViewportStore } from "@/state/viewportStore";
import type { CameraPreset } from "@/state/viewportStore";
import { getActiveScene, getRendererDomElement } from "@/lib/threeContext";
import { useSceneStore } from "@/state/sceneStore";

interface ToolBtnProps {
  label: string;
  title: string;
  active?: boolean;
  testId?: string;
  onClick: () => void;
}

function ToolBtn({ label, title, active, testId, onClick }: ToolBtnProps) {
  return (
    <button
      type="button"
      title={title}
      data-testid={testId}
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

const PRESETS: {
  preset: CameraPreset;
  label: string;
  title: string;
  testId: string;
}[] = [
  {
    preset: "perspective",
    label: "🔭 3D",
    title: "パース（3D）ビュー",
    testId: "view-perspective-btn",
  },
  {
    preset: "top",
    label: "⬆ 上",
    title: "平面図ビュー（真上）",
    testId: "view-top-btn",
  },
  {
    preset: "front",
    label: "正面",
    title: "正面ビュー",
    testId: "view-front-btn",
  },
  {
    preset: "side",
    label: "側面",
    title: "側面ビュー（右）",
    testId: "view-side-btn",
  },
  {
    preset: "isometric",
    label: "等角",
    title: "アイソメトリックビュー",
    testId: "view-isometric-btn",
  },
];

const SHORTCUTS = [
  { key: "W", desc: "移動モード" },
  { key: "E", desc: "回転モード" },
  { key: "R", desc: "拡縮モード" },
  { key: "F", desc: "選択オブジェクトにフォーカス" },
  { key: "Esc", desc: "選択解除" },
  { key: "Ctrl+D", desc: "選択オブジェクトを複製" },
  { key: "Del / BS", desc: "選択オブジェクト削除" },
  { key: "Ctrl+Z", desc: "元に戻す（Undo）" },
  { key: "Ctrl+Y", desc: "やり直す（Redo）" },
];

function exportSceneAsGLB() {
  const scene = getActiveScene();
  if (!scene) return;
  const exporter = new GLTFExporter();
  exporter.parse(
    scene,
    (result) => {
      const blob = new Blob([result as ArrayBuffer], {
        type: "model/gltf-binary",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arcsphere3d-${Date.now()}.glb`;
      a.click();
      URL.revokeObjectURL(url);
    },
    (err) => {
      console.error("[GLTF export]", err);
    },
    { binary: true },
  );
}

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

  const hasObjects = useSceneStore((s) => s.objects.length > 0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        shortcutsRef.current &&
        !shortcutsRef.current.contains(e.target as Node)
      ) {
        setShortcutsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shortcutsOpen]);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur">
      <ToolBtn
        label="グリッド"
        title="グリッド表示切替"
        active={showGrid}
        testId="grid-toggle-btn"
        onClick={toggleGrid}
      />
      <ToolBtn
        label="軸"
        title="座標軸表示切替"
        active={showAxes}
        testId="axes-toggle-btn"
        onClick={toggleAxes}
      />
      <ToolBtn
        label="ワイヤー"
        title="ワイヤーフレーム切替"
        active={wireframe}
        testId="wireframe-toggle-btn"
        onClick={toggleWireframe}
      />
      <ToolBtn
        label="カメラリセット"
        title="カメラ位置をリセット"
        testId="camera-reset-btn"
        onClick={resetCamera}
      />

      <div className="mx-1 h-4 w-px bg-slate-600" />

      {PRESETS.map(({ preset, label, title, testId }) => (
        <ToolBtn
          key={preset}
          label={label}
          title={title}
          testId={testId}
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
      <button
        type="button"
        title="シーンを GLTF (.glb) でエクスポート"
        data-testid="export-gltf-btn"
        disabled={!hasObjects}
        onClick={exportSceneAsGLB}
        className="rounded px-2 py-1 text-xs font-medium transition bg-slate-800/70 text-slate-300 hover:bg-slate-700/80 dark:bg-slate-800/70 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        📥 GLB
      </button>

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

      <div className="relative" ref={shortcutsRef}>
        <button
          type="button"
          data-testid="shortcuts-btn"
          title="キーボードショートカット一覧"
          onClick={() => setShortcutsOpen((o) => !o)}
          className="rounded bg-slate-800/70 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700/80"
        >
          ?
        </button>
        {shortcutsOpen && (
          <div
            data-testid="shortcuts-panel"
            className="absolute bottom-full right-0 mb-2 min-w-[180px] rounded-lg bg-slate-900 p-3 shadow-xl ring-1 ring-slate-700"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              キーボードショートカット
            </p>
            <table className="w-full text-xs">
              <tbody>
                {SHORTCUTS.map(({ key, desc }) => (
                  <tr key={key}>
                    <td className="pr-3 py-0.5">
                      <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
                        {key}
                      </kbd>
                    </td>
                    <td className="py-0.5 text-slate-300">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
