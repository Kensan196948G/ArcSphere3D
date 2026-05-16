import { useViewportStore } from "@/state/viewportStore";

export default function SettingsPanel() {
  const {
    bgColor, setBgColor,
    gridSize, setGridSize,
    ambientIntensity, setAmbientIntensity,
    dirIntensity, setDirIntensity,
  } = useViewportStore();

  return (
    <div className="flex flex-col gap-4 text-xs">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        ビューポート設定
      </h3>

      {/* 背景色 */}
      <label className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-[10px] text-slate-500 dark:text-slate-400">背景色</span>
        <input
          type="color"
          value={bgColor}
          onChange={(e) => setBgColor(e.target.value)}
          className="h-7 w-16 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[10px] text-slate-400">{bgColor}</span>
      </label>

      {/* グリッドサイズ */}
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          グリッドサイズ: {gridSize}
        </span>
        <input
          type="range"
          min={5} max={100} step={5}
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          className="accent-arc-accent"
        />
      </label>

      <hr className="border-slate-200 dark:border-slate-700" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        ライティング
      </h3>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          環境光: {ambientIntensity.toFixed(2)}
        </span>
        <input
          type="range"
          min={0} max={3} step={0.05}
          value={ambientIntensity}
          onChange={(e) => setAmbientIntensity(Number(e.target.value))}
          className="accent-arc-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          指向光: {dirIntensity.toFixed(2)}
        </span>
        <input
          type="range"
          min={0} max={3} step={0.05}
          value={dirIntensity}
          onChange={(e) => setDirIntensity(Number(e.target.value))}
          className="accent-arc-accent"
        />
      </label>

      <hr className="border-slate-200 dark:border-slate-700" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        パフォーマンス
      </h3>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        DPR: {Math.min(window.devicePixelRatio, 2).toFixed(1)} (最大 2.0 に制限)
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        レンダラー: WebGL 2 (antialias 有効)
      </p>
    </div>
  );
}
