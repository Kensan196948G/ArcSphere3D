import { create } from "zustand";

export type PanelId =
  | "project"
  | "model"
  | "layer"
  | "bim"
  | "material"
  | "ai"
  | "settings";

interface UiState {
  activePanel: PanelId;
  setActivePanel: (id: PanelId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: "model",
  setActivePanel: (id) => set({ activePanel: id }),
}));
