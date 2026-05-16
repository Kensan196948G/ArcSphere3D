import { create } from "zustand";

/** Vertical Intersection Point (VIP / PVI): station along horizontal alignment + elevation + vertical curve length. */
export interface Vip {
  id: string;
  station: number;   // distance along road from origin (m)
  elevation: number; // elevation at VIP (m)
  vcLength: number;  // vertical curve length L (m); 0 = no curve (grade break only)
}

export interface VerticalElement {
  type: "grade" | "vcurve";
  startStation: number;
  endStation: number;
  startElevation: number;
  endElevation: number;
  /** grade in % (positive = uphill) */
  grade?: number;
  /** vertical curve length (m) */
  length?: number;
  /** K value = L / |g2 - g1| */
  kValue?: number;
  /** VPC station */
  vpcStation?: number;
  /** VPT station */
  vptStation?: number;
  /** VPC elevation */
  vpcElevation?: number;
  /** VPT elevation */
  vptElevation?: number;
}

export interface VerticalAlignment {
  id: string;
  /** ties back to horizontal Alignment.id */
  alignmentId: string;
  name: string;
  vips: Vip[];
  elements: VerticalElement[];
}

interface VerticalState {
  verticals: VerticalAlignment[];
  activeId: string | null;

  addVertical: (alignmentId: string, name: string) => void;
  removeVertical: (id: string) => void;
  setActive: (id: string | null) => void;
  addVip: (verticalId: string, station: number, elevation: number, vcLength: number) => void;
  updateVip: (verticalId: string, vipId: string, station: number, elevation: number, vcLength: number) => void;
  removeVip: (verticalId: string, vipId: string) => void;
  setElements: (verticalId: string, elements: VerticalElement[]) => void;
}

let _nextId = 1;
const uid = () => String(_nextId++);

export const useVerticalStore = create<VerticalState>((set) => ({
  verticals: [],
  activeId: null,

  addVertical: (alignmentId, name) =>
    set((s) => {
      const v: VerticalAlignment = { id: uid(), alignmentId, name, vips: [], elements: [] };
      return { verticals: [...s.verticals, v], activeId: v.id };
    }),

  removeVertical: (id) =>
    set((s) => ({
      verticals: s.verticals.filter((v) => v.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    })),

  setActive: (id) => set({ activeId: id }),

  addVip: (verticalId, station, elevation, vcLength) =>
    set((s) => ({
      verticals: s.verticals.map((v) =>
        v.id !== verticalId
          ? v
          : { ...v, vips: [...v.vips, { id: uid(), station, elevation, vcLength }] },
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

  setElements: (verticalId, elements) =>
    set((s) => ({
      verticals: s.verticals.map((v) =>
        v.id !== verticalId ? v : { ...v, elements },
      ),
    })),
}));
