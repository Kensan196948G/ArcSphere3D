import { create } from "zustand";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  color: string;
}

interface LayerState {
  layers: Layer[];
  addLayer: (name: string) => string;
  removeLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  toggleLayerVisibility: (id: string) => void;
  setLayerColor: (id: string, color: string) => void;
}

const DEFAULT_COLORS = [
  "#5eead4", "#818cf8", "#f59e0b", "#34d399", "#f87171",
  "#60a5fa", "#c084fc", "#fb923c",
];

let colorIdx = 0;

export const useLayerStore = create<LayerState>((set) => ({
  layers: [{ id: "default", name: "デフォルト", visible: true, color: "#5eead4" }],
  addLayer: (name) => {
    const id = `layer-${Date.now()}`;
    const color = DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length];
    set((s) => ({ layers: [...s.layers, { id, name, visible: true, color }] }));
    return id;
  },
  removeLayer: (id) =>
    set((s) => ({
      layers: s.layers.filter((l) => l.id !== id && l.id !== "default"),
    })),
  renameLayer: (id, name) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    })),
  toggleLayerVisibility: (id) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l,
      ),
    })),
  setLayerColor: (id, color) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, color } : l)),
    })),
}));
