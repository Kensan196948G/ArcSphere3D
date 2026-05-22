import { create } from "zustand";
import { Mesh, type Object3D } from "three";
import { getActiveScene } from "@/lib/threeContext";

export interface SceneObject {
  id: string;
  name: string;
  object: Object3D;
  layerId: string;
  visible: boolean;
}

export type TransformMode = "translate" | "rotate" | "scale";

type UndoCommand =
  | { type: "RESTORE"; obj: SceneObject }
  | { type: "DELETE"; id: string };

const MAX_HISTORY = 20;

interface SceneState {
  objects: SceneObject[];
  logs: string[];
  selectedId: string | null;
  transformMode: TransformMode;
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  addObject: (
    obj: Omit<SceneObject, "layerId" | "visible"> &
      Partial<Pick<SceneObject, "layerId" | "visible">>,
  ) => void;
  removeObject: (id: string) => void;
  clearScene: () => void;
  select: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  renameObject: (id: string, name: string) => void;
  duplicateObject: (id: string) => void;
  setObjectVisibility: (id: string, visible: boolean) => void;
  setObjectLayer: (id: string, layerId: string) => void;
  log: (line: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  objects: [],
  logs: [],
  selectedId: null,
  transformMode: "translate",
  undoStack: [],
  redoStack: [],

  addObject: (obj) => {
    const full: SceneObject = { layerId: "default", visible: true, ...obj };
    set((s) => ({
      objects: [...s.objects, full],
      undoStack: [
        ...s.undoStack.slice(-MAX_HISTORY + 1),
        { type: "DELETE", id: full.id },
      ],
      redoStack: [],
      logs: [...s.logs, `[scene] + ${obj.name}`].slice(-200),
    }));
  },

  removeObject: (id) =>
    set((s) => {
      const target = s.objects.find((o) => o.id === id);
      if (!target) return s;
      target.object.removeFromParent();
      return {
        objects: s.objects.filter((o) => o.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        undoStack: [
          ...s.undoStack.slice(-MAX_HISTORY + 1),
          { type: "RESTORE", obj: target },
        ],
        redoStack: [],
        logs: [...s.logs, `[scene] - ${target.name}`].slice(-200),
      };
    }),

  clearScene: () =>
    set((s) => {
      s.objects.forEach((o) => o.object.removeFromParent());
      return {
        objects: [],
        selectedId: null,
        undoStack: [],
        redoStack: [],
        logs: [...s.logs, "[scene] ✕ シーンをクリア"].slice(-200),
      };
    }),

  select: (id) =>
    set((s) => {
      if (s.selectedId === id) return s;
      const name = id
        ? (s.objects.find((o) => o.id === id)?.name ?? id)
        : "none";
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
        o.id === id
          ? { ...o, name, object: Object.assign(o.object, { name }) }
          : o,
      ),
      logs: [...s.logs, `[scene] ✎ rename ${name}`].slice(-200),
    })),

  duplicateObject: (id) => {
    const src = get().objects.find((o) => o.id === id);
    if (!src) return;
    const clone = src.object.clone();
    // Offset to make the duplicate visible immediately
    clone.position.x += 1;
    // Clone materials independently so color changes don't bleed between copies
    clone.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh && mesh.material) {
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone();
      }
    });
    const newId = `obj-${Date.now()}`;
    const newName = `${src.name} (コピー)`;
    clone.name = newName;
    const scene = src.object.parent;
    if (scene) scene.add(clone);
    const cloneObj: SceneObject = {
      id: newId,
      name: newName,
      object: clone,
      layerId: src.layerId,
      visible: src.visible,
    };
    set((s) => ({
      objects: [...s.objects, cloneObj],
      selectedId: newId,
      undoStack: [
        ...s.undoStack.slice(-MAX_HISTORY + 1),
        { type: "DELETE", id: newId },
      ],
      redoStack: [],
      logs: [...s.logs, `[scene] ⧉ duplicate ${src.name} → ${newName}`].slice(
        -200,
      ),
    }));
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

  log: (line) => set((s) => ({ logs: [...s.logs, line].slice(-200) })),

  undo: () => {
    const { undoStack, objects } = get();
    if (undoStack.length === 0) return;
    const cmd = undoStack[undoStack.length - 1]!;
    const remaining = undoStack.slice(0, -1);

    if (cmd.type === "DELETE") {
      const target = objects.find((o) => o.id === cmd.id);
      if (!target) {
        set(() => ({ undoStack: remaining }));
        return;
      }
      target.object.removeFromParent();
      set((s) => ({
        objects: s.objects.filter((o) => o.id !== cmd.id),
        selectedId: s.selectedId === cmd.id ? null : s.selectedId,
        undoStack: remaining,
        redoStack: [
          ...s.redoStack,
          { type: "RESTORE", obj: target },
        ],
        logs: [...s.logs, `[undo] ↩ 削除取り消し: ${target.name}`].slice(-200),
      }));
    } else {
      const scene = getActiveScene();
      if (scene) scene.add(cmd.obj.object);
      set((s) => ({
        objects: [...s.objects, cmd.obj],
        undoStack: remaining,
        redoStack: [
          ...s.redoStack,
          { type: "DELETE", id: cmd.obj.id },
        ],
        logs: [...s.logs, `[undo] ↩ 復元: ${cmd.obj.name}`].slice(-200),
      }));
    }
  },

  redo: () => {
    const { redoStack, objects } = get();
    if (redoStack.length === 0) return;
    const cmd = redoStack[redoStack.length - 1]!;
    const remaining = redoStack.slice(0, -1);

    if (cmd.type === "DELETE") {
      const target = objects.find((o) => o.id === cmd.id);
      if (!target) {
        set(() => ({ redoStack: remaining }));
        return;
      }
      target.object.removeFromParent();
      set((s) => ({
        objects: s.objects.filter((o) => o.id !== cmd.id),
        selectedId: s.selectedId === cmd.id ? null : s.selectedId,
        redoStack: remaining,
        undoStack: [
          ...s.undoStack.slice(-MAX_HISTORY + 1),
          { type: "RESTORE", obj: target },
        ],
        logs: [...s.logs, `[redo] ↪ 再削除: ${target.name}`].slice(-200),
      }));
    } else {
      const scene = getActiveScene();
      if (scene) scene.add(cmd.obj.object);
      set((s) => ({
        objects: [...s.objects, cmd.obj],
        redoStack: remaining,
        undoStack: [
          ...s.undoStack.slice(-MAX_HISTORY + 1),
          { type: "DELETE", id: cmd.obj.id },
        ],
        logs: [...s.logs, `[redo] ↪ 再追加: ${cmd.obj.name}`].slice(-200),
      }));
    }
  },
}));
