import { create } from "zustand";

export type BasemapId = "osm" | "gsi-std" | "gsi-pale" | "gsi-photo";

export interface GisState {
  // Map viewport
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
  // Basemap
  basemap: BasemapId;
  setBasemap: (id: BasemapId) => void;
  // Visibility
  mapVisible: boolean;
  setMapVisible: (v: boolean) => void;
  // Viewport update (called by MapLibre camera events)
  setViewport: (center: [number, number], zoom: number) => void;
}

export const BASEMAP_STYLES: Record<BasemapId, string> = {
  osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  "gsi-std": "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  "gsi-pale": "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
  "gsi-photo": "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

export const BASEMAP_LABELS: Record<BasemapId, string> = {
  osm: "OpenStreetMap",
  "gsi-std": "地理院地図（標準）",
  "gsi-pale": "地理院地図（淡色）",
  "gsi-photo": "地理院 空中写真",
};

export const useGisStore = create<GisState>((set) => ({
  center: [135.0, 35.0], // Default: center of Japan
  zoom: 5,
  bearing: 0,
  pitch: 0,
  basemap: "gsi-std",
  setBasemap: (id) => set({ basemap: id }),
  mapVisible: false,
  setMapVisible: (v) => set({ mapVisible: v }),
  setViewport: (center, zoom) => set({ center, zoom }),
}));
