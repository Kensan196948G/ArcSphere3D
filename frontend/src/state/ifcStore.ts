import { create } from "zustand";

export interface IFCModel {
  modelId: number;
  sceneObjectId: string;
  filename: string;
}

export interface IFCSpatialNode {
  expressID: number;
  type: string;
  Name?: { value: string } | null;
  children: IFCSpatialNode[];
}

export interface IFCProperty {
  name: string;
  value: string | number | boolean | null;
}

export interface IFCPropertySet {
  name: string;
  properties: IFCProperty[];
}

interface IFCState {
  models: IFCModel[];
  activeModelId: number | null;
  selectedExpressId: number | null;
  spatialTree: IFCSpatialNode | null;
  propertySets: IFCPropertySet[];
  itemProperties: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;

  addModel: (model: IFCModel) => void;
  removeModel: (sceneObjectId: string) => void;
  setActiveModel: (modelId: number | null) => void;
  selectElement: (expressId: number | null) => void;
  setSpatialTree: (tree: IFCSpatialNode | null) => void;
  setPropertySets: (sets: IFCPropertySet[]) => void;
  setItemProperties: (props: Record<string, unknown> | null) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initialState = {
  models: [] as IFCModel[],
  activeModelId: null as number | null,
  selectedExpressId: null as number | null,
  spatialTree: null as IFCSpatialNode | null,
  propertySets: [] as IFCPropertySet[],
  itemProperties: null as Record<string, unknown> | null,
  loading: false,
  error: null as string | null,
};

export const useIfcStore = create<IFCState>((set) => ({
  ...initialState,

  addModel: (model) =>
    set((s) => ({
      models: [...s.models, model],
      activeModelId: model.modelId,
    })),

  removeModel: (sceneObjectId) =>
    set((s) => {
      const remaining = s.models.filter(
        (m) => m.sceneObjectId !== sceneObjectId,
      );
      return {
        models: remaining,
        activeModelId:
          remaining.length > 0 ? remaining[remaining.length - 1].modelId : null,
        selectedExpressId: null,
        spatialTree: null,
        propertySets: [],
        itemProperties: null,
      };
    }),

  setActiveModel: (modelId) => set({ activeModelId: modelId }),

  selectElement: (expressId) =>
    set({
      selectedExpressId: expressId,
      propertySets: [],
      itemProperties: null,
    }),

  setSpatialTree: (tree) => set({ spatialTree: tree }),

  setPropertySets: (sets) => set({ propertySets: sets }),

  setItemProperties: (props) => set({ itemProperties: props }),

  setLoading: (v) => set({ loading: v }),

  setError: (msg) => set({ error: msg }),

  reset: () => set(initialState),
}));
