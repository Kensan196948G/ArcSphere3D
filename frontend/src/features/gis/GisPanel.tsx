import { useRef } from "react";
// maplibre-gl CSS is loaded via <link> in index.html (served from /maplibre-gl/maplibre-gl.css)
import { useGisMap } from "./useGisMap";
import {
  useGisStore,
  BASEMAP_LABELS,
  type BasemapId,
} from "@/state/gisStore";

const BASEMAP_OPTIONS: BasemapId[] = ["gsi-std", "gsi-pale", "gsi-photo", "osm"];

export default function GisPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { setBasemap } = useGisMap(mapContainerRef);
  const { basemap, center, zoom } = useGisStore();

  const handleBasemapChange = (id: BasemapId) => {
    setBasemap(id);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Basemap selector */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          背景地図
        </p>
        <div className="flex flex-col gap-1">
          {BASEMAP_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => handleBasemapChange(id)}
              className={[
                "rounded px-2 py-1 text-left text-[11px] transition-colors",
                basemap === id
                  ? "bg-arc-accent/20 text-arc-accent dark:bg-arc-accent/30"
                  : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300",
              ].join(" ")}
            >
              {BASEMAP_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      {/* Coordinate display */}
      <div className="rounded bg-slate-100 px-2 py-1.5 text-[11px] dark:bg-slate-800">
        <div className="text-slate-500 dark:text-slate-400">
          中心座標
        </div>
        <div className="font-mono text-slate-700 dark:text-slate-300">
          {center[1].toFixed(6)}°N, {center[0].toFixed(6)}°E
        </div>
        <div className="text-slate-500 dark:text-slate-400">
          ズーム: {zoom.toFixed(1)}
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 min-h-0 rounded overflow-hidden border border-slate-200 dark:border-slate-700">
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{ minHeight: "240px" }}
        />
      </div>

      {/* Attribution note */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
        地理院タイル: 国土地理院 承認番号なし（測量法第29条に基づく）
      </p>
    </div>
  );
}
