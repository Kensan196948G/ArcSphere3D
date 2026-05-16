import { create } from "zustand";

export type ColorMode = "height" | "intensity" | "rgb" | "uniform";

export interface PointCloudModel {
  id: string;
  name: string;
  pointCount: number;
  visible: boolean;
}

interface PointCloudState {
  models: PointCloudModel[];
  visibleIds: string[];
  pointSize: number;
  colorMode: ColorMode;
  isLoading: boolean;
  loadError: string | null;
  addModel: (model: PointCloudModel) => void;
  removeModel: (id: string) => void;
  toggleVisible: (id: string) => void;
  setPointSize: (size: number) => void;
  setColorMode: (mode: ColorMode) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePointCloudStore = create<PointCloudState>((set) => ({
  models: [],
  visibleIds: [],
  pointSize: 1.5,
  colorMode: "height",
  isLoading: false,
  loadError: null,
  addModel: (model) =>
    set((s) => ({
      models: [...s.models, model],
      visibleIds: [...s.visibleIds, model.id],
    })),
  removeModel: (id) =>
    set((s) => ({
      models: s.models.filter((m) => m.id !== id),
      visibleIds: s.visibleIds.filter((v) => v !== id),
    })),
  toggleVisible: (id) =>
    set((s) => ({
      visibleIds: s.visibleIds.includes(id)
        ? s.visibleIds.filter((v) => v !== id)
        : [...s.visibleIds, id],
    })),
  setPointSize: (pointSize) => set({ pointSize }),
  setColorMode: (colorMode) => set({ colorMode }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (loadError) => set({ loadError }),
}));
