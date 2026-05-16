import { create } from "zustand";
import type { Object3D } from "three";

export interface SceneObject {
  id: string;
  name: string;
  object: Object3D;
  layerId: string;
  visible: boolean;
}

export type TransformMode = "translate" | "rotate" | "scale";

interface SceneState {
  objects: SceneObject[];
  logs: string[];
  selectedId: string | null;
  transformMode: TransformMode;
  addObject: (obj: Omit<SceneObject, "layerId" | "visible"> & Partial<Pick<SceneObject, "layerId" | "visible">>) => void;
  removeObject: (id: string) => void;
  select: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  renameObject: (id: string, name: string) => void;
  duplicateObject: (id: string) => void;
  setObjectVisibility: (id: string, visible: boolean) => void;
  setObjectLayer: (id: string, layerId: string) => void;
  log: (line: string) => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  objects: [],
  logs: [],
  selectedId: null,
  transformMode: "translate",
  addObject: (obj) =>
    set((s) => ({
      objects: [
        ...s.objects,
        { layerId: "default", visible: true, ...obj },
      ],
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
  renameObject: (id, name) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? { ...o, name, object: Object.assign(o.object, { name }) } : o,
      ),
      logs: [...s.logs, `[scene] ✎ rename ${name}`].slice(-200),
    })),
  duplicateObject: (id) => {
    const src = get().objects.find((o) => o.id === id);
    if (!src) return;
    const clone = src.object.clone();
    clone.position.x += 1;
    const newId = `obj-${Date.now()}`;
    const newName = `${src.name} (コピー)`;
    clone.name = newName;
    set((s) => ({
      objects: [
        ...s.objects,
        { id: newId, name: newName, object: clone, layerId: src.layerId, visible: src.visible },
      ],
      logs: [...s.logs, `[scene] ⧉ duplicate ${src.name}`].slice(-200),
    }));
    const scene = src.object.parent;
    if (scene) scene.add(clone);
  },
  setObjectVisibility: (id, visible) =>
    set((s) => ({
      objects: s.objects.map((o) => {
        if (o.id !== id) return o;
        o.object.visible = visible;
        return { ...o, visible };
      }),
    })),
  setObjectLayer: (id, layerId) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, layerId } : o)),
    })),
  log: (line) =>
    set((s) => ({ logs: [...s.logs, line].slice(-200) })),
}));
