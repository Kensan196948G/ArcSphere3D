import { load } from "@loaders.gl/core";
import { LASLoader } from "@loaders.gl/las";

export interface WorkerRequest {
  id: string;
  buffer: ArrayBuffer;
  filename: string;
}

export interface WorkerResult {
  id: string;
  positions: Float32Array;
  intensities: Float32Array;
  colors: Uint8Array | null;
  pointCount: number;
  name: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, buffer, filename } = e.data;
  try {
    const data = await load(buffer, LASLoader, {
      las: { skip: 1 },
    });

    const attrs = data.attributes;
    const rawPositions = attrs.POSITION?.value as Float32Array | undefined;
    const rawIntensities = attrs.intensity?.value as Uint16Array | undefined;
    const rawColors = attrs.COLOR_0?.value as Uint8Array | undefined;

    if (!rawPositions) {
      throw new Error("LAS ファイルに位置データがありません");
    }

    const pointCount = rawPositions.length / 3;
    const positions = new Float32Array(rawPositions.buffer.slice(0));
    const intensities = new Float32Array(pointCount);

    if (rawIntensities) {
      for (let i = 0; i < pointCount; i++) {
        intensities[i] = rawIntensities[i] / 65535;
      }
    }

    const colors = rawColors ? new Uint8Array(rawColors.buffer.slice(0)) : null;

    const result: WorkerResult = {
      id,
      positions,
      intensities,
      colors,
      pointCount,
      name: filename,
    };

    const transferables: Transferable[] = [
      positions.buffer,
      intensities.buffer,
    ];
    if (colors) transferables.push(colors.buffer);

    self.postMessage(result, { transfer: transferables });
  } catch (err) {
    const result: WorkerResult = {
      id,
      positions: new Float32Array(0),
      intensities: new Float32Array(0),
      colors: null,
      pointCount: 0,
      name: filename,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(result);
  }
};
