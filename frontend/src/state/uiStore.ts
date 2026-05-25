import { create } from "zustand";

export type PanelId =
  | "project"
  | "model"
  | "properties"
  | "layer"
  | "bim"
  | "material"
  | "ai"
  | "settings"
  | "gis"
  | "measure"
  | "pointcloud"
  | "terrain"
  | "earthwork"
  | "alignment"
  | "cad"
  | "members"
  | "admin"
  | "profile";

interface UiState {
  activePanel: PanelId;
  setActivePanel: (id: PanelId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: "model",
  setActivePanel: (id) => set({ activePanel: id }),
}));
