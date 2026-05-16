import { create } from "zustand";
import type { Object3D } from "three";

export interface SceneObject {
  id: string;
  name: string;
  object: Object3D;
}

interface SceneState {
  objects: SceneObject[];
  logs: string[];
  addObject: (obj: SceneObject) => void;
  removeObject: (id: string) => void;
  log: (line: string) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  objects: [],
  logs: [],
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
        logs: [...s.logs, `[scene] - ${target.name}`].slice(-200),
      };
    }),
  log: (line) =>
    set((s) => ({ logs: [...s.logs, line].slice(-200) })),
}));
