import { create } from "zustand";
import type { Vector3 } from "three";

export type MeasureMode = "off" | "distance" | "area" | "height";

interface MeasureState {
  mode: MeasureMode;
  points: Vector3[];
  result: number | null;
  setMode: (mode: MeasureMode) => void;
  addPoint: (point: Vector3) => void;
  clear: () => void;
}

export const useMeasureStore = create<MeasureState>((set) => ({
  mode: "off",
  points: [],
  result: null,
  setMode: (mode) =>
    set((s) => {
      if (s.mode === mode) return s;
      return { mode, points: [], result: null };
    }),
  addPoint: (point) =>
    set((s) => {
      const points = [...s.points, point];
      const result = computeResult(s.mode, points);
      return { points, result };
    }),
  clear: () => set({ points: [], result: null }),
}));

function computeResult(mode: MeasureMode, points: Vector3[]): number | null {
  if (mode === "distance" && points.length >= 2) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += points[i - 1].distanceTo(points[i]);
    }
    return total;
  }
  if (mode === "area" && points.length >= 3) {
    // Shoelace formula on the XZ plane
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      area += a.x * b.z - b.x * a.z;
    }
    return Math.abs(area) / 2;
  }
  if (mode === "height" && points.length >= 2) {
    return Math.abs(points[points.length - 1].y - points[0].y);
  }
  return null;
}
