import { create } from "zustand";

export type EarthworkMethod = "average-end-area" | "prismoidal";

interface EarthworkResult {
  cutVolume: number;
  fillVolume: number;
  netVolume: number;
}

interface EarthworkState {
  baseSurfaceZ: number;
  method: EarthworkMethod;
  result: EarthworkResult | null;
  isCalculating: boolean;
  error: string | null;

  setBaseSurfaceZ: (z: number) => void;
  setMethod: (m: EarthworkMethod) => void;
  setResult: (r: EarthworkResult | null) => void;
  setCalculating: (v: boolean) => void;
  setError: (msg: string | null) => void;
  clearResult: () => void;
}

export const useEarthworkStore = create<EarthworkState>((set) => ({
  baseSurfaceZ: 0,
  method: "average-end-area",
  result: null,
  isCalculating: false,
  error: null,

  setBaseSurfaceZ: (z) => set({ baseSurfaceZ: z }),
  setMethod: (m) => set({ method: m }),
  setResult: (r) => set({ result: r }),
  setCalculating: (v) => set({ isCalculating: v }),
  setError: (msg) => set({ error: msg }),
  clearResult: () => set({ result: null, error: null }),
}));
