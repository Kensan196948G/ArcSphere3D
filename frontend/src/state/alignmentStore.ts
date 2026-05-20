import { create } from "zustand";
import {
  listAlignments,
  createAlignment as apiCreateAlignment,
  deleteAlignment as apiDeleteAlignment,
  replaceIpPoints,
  type IpPointApiOut,
} from "@/lib/api";

export interface IpPoint {
  id: string;
  seq: number;
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
  selectedIpId: string | null;
  loading: boolean;
  error: string | null;

  fetchAlignments: (token: string, projectId: string) => Promise<void>;
  createAlignment: (
    token: string,
    projectId: string,
    name: string,
    designSpeed: number,
  ) => Promise<void>;
  removeAlignment: (
    token: string,
    projectId: string,
    id: string,
  ) => Promise<void>;
  setActive: (id: string | null) => void;
  setSelectedIpId: (ipId: string | null) => void;
  addIpPoint: (
    alignmentId: string,
    x: number,
    z: number,
    radius: number,
  ) => void;
  removeIpPoint: (alignmentId: string, pointId: string) => void;
  syncIpPoints: (
    token: string,
    projectId: string,
    alignmentId: string,
  ) => Promise<void>;
  setElements: (alignmentId: string, elements: AlignmentElement[]) => void;
}

let _tempSeq = 0;
const tempId = () => `tmp-${++_tempSeq}`;

function fromApi(data: IpPointApiOut): IpPoint {
  return {
    id: data.id,
    seq: data.seq,
    x: data.x,
    z: data.z,
    radius: data.radius,
  };
}

export const useAlignmentStore = create<AlignmentState>((set, get) => ({
  alignments: [],
  activeId: null,
  selectedIpId: null,
  loading: false,
  error: null,

  fetchAlignments: async (token, projectId) => {
    set({ loading: true, error: null });
    try {
      const data = await listAlignments(token, projectId);
      const alignments: Alignment[] = data.map((a) => ({
        id: a.id,
        name: a.name,
        designSpeed: a.design_speed,
        ipPoints: a.ip_points.map(fromApi),
        elements: [],
      }));
      set({ alignments, loading: false, activeId: alignments[0]?.id ?? null });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  createAlignment: async (token, projectId, name, designSpeed) => {
    set({ loading: true, error: null });
    try {
      const data = await apiCreateAlignment(
        token,
        projectId,
        name,
        designSpeed,
      );
      const a: Alignment = {
        id: data.id,
        name: data.name,
        designSpeed: data.design_speed,
        ipPoints: [],
        elements: [],
      };
      set((s) => ({
        alignments: [...s.alignments, a],
        activeId: a.id,
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  removeAlignment: async (token, projectId, id) => {
    set({ loading: true, error: null });
    try {
      await apiDeleteAlignment(token, projectId, id);
      set((s) => ({
        alignments: s.alignments.filter((a) => a.id !== id),
        activeId: s.activeId === id ? null : s.activeId,
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  setActive: (id) => set({ activeId: id, selectedIpId: null }),
  setSelectedIpId: (ipId) => set({ selectedIpId: ipId }),

  addIpPoint: (alignmentId, x, z, radius) =>
    set((s) => {
      const alignments = s.alignments.map((a) => {
        if (a.id !== alignmentId) return a;
        const seq = a.ipPoints.length;
        return {
          ...a,
          ipPoints: [...a.ipPoints, { id: tempId(), seq, x, z, radius }],
        };
      });
      return { alignments };
    }),

  removeIpPoint: (alignmentId, pointId) =>
    set((s) => ({
      alignments: s.alignments.map((a) => {
        if (a.id !== alignmentId) return a;
        const ipPoints = a.ipPoints
          .filter((p) => p.id !== pointId)
          .map((p, i) => ({ ...p, seq: i }));
        return { ...a, ipPoints };
      }),
    })),

  syncIpPoints: async (token, projectId, alignmentId) => {
    const alignment = get().alignments.find((a) => a.id === alignmentId);
    if (!alignment) return;
    try {
      const payload = alignment.ipPoints.map((p, i) => ({
        seq: i,
        x: p.x,
        z: p.z,
        radius: p.radius,
      }));
      const updated = await replaceIpPoints(
        token,
        projectId,
        alignmentId,
        payload,
      );
      set((s) => ({
        alignments: s.alignments.map((a) =>
          a.id !== alignmentId ? a : { ...a, ipPoints: updated.map(fromApi) },
        ),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setElements: (alignmentId, elements) =>
    set((s) => ({
      alignments: s.alignments.map((a) =>
        a.id !== alignmentId ? a : { ...a, elements },
      ),
    })),
}));
