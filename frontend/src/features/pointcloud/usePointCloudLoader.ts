import { useCallback, useEffect, useRef } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
} from "three";
import { getActiveScene } from "@/lib/threeContext";
import { usePointCloudStore, type ColorMode } from "@/state/pointcloudStore";
import type { WorkerResult } from "./pointcloudWorker";

const MAX_POINTS = 5_000_000;

const pointsMapRef: Map<string, Points> = new Map();

function buildMaterial(colorMode: ColorMode, pointSize: number): PointsMaterial {
  return new PointsMaterial({
    size: pointSize,
    sizeAttenuation: true,
    vertexColors: colorMode !== "uniform",
  });
}

function applyHeightColoring(positions: Float32Array, pointCount: number): Float32Array {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] < minY) minY = positions[i];
    if (positions[i] > maxY) maxY = positions[i];
  }
  const range = maxY - minY || 1;
  const colors = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    const t = (positions[i * 3 + 1] - minY) / range;
    // cool → warm: blue(0,0,1) → cyan → green → yellow → red(1,0,0)
    colors[i * 3] = Math.min(1, t * 2);
    colors[i * 3 + 1] = Math.min(1, t < 0.5 ? t * 2 : (1 - t) * 2);
    colors[i * 3 + 2] = Math.max(0, 1 - t * 2);
  }
  return colors;
}

export function usePointCloudLoader() {
  const workerRef = useRef<Worker | null>(null);
  const { pointSize, colorMode, setLoading, setError, addModel } =
    usePointCloudStore();
  const colorModeRef = useRef(colorMode);
  const pointSizeRef = useRef(pointSize);

  useEffect(() => {
    colorModeRef.current = colorMode;
    pointSizeRef.current = pointSize;
    // Update existing point cloud materials
    pointsMapRef.forEach((points) => {
      const mat = points.material as PointsMaterial;
      mat.size = pointSize;
      mat.vertexColors = colorMode !== "uniform";
      mat.needsUpdate = true;
    });
  }, [colorMode, pointSize]);

  useEffect(() => {
    const worker = new Worker(
      new URL("./pointcloudWorker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      const { id, positions, intensities, colors, pointCount, name, error } = e.data;
      setLoading(false);

      if (error) {
        setError(error);
        return;
      }

      const scene = getActiveScene();
      if (!scene) {
        setError("シーンが初期化されていません");
        return;
      }

      // Subsample if too large
      const stride = Math.ceil(pointCount / MAX_POINTS);
      const sampledCount = Math.ceil(pointCount / stride);
      const sampledPositions = new Float32Array(sampledCount * 3);
      for (let i = 0; i < sampledCount; i++) {
        sampledPositions[i * 3] = positions[i * stride * 3];
        sampledPositions[i * 3 + 1] = positions[i * stride * 3 + 1];
        sampledPositions[i * 3 + 2] = positions[i * stride * 3 + 2];
      }

      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(sampledPositions, 3));

      const currentMode = colorModeRef.current;
      if (currentMode === "height") {
        const c = applyHeightColoring(sampledPositions, sampledCount);
        geom.setAttribute("color", new Float32BufferAttribute(c, 3));
      } else if (currentMode === "intensity") {
        const c = new Float32Array(sampledCount * 3);
        for (let i = 0; i < sampledCount; i++) {
          const v = intensities[i * stride];
          c[i * 3] = v;
          c[i * 3 + 1] = v;
          c[i * 3 + 2] = v;
        }
        geom.setAttribute("color", new Float32BufferAttribute(c, 3));
      } else if (currentMode === "rgb" && colors) {
        const c = new Float32Array(sampledCount * 3);
        for (let i = 0; i < sampledCount; i++) {
          c[i * 3] = colors[i * stride * 4] / 255;
          c[i * 3 + 1] = colors[i * stride * 4 + 1] / 255;
          c[i * 3 + 2] = colors[i * stride * 4 + 2] / 255;
        }
        geom.setAttribute("color", new Float32BufferAttribute(c, 3));
      }

      const mat = buildMaterial(currentMode, pointSizeRef.current);
      const points = new Points(geom, mat);
      points.name = `pointcloud-${id}`;
      scene.add(points);
      pointsMapRef.set(id, points);

      addModel({ id, name, pointCount: sampledCount, visible: true });
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, [addModel, setError, setLoading]);

  const loadFile = useCallback(
    (file: File) => {
      if (!workerRef.current) return;
      setLoading(true);
      setError(null);
      const id = crypto.randomUUID();
      file.arrayBuffer().then((buffer) => {
        workerRef.current!.postMessage({ id, buffer, filename: file.name }, [buffer]);
      });
    },
    [setLoading, setError],
  );

  const removeFromScene = useCallback((id: string) => {
    const scene = getActiveScene();
    const points = pointsMapRef.get(id);
    if (points && scene) {
      scene.remove(points);
      points.geometry.dispose();
      (points.material as PointsMaterial).dispose();
      pointsMapRef.delete(id);
    }
    usePointCloudStore.getState().removeModel(id);
  }, []);

  return { loadFile, removeFromScene };
}
