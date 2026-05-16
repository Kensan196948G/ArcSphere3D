import { useSceneStore } from "@/state/sceneStore";
import FileLoader from "@/features/viewport/FileLoader";

export default function RightPanel() {
  const objects = useSceneStore((s) => s.objects);
  const removeObject = useSceneStore((s) => s.removeObject);

  return (
    <div className="flex h-full flex-col gap-4 p-3 text-sm">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Load Model
        </h2>
        <FileLoader />
      </section>

      <section className="flex-1 overflow-auto">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Scene Objects
        </h2>
        {objects.length === 0 ? (
          <p className="text-xs text-slate-500">
            No objects yet — load a model or use the default cube.
          </p>
        ) : (
          <ul className="space-y-1">
            {objects.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1"
              >
                <span className="truncate">
                  <span className="mr-2 text-slate-500">▣</span>
                  {o.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeObject(o.id)}
                  className="text-xs text-rose-300 hover:text-rose-200"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
