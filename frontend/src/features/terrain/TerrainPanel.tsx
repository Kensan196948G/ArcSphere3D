import { useRef } from "react";
import { useTerrainStore } from "@/state/terrainStore";
import { useTinSurface } from "./useTinSurface";

function parseCsvPoints(text: string) {
  const lines = text.trim().split("\n");
  const pts: { x: number; y: number; z: number }[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t\s]+/).map(Number);
    if (parts.length >= 3 && parts.every((n) => !isNaN(n))) {
      pts.push({ x: parts[0], y: parts[1], z: parts[2] });
    }
  }
  return pts;
}

export default function TerrainPanel() {
  useTinSurface();
  const store = useTerrainStore();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    store.setLoading(true);
    store.setError(null);
    try {
      const text = await file.text();
      const pts = parseCsvPoints(text);
      if (pts.length < 3) {
        store.setError("3点以上の座標が必要です。");
        return;
      }
      store.clearPoints();
      store.addPoints(pts);
    } catch {
      store.setError("ファイルの読み込みに失敗しました。");
    } finally {
      store.setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const btnBase =
    "rounded px-3 py-1.5 text-[11px] font-medium transition-colors";
  const btnActive = `${btnBase} bg-arc-accent/20 text-arc-accent ring-1 ring-arc-accent/40`;
  const btnInactive = `${btnBase} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300`;

  return (
    <div className="flex flex-col gap-3">
      {/* File import */}
      <div>
        <p className="mb-1 text-[10px] text-slate-500 dark:text-slate-400">
          CSV / テキスト (X Y Z 区切り)
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={store.isLoading}
          className="w-full rounded bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300"
        >
          {store.isLoading ? "読み込み中…" : "XYZ ファイルを読み込む"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.xyz"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {store.loadError && (
        <p className="text-[11px] text-rose-500">{store.loadError}</p>
      )}

      {/* Display toggles */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          表示設定
        </p>
        <button
          type="button"
          onClick={() => store.setShowTin(!store.showTin)}
          className={store.showTin ? btnActive : btnInactive}
        >
          TIN サーフェス
        </button>
        <button
          type="button"
          onClick={() => store.setShowContours(!store.showContours)}
          className={store.showContours ? btnActive : btnInactive}
        >
          三角形エッジ
        </button>
      </div>

      {/* Contour interval */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            等高線間隔
          </span>
          <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300">
            {store.contourInterval} m
          </span>
        </div>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={store.contourInterval}
          onChange={(e) => store.setContourInterval(Number(e.target.value))}
          className="w-full accent-arc-accent"
          aria-label="等高線間隔"
        />
      </div>

      {/* Point count */}
      {store.points.length > 0 && (
        <div className="rounded bg-slate-100 px-2 py-2 text-[11px] dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            点数:{" "}
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              {store.points.length.toLocaleString()}
            </span>
          </p>
          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
            標高範囲:{" "}
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              {Math.min(...store.points.map((p) => p.y)).toFixed(2)} ～{" "}
              {Math.max(...store.points.map((p) => p.y)).toFixed(2)} m
            </span>
          </p>
          <button
            type="button"
            onClick={store.clearPoints}
            className="mt-2 w-full rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
          >
            クリア
          </button>
        </div>
      )}

      {store.points.length === 0 && !store.isLoading && (
        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          XYZ 座標ファイルを読み込むと Delaunay 三角形分割 (TIN) で地形モデルが生成されます。
        </p>
      )}
    </div>
  );
}
