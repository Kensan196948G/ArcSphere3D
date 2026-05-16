import { create } from "zustand";

export type DemSource = "manual" | "gsi";

export interface TerrainPoint {
  x: number;
  y: number; // elevation
  z: number;
}

interface TerrainState {
  points: TerrainPoint[];
  demSource: DemSource;
  contourInterval: number;
  showContours: boolean;
  showTin: boolean;
  isLoading: boolean;
  loadError: string | null;

  addPoints: (pts: TerrainPoint[]) => void;
  clearPoints: () => void;
  setDemSource: (src: DemSource) => void;
  setContourInterval: (v: number) => void;
  setShowContours: (v: boolean) => void;
  setShowTin: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
}

export const useTerrainStore = create<TerrainState>((set) => ({
  points: [],
  demSource: "manual",
  contourInterval: 1,
  showContours: true,
  showTin: true,
  isLoading: false,
  loadError: null,

  addPoints: (pts) => set((s) => ({ points: [...s.points, ...pts] })),
  clearPoints: () => set({ points: [], loadError: null }),
  setDemSource: (src) => set({ demSource: src }),
  setContourInterval: (v) => set({ contourInterval: v }),
  setShowContours: (v) => set({ showContours: v }),
  setShowTin: (v) => set({ showTin: v }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ loadError: msg }),
}));
