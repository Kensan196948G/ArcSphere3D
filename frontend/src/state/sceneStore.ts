import { create } from "zustand";
import type { Object3D } from "three";

export interface SceneObject {
  id: string;
  name: string;
  object: Object3D;
}

export type TransformMode = "translate" | "rotate" | "scale";

interface SceneState {
  objects: SceneObject[];
  logs: string[];
  selectedId: string | null;
  transformMode: TransformMode;
  addObject: (obj: SceneObject) => void;
  removeObject: (id: string) => void;
  select: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  log: (line: string) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  objects: [],
  logs: [],
  selectedId: null,
  transformMode: "translate",
  addObject: (obj) =>
    set((s) => ({
      objects: [...s.objects, obj],
      logs: [...s.logs, `[scene] + ${obj.name}`].slice(-200),
    })),
  removeObject: (id) =>
    set((s) => {
      const target = s.objects.find((o) => o.id === id);
      if (!target) return s;
      target.object.removeFromParent();
      return {
        objects: s.objects.filter((o) => o.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        logs: [...s.logs, `[scene] - ${target.name}`].slice(-200),
      };
    }),
  select: (id) =>
    set((s) => {
      if (s.selectedId === id) return s;
      const name = id ? s.objects.find((o) => o.id === id)?.name ?? id : "none";
      return {
        selectedId: id,
        logs: [...s.logs, `[scene] ◉ select ${name}`].slice(-200),
      };
    }),
  setTransformMode: (mode) =>
    set((s) => {
      if (s.transformMode === mode) return s;
      return {
        transformMode: mode,
        logs: [...s.logs, `[scene] ⇄ mode ${mode}`].slice(-200),
      };
    }),
  log: (line) =>
    set((s) => ({ logs: [...s.logs, line].slice(-200) })),
}));
