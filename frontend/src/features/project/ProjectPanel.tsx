import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useProjectStore } from "@/state/projectStore";
import { useSceneStore } from "@/state/sceneStore";
import { loadFromUrl } from "@/features/viewport/loaders";

export default function ProjectPanel() {
  const token = useAuthStore((s) => s.token)!;
  const { projects, selectedProjectId, files, loading, error } =
    useProjectStore();
  const { fetchProjects, selectProject, createProject, uploadFile, deleteFile, getDownloadUrl } =
    useProjectStore.getState();
  const addObject = useSceneStore((s) => s.addObject);
  const log = useSceneStore((s) => s.log);

  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects(token);
  }, [token, fetchProjects]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    await createProject(token, newProjectName.trim());
    setNewProjectName("");
    setCreating(false);
  }

  async function handleSelectProject(id: string) {
    await selectProject(token, id);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    log(`[project] uploading ${file.name}…`);
    const meta = await uploadFile(token, file);
    if (meta) log(`[project] uploaded ${meta.filename}`);
    e.target.value = "";
  }

  async function handleOpen(fileId: string, filename: string) {
    const result = await getDownloadUrl(token, fileId);
    if (!result) return;
    log(`[project] loading ${filename} from S3…`);
    try {
      const obj = await loadFromUrl(result.url, filename);
      const id = crypto.randomUUID();
      obj.name = filename;
      addObject({ id, name: filename, object: obj });
      log(`[project] ✓ ${filename} added to scene`);
    } catch (err) {
      log(`[project] ✗ failed to load ${filename}: ${String(err)}`);
    }
  }

  async function handleDelete(fileId: string, filename: string) {
    await deleteFile(token, fileId);
    log(`[project] deleted ${filename}`);
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Project selector */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Project
        </label>
        <select
          value={selectedProjectId ?? ""}
          onChange={(e) => handleSelectProject(e.target.value)}
          className="w-full rounded bg-slate-700 px-2 py-1 text-slate-200 outline-none focus:ring-1 focus:ring-arc-accent"
        >
          <option value="" disabled>
            — select project —
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Create project */}
      <form onSubmit={handleCreateProject} className="flex gap-1">
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="New project name"
          className="flex-1 rounded bg-slate-700 px-2 py-1 text-slate-200 outline-none focus:ring-1 focus:ring-arc-accent"
        />
        <button
          type="submit"
          disabled={creating || !newProjectName.trim()}
          className="rounded bg-arc-accent/70 px-2 py-1 text-slate-900 hover:bg-arc-accent disabled:opacity-40"
        >
          +
        </button>
      </form>

      {error && <p className="text-rose-400">{error}</p>}

      {/* File list */}
      {selectedProjectId && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Files
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded bg-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
            >
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl,.obj,.gltf,.glb,.ifc,.step"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          {loading && (
            <p className="text-slate-500">Loading…</p>
          )}

          {files.length === 0 && !loading ? (
            <p className="text-slate-500">No files yet — upload a model.</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1"
                >
                  <span className="flex-1 truncate text-slate-300">
                    {f.filename}
                  </span>
                  <div className="ml-2 flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpen(f.id, f.filename)}
                      className="rounded px-1.5 py-0.5 text-arc-accent hover:bg-arc-accent/20"
                      title="Open in 3D viewer"
                    >
                      3D
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id, f.filename)}
                      className="rounded px-1.5 py-0.5 text-rose-400 hover:bg-rose-400/20"
                      title="Delete file"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
