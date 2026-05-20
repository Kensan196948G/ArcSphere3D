import { useRef, useState } from "react";
import { useMeasureTool } from "@/features/measure/useMeasureTool";
import { useThreeScene } from "./useThreeScene";
import { useFileProcessor } from "./useFileProcessor";
import ViewportToolbar from "./ViewportToolbar";

export default function Viewport() {
  const ref = useRef<HTMLDivElement>(null);
  useThreeScene(ref);
  useMeasureTool();
  const { processFile } = useFileProcessor();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  return (
    <div
      className="relative h-full w-full"
      data-testid="viewport"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div
        ref={ref}
        className="absolute inset-0"
        data-testid="viewport-canvas"
      />

      {/* Drag-and-drop overlay */}
      {isDragOver && (
        <div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded border-2 border-dashed border-arc-accent bg-black/40"
          data-testid="drag-overlay"
        >
          <span className="text-lg font-semibold text-arc-accent">
            ファイルをドロップして読み込む
          </span>
        </div>
      )}

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
