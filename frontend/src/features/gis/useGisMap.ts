/**
 * MapLibre GL JS is loaded as a global script from /maplibre-gl/maplibre-gl.js (CSP build)
 * to avoid rollup OOM. The global is declared here for TypeScript type safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const maplibregl: any;

import { useEffect, useRef } from "react";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { useGisStore, BASEMAP_STYLES } from "@/state/gisStore";

export function useGisMap(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<MaplibreMap | null>(null);
  const { center, zoom, basemap, setViewport, setBasemap } = useGisStore();

  // Initialize map once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    if (typeof maplibregl === "undefined") {
      console.error("[GIS] maplibre-gl global not loaded — ensure /maplibre-gl/maplibre-gl.js is in public/");
      return;
    }

    // Point CSP build to the separate worker file
    maplibregl.workerUrl = "/maplibre-gl/maplibre-gl-worker.js";

    let map: MaplibreMap;
    try {
      map = new maplibregl.Map({
        container,
        style: buildRasterStyle(BASEMAP_STYLES[basemap]),
        center,
        zoom,
        attributionControl: false,
      });
    } catch (err) {
      console.warn("[GIS] maplibre-gl Map init failed (WebGL unavailable?):", err);
      return;
    }

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("moveend", () => {
      const c = map.getCenter();
      setViewport([c.lng, c.lat], map.getZoom());
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // Sync basemap changes without remounting
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setStyle(buildRasterStyle(BASEMAP_STYLES[basemap]));
  }, [basemap]);

  return { mapRef, setBasemap };
}

function buildRasterStyle(tileUrl: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: tileUrl.includes("gsi.go.jp")
          ? "国土地理院"
          : "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
      },
    ],
  };
}
