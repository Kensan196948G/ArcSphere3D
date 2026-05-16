import { useEarthworkStore } from "@/state/earthworkStore";
import { useTerrainStore } from "@/state/terrainStore";

/**
 * Calculate cut/fill volume using the average-end-area / prismoidal method
 * over a TIN point cloud relative to a base surface elevation (Z).
 *
 * Each TIN triangle contributes its volume above (fill) or below (cut) the
 * base surface. For simplicity we use the signed-volume approach per vertex.
 */
function calcVolume(
  points: { x: number; y: number; z: number }[],
  triangles: number[],
  baseZ: number,
): { cutVolume: number; fillVolume: number } {
  let cut = 0;
  let fill = 0;

  for (let i = 0; i < triangles.length; i += 3) {
    const p0 = points[triangles[i]];
    const p1 = points[triangles[i + 1]];
    const p2 = points[triangles[i + 2]];

    // XZ-plane area of the triangle (horizontal projection)
    const area =
      Math.abs(
        (p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z),
      ) / 2;

    // Average elevation of the triangle above the base surface
    const avgH = ((p0.y + p1.y + p2.y) / 3) - baseZ;

    const vol = area * avgH;
    if (vol > 0) {
      fill += vol;
    } else {
      cut += -vol;
    }
  }

  return { cutVolume: cut, fillVolume: fill };
}

import Delaunator from "delaunator";

function runCalculation(
  points: { x: number; y: number; z: number }[],
  baseZ: number,
) {
  if (points.length < 3) return null;
  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].z;
  }
  const d = new Delaunator(coords);
  const { cutVolume, fillVolume } = calcVolume(points, Array.from(d.triangles), baseZ);
  return { cutVolume, fillVolume, netVolume: fillVolume - cutVolume };
}

export default function EarthworkPanel() {
  const store = useEarthworkStore();
  const terrainPoints = useTerrainStore((s) => s.points);

  function handleCalc() {
    if (terrainPoints.length < 3) {
      store.setError("地形パネルで 3 点以上の XYZ データを読み込んでください。");
      return;
    }
    store.setCalculating(true);
    store.setError(null);
    try {
      const result = runCalculation(terrainPoints, store.baseSurfaceZ);
      store.setResult(result);
    } catch {
      store.setError("計算に失敗しました。");
    } finally {
      store.setCalculating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Base surface elevation */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            基準面標高 (m)
          </span>
          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
            {store.baseSurfaceZ.toFixed(2)} m
          </span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          step={0.5}
          value={store.baseSurfaceZ}
          onChange={(e) => store.setBaseSurfaceZ(Number(e.target.value))}
          className="w-full accent-arc-accent"
          aria-label="基準面標高"
        />
        <input
          type="number"
          value={store.baseSurfaceZ}
          step={0.1}
          onChange={(e) => store.setBaseSurfaceZ(Number(e.target.value))}
          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          aria-label="基準面標高入力"
        />
      </div>

      {/* Terrain point count indicator */}
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        地形点数:{" "}
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
          {terrainPoints.length.toLocaleString()}
        </span>
      </p>

      {store.error && (
        <p className="text-[11px] text-rose-500">{store.error}</p>
      )}

      {/* Calculate button */}
      <button
        type="button"
        onClick={handleCalc}
        disabled={store.isCalculating || terrainPoints.length < 3}
        className="w-full rounded bg-arc-accent/20 px-3 py-1.5 text-[11px] font-medium text-arc-accent ring-1 ring-arc-accent/40 transition-colors hover:bg-arc-accent/30 disabled:opacity-40"
      >
        {store.isCalculating ? "計算中…" : "土量を計算"}
      </button>

      {/* Results */}
      {store.result && (
        <div className="rounded bg-slate-100 px-3 py-2 text-[11px] dark:bg-slate-800">
          <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
            計算結果
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">切土量</span>
              <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                {store.result.cutVolume.toFixed(2)} m³
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">盛土量</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {store.result.fillVolume.toFixed(2)} m³
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">差引</span>
              <span
                className={`font-mono font-semibold ${
                  store.result.netVolume >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {store.result.netVolume >= 0 ? "+" : ""}
                {store.result.netVolume.toFixed(2)} m³
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={store.clearResult}
            className="mt-2 w-full rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
          >
            クリア
          </button>
        </div>
      )}

      {!store.result && terrainPoints.length === 0 && (
        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          地形パネルで XYZ ファイルを読み込んでから基準面標高を設定し、土量を計算します。
        </p>
      )}
    </div>
  );
}
