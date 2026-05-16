import { useSceneStore, type TransformMode } from "@/state/sceneStore";
import { useAuthStore } from "@/state/authStore";
import FileLoader from "@/features/viewport/FileLoader";
import ProjectPanel from "@/features/project/ProjectPanel";

const MODES: { id: TransformMode; label: string; hint: string }[] = [
  { id: "translate", label: "Move", hint: "W" },
  { id: "rotate", label: "Rotate", hint: "E" },
  { id: "scale", label: "Scale", hint: "R" },
];

export default function RightPanel() {
  const token = useAuthStore((s) => s.token);
  const objects = useSceneStore((s) => s.objects);
  const removeObject = useSceneStore((s) => s.removeObject);
  const selectedId = useSceneStore((s) => s.selectedId);
  const select = useSceneStore((s) => s.select);
  const transformMode = useSceneStore((s) => s.transformMode);
  const setTransformMode = useSceneStore((s) => s.setTransformMode);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
      {token && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Projects
          </h2>
          <ProjectPanel />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Load Model
        </h2>
        <FileLoader />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Transform
        </h2>
        <div className="flex gap-1">
          {MODES.map((m) => {
            const active = transformMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setTransformMode(m.id)}
                className={
                  "flex-1 rounded px-2 py-1 text-xs transition " +
                  (active
                    ? "bg-arc-accent/80 text-slate-900"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60")
                }
              >
                {m.label}
                <span className="ml-1 text-[10px] opacity-60">{m.hint}</span>
              </button>
            );
          })}
        </div>
        {!selectedId && (
          <p className="mt-2 text-[11px] text-slate-500">
            Select an object below to enable the gizmo.
          </p>
        )}
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
            {objects.map((o) => {
              const active = selectedId === o.id;
              return (
                <li
                  key={o.id}
                  className={
                    "flex items-center justify-between rounded px-2 py-1 " +
                    (active
                      ? "bg-arc-accent/30 ring-1 ring-arc-accent/60"
                      : "bg-slate-800/60 hover:bg-slate-800")
                  }
                >
                  <button
                    type="button"
                    onClick={() => select(active ? null : o.id)}
                    className="flex-1 truncate text-left"
                  >
                    <span className="mr-2 text-slate-500">
                      {active ? "◉" : "▣"}
                    </span>
                    {o.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeObject(o.id)}
                    className="text-xs text-rose-300 hover:text-rose-200"
                    aria-label={`Remove ${o.name}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
