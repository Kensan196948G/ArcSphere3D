import { create } from "zustand";

export interface IpPoint {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface AlignmentElement {
  type: "tangent" | "curve";
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  length: number;
  radius?: number;
  centerX?: number;
  centerZ?: number;
}

export interface Alignment {
  id: string;
  name: string;
  designSpeed: number;
  ipPoints: IpPoint[];
  elements: AlignmentElement[];
}

interface AlignmentState {
  alignments: Alignment[];
  activeId: string | null;

  addAlignment: (name: string, designSpeed: number) => void;
  removeAlignment: (id: string) => void;
  setActive: (id: string | null) => void;
  addIpPoint: (alignmentId: string, x: number, z: number, radius: number) => void;
  updateIpPoint: (alignmentId: string, pointId: string, x: number, z: number, radius: number) => void;
  removeIpPoint: (alignmentId: string, pointId: string) => void;
  setElements: (alignmentId: string, elements: AlignmentElement[]) => void;
}

let _nextId = 1;
const uid = () => String(_nextId++);

export const useAlignmentStore = create<AlignmentState>((set) => ({
  alignments: [],
  activeId: null,

  addAlignment: (name, designSpeed) =>
    set((s) => {
      const a: Alignment = { id: uid(), name, designSpeed, ipPoints: [], elements: [] };
      return { alignments: [...s.alignments, a], activeId: a.id };
    }),

  removeAlignment: (id) =>
    set((s) => ({
      alignments: s.alignments.filter((a) => a.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    })),

  setActive: (id) => set({ activeId: id }),

  addIpPoint: (alignmentId, x, z, radius) =>
    set((s) => ({
      alignments: s.alignments.map((a) =>
        a.id !== alignmentId
          ? a
          : { ...a, ipPoints: [...a.ipPoints, { id: uid(), x, z, radius }] },
      ),
    })),

  updateIpPoint: (alignmentId, pointId, x, z, radius) =>
    set((s) => ({
      alignments: s.alignments.map((a) =>
        a.id !== alignmentId
          ? a
          : {
              ...a,
              ipPoints: a.ipPoints.map((p) =>
                p.id === pointId ? { ...p, x, z, radius } : p,
              ),
            },
      ),
    })),

  removeIpPoint: (alignmentId, pointId) =>
    set((s) => ({
      alignments: s.alignments.map((a) =>
        a.id !== alignmentId
          ? a
          : { ...a, ipPoints: a.ipPoints.filter((p) => p.id !== pointId) },
      ),
    })),

  setElements: (alignmentId, elements) =>
    set((s) => ({
      alignments: s.alignments.map((a) =>
        a.id !== alignmentId ? a : { ...a, elements },
      ),
    })),
}));
