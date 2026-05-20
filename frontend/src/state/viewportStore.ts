import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CameraPreset = "perspective" | "top" | "front" | "side";

interface ViewportState {
  showGrid: boolean;
  showAxes: boolean;
  wireframe: boolean;
  bgColor: string;
  ambientIntensity: number;
  dirIntensity: number;
  gridSize: number;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleWireframe: () => void;
  setBgColor: (color: string) => void;
  setAmbientIntensity: (v: number) => void;
  setDirIntensity: (v: number) => void;
  setGridSize: (n: number) => void;
  resetCamera: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
  _cameraResetCount: number;
  _cameraPreset: CameraPreset;
}

export const useViewportStore = create<ViewportState>()(
  persist(
    (set) => ({
      showGrid: true,
      showAxes: true,
      wireframe: false,
      bgColor: "#0b1020",
      ambientIntensity: 0.6,
      dirIntensity: 0.9,
      gridSize: 20,
      _cameraResetCount: 0,
      _cameraPreset: "perspective",
      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
      toggleWireframe: () => set((s) => ({ wireframe: !s.wireframe })),
      setBgColor: (color) => set({ bgColor: color }),
      setAmbientIntensity: (v) => set({ ambientIntensity: v }),
      setDirIntensity: (v) => set({ dirIntensity: v }),
      setGridSize: (n) => set({ gridSize: n }),
      resetCamera: () =>
        set((s) => ({
          _cameraResetCount: s._cameraResetCount + 1,
          _cameraPreset: "perspective",
        })),
      setCameraPreset: (preset) =>
        set((s) => ({
          _cameraResetCount: s._cameraResetCount + 1,
          _cameraPreset: preset,
        })),
    }),
    {
      name: "arcsphere-viewport",
      partialize: (s) => ({
        showGrid: s.showGrid,
        showAxes: s.showAxes,
        bgColor: s.bgColor,
        ambientIntensity: s.ambientIntensity,
        dirIntensity: s.dirIntensity,
        gridSize: s.gridSize,
      }),
    },
  ),
);
