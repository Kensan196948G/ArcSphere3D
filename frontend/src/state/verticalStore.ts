import { create } from "zustand";
import {
  listVerticals,
  createVertical as apiCreateVertical,
  deleteVertical as apiDeleteVertical,
  replaceVips,
  type VipApiOut,
} from "@/lib/api";

export interface Vip {
  id: string;
  station: number;
  elevation: number;
  vcLength: number;
}

export interface VerticalElement {
  type: "grade" | "vcurve";
  startStation: number;
  endStation: number;
  startElevation: number;
  endElevation: number;
  grade?: number;
  length?: number;
  kValue?: number;
  vpcStation?: number;
  vptStation?: number;
  vpcElevation?: number;
  vptElevation?: number;
}

export interface VerticalAlignment {
  id: string;
  alignmentId: string;
  name: string;
  vips: Vip[];
  elements: VerticalElement[];
}

interface VerticalState {
  verticals: VerticalAlignment[];
  activeId: string | null;
  loading: boolean;
  error: string | null;

  fetchVerticals: (
    token: string,
    projectId: string,
    alignmentId: string,
  ) => Promise<void>;
  createVertical: (
    token: string,
    projectId: string,
    alignmentId: string,
    name: string,
  ) => Promise<void>;
  removeVertical: (
    token: string,
    projectId: string,
    alignmentId: string,
    id: string,
  ) => Promise<void>;
  setActive: (id: string | null) => void;
  addVip: (
    verticalId: string,
    station: number,
    elevation: number,
    vcLength: number,
  ) => void;
  updateVip: (
    verticalId: string,
    vipId: string,
    station: number,
    elevation: number,
    vcLength: number,
  ) => void;
  removeVip: (verticalId: string, vipId: string) => void;
  syncVips: (
    token: string,
    projectId: string,
    alignmentId: string,
    verticalId: string,
  ) => Promise<void>;
  setElements: (verticalId: string, elements: VerticalElement[]) => void;
  clearForAlignment: (alignmentId: string) => void;
}

let _tempSeq = 0;
const tempId = () => `tmp-${++_tempSeq}`;

function vipFromApi(v: VipApiOut): Vip {
  return {
    id: v.id,
    station: v.station,
    elevation: v.elevation,
    vcLength: v.vc_length,
  };
}

export const useVerticalStore = create<VerticalState>((set, get) => ({
  verticals: [],
  activeId: null,
  loading: false,
  error: null,

  fetchVerticals: async (token, projectId, alignmentId) => {
    set({ loading: true, error: null });
    try {
      const data = await listVerticals(token, projectId, alignmentId);
      const verticals: VerticalAlignment[] = data.map((va) => ({
        id: va.id,
        alignmentId: va.alignment_id,
        name: va.name,
        vips: va.vips.map(vipFromApi),
        elements: [],
      }));
      set({
        verticals,
        loading: false,
        activeId: verticals[0]?.id ?? null,
      });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  createVertical: async (token, projectId, alignmentId, name) => {
    set({ loading: true, error: null });
    try {
      const data = await apiCreateVertical(token, projectId, alignmentId, name);
      const va: VerticalAlignment = {
        id: data.id,
        alignmentId: data.alignment_id,
        name: data.name,
        vips: [],
        elements: [],
      };
      set((s) => ({
        verticals: [...s.verticals, va],
        activeId: va.id,
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  removeVertical: async (token, projectId, alignmentId, id) => {
    set({ loading: true, error: null });
    try {
      await apiDeleteVertical(token, projectId, alignmentId, id);
      set((s) => ({
        verticals: s.verticals.filter((v) => v.id !== id),
        activeId: s.activeId === id ? null : s.activeId,
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  setActive: (id) => set({ activeId: id }),

  addVip: (verticalId, station, elevation, vcLength) =>
    set((s) => ({
      verticals: s.verticals.map((v) =>
        v.id !== verticalId
          ? v
          : {
              ...v,
              vips: [...v.vips, { id: tempId(), station, elevation, vcLength }],
            },
      ),
    })),

  updateVip: (verticalId, vipId, station, elevation, vcLength) =>
    set((s) => ({
      verticals: s.verticals.map((v) =>
        v.id !== verticalId
          ? v
          : {
              ...v,
              vips: v.vips.map((p) =>
                p.id === vipId ? { ...p, station, elevation, vcLength } : p,
              ),
            },
      ),
    })),

  removeVip: (verticalId, vipId) =>
    set((s) => ({
      verticals: s.verticals.map((v) =>
        v.id !== verticalId
          ? v
          : { ...v, vips: v.vips.filter((p) => p.id !== vipId) },
      ),
    })),

  syncVips: async (token, projectId, alignmentId, verticalId) => {
    const vertical = get().verticals.find((v) => v.id === verticalId);
    if (!vertical) return;
    try {
      const payload = vertical.vips.map((p, i) => ({
        seq: i,
        station: p.station,
        elevation: p.elevation,
        vc_length: p.vcLength,
      }));
      const updated = await replaceVips(
        token,
        projectId,
        alignmentId,
        verticalId,
        payload,
      );
      set((s) => ({
        verticals: s.verticals.map((v) =>
          v.id !== verticalId ? v : { ...v, vips: updated.map(vipFromApi) },
        ),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setElements: (verticalId, elements) =>
    set((s) => ({
      verticals: s.verticals.map((v) =>
        v.id !== verticalId ? v : { ...v, elements },
      ),
    })),

  clearForAlignment: (alignmentId) =>
    set((s) => ({
      verticals: s.verticals.filter((v) => v.alignmentId !== alignmentId),
      activeId: null,
    })),
}));
