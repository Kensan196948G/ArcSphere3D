import { useRef } from "react";
import { usePointCloudStore, type ColorMode } from "@/state/pointcloudStore";
import { usePointCloudLoader } from "./usePointCloudLoader";

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: "height", label: "高さ" },
  { id: "intensity", label: "強度" },
  { id: "rgb", label: "RGB" },
  { id: "uniform", label: "単色" },
];

export default function PointCloudPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { models, visibleIds, pointSize, colorMode, isLoading, loadError,
    toggleVisible, setPointSize, setColorMode } = usePointCloudStore();
  const { loadFile, removeFromScene } = usePointCloudLoader();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      {/* File loader */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".las,.laz"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="w-full rounded bg-arc-accent/20 px-3 py-2 text-[11px] font-medium text-arc-accent ring-1 ring-arc-accent/40 transition-colors hover:bg-arc-accent/30 disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "読み込み中…" : "LAS / LAZ を読み込む"}
        </button>
        {loadError && (
          <p className="mt-1 text-[10px] text-rose-500">{loadError}</p>
        )}
      </div>

      {/* Color mode */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          カラーモード
        </p>
        <div className="flex flex-wrap gap-1">
          {COLOR_MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setColorMode(id)}
              className={[
                "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                colorMode === id
                  ? "bg-arc-accent/20 text-arc-accent ring-1 ring-arc-accent/40"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Point size */}
      <div>
        <label className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          点サイズ
          <span className="font-mono normal-case">{pointSize.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.1}
          value={pointSize}
          onChange={(e) => setPointSize(parseFloat(e.target.value))}
          className="w-full accent-arc-accent"
        />
      </div>

      {/* Model list */}
      {models.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ロード済み ({models.length})
          </p>
          <ul className="flex flex-col gap-1">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-[11px] dark:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={visibleIds.includes(m.id)}
                  onChange={() => toggleVisible(m.id)}
                  className="accent-arc-accent"
                />
                <span className="flex-1 truncate text-slate-700 dark:text-slate-300">
                  {m.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  {(m.pointCount / 1000).toFixed(0)}k pts
                </span>
                <button
                  type="button"
                  onClick={() => removeFromScene(m.id)}
                  className="ml-1 text-rose-400 hover:text-rose-600"
                  title="削除"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {models.length === 0 && !isLoading && (
        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          LAS / LAZ ファイルを読み込むと 3D ビューに点群が表示されます。
        </p>
      )}
    </div>
  );
}
