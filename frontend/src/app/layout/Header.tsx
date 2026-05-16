import { useSceneStore } from "@/state/sceneStore";

export default function Header() {
  const objectCount = useSceneStore((s) => s.objects.length);
  return (
    <div className="flex h-full items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold tracking-wide text-arc-accent">
          ⌬ ArcSphere3D
        </span>
        <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs uppercase text-slate-300">
          MVP
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>Objects: {objectCount}</span>
        <span className="text-slate-500">v0.1.0</span>
      </div>
    </div>
  );
}
