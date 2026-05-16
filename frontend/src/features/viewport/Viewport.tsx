import { useRef } from "react";
import { useMeasureTool } from "@/features/measure/useMeasureTool";
import { useThreeScene } from "./useThreeScene";
import ViewportToolbar from "./ViewportToolbar";

export default function Viewport() {
  const ref = useRef<HTMLDivElement>(null);
  useThreeScene(ref);
  useMeasureTool();

  return (
    <div className="relative h-full w-full">
      <div
        ref={ref}
        className="absolute inset-0"
        data-testid="viewport-canvas"
      />

      {/* 左上: ブランドバッジ */}
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/40 px-2 py-1 text-xs text-slate-300">
        <span className="text-arc-accent">●</span> Three.js Viewport
      </div>

      {/* 下部中央: ビューポートツールバー */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
        <ViewportToolbar />
      </div>
    </div>
  );
}
