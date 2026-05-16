import { useSceneStore } from "@/state/sceneStore";

export default function BottomConsole() {
  const logs = useSceneStore((s) => s.logs);
  return (
    <div className="h-full overflow-auto bg-black/40 p-2 font-mono text-xs text-slate-300">
      {logs.length === 0 ? (
        <p className="text-slate-500">
          [console] ArcSphere3D ready. Drag &amp; drop or load a model via the
          right panel.
        </p>
      ) : (
        logs.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap">
            {line}
          </div>
        ))
      )}
    </div>
  );
}
