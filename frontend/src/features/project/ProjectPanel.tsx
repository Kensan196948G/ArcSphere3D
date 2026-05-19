import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useProjectStore } from "@/state/projectStore";
import { useSceneStore } from "@/state/sceneStore";
import { loadFromUrl } from "@/features/viewport/loaders";
import {
  listMembers,
  addMember,
  removeMember,
  type ProjectMember,
} from "@/lib/api";

export default function ProjectPanel() {
  const token = useAuthStore((s) => s.token)!;
  const userId = useAuthStore((s) => s.userId);
  const { projects, selectedProjectId, files, loading, error } =
    useProjectStore();
  const {
    fetchProjects,
    selectProject,
    createProject,
    deleteProject,
    updateProject,
    uploadFile,
    deleteFile,
    getDownloadUrl,
  } = useProjectStore.getState();
  const addObject = useSceneStore((s) => s.addObject);
  const log = useSceneStore((s) => s.log);

  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Member management state
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"editor" | "viewer">("viewer");
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects(token);
  }, [token, fetchProjects]);

  useEffect(() => {
    setMembers([]);
    setMembersOpen(false);
    setMemberError(null);
  }, [selectedProjectId]);

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
    log(`[project] ${file.name} をアップロード中…`);
    const meta = await uploadFile(token, file);
    if (meta) log(`[project] ${meta.filename} のアップロード完了`);
    e.target.value = "";
  }

  async function handleOpen(fileId: string, filename: string) {
    const result = await getDownloadUrl(token, fileId);
    if (!result) return;
    log(`[project] S3 から ${filename} を読み込み中…`);
    try {
      const obj = await loadFromUrl(result.url, filename);
      const id = crypto.randomUUID();
      obj.name = filename;
      addObject({ id, name: filename, object: obj });
      log(`[project] ✓ ${filename} をシーンに追加`);
    } catch (err) {
      log(`[project] ✗ ${filename} の読み込みに失敗: ${String(err)}`);
    }
  }

  function startEditName(currentName: string) {
    setEditNameValue(currentName);
    setEditingName(true);
  }

  async function handleSaveName(projectId: string) {
    const trimmed = editNameValue.trim();
    if (trimmed) await updateProject(token, projectId, trimmed);
    setEditingName(false);
  }

  async function handleDeleteProject(projectId: string, projectName: string) {
    if (!window.confirm(`「${projectName}」を削除しますか？この操作は元に戻せません。`)) return;
    await deleteProject(token, projectId);
    log(`[project] プロジェクト「${projectName}」を削除`);
  }

  async function handleOpenMembers(projectId: string) {
    setMemberError(null);
    setMembersOpen((v) => !v);
    if (!membersOpen) {
      try {
        const data = await listMembers(token, projectId);
        setMembers(data);
      } catch (e) {
        setMemberError(String(e));
      }
    }
  }

  async function handleAddMember(projectId: string) {
    const uid = newMemberUserId.trim();
    if (!uid) return;
    setMemberError(null);
    try {
      const m = await addMember(token, projectId, uid, newMemberRole);
      setMembers((prev) => [...prev.filter((x) => x.user_id !== m.user_id), m]);
      setNewMemberUserId("");
    } catch (e) {
      setMemberError(String(e));
    }
  }

  async function handleRemoveMember(projectId: string, userId: string) {
    setMemberError(null);
    try {
      await removeMember(token, projectId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (e) {
      setMemberError(String(e));
    }
  }

  async function handleDelete(fileId: string, filename: string) {
    await deleteFile(token, fileId);
    log(`[project] ${filename} を削除`);
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* プロジェクト選択 */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          プロジェクト
        </label>
        <select
          value={selectedProjectId ?? ""}
          onChange={(e) => handleSelectProject(e.target.value)}
          className="w-full rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
        >
          <option value="" disabled>
            — プロジェクトを選択 —
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 選択中プロジェクトの操作（オーナーのみ） */}
      {selectedProjectId && (() => {
        const proj = projects.find((p) => p.id === selectedProjectId);
        const isOwner = proj && userId && proj.owner_id === userId;
        if (!isOwner) return null;
        return (
          <div className="flex flex-col gap-1">
            {editingName ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  aria-label="プロジェクト名を編集"
                  className="flex-1 rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName(proj.id);
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSaveName(proj.id)}
                  disabled={!editNameValue.trim()}
                  className="rounded bg-arc-accent/70 px-2 py-0.5 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startEditName(proj.name)}
                disabled={loading}
                aria-label={`${proj.name}を名前変更`}
                className="self-start rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                ✎ 名前を変更
              </button>
            )}
            {/* メンバー管理 */}
            <div>
              <button
                type="button"
                onClick={() => handleOpenMembers(proj.id)}
                aria-label="メンバー管理"
                className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                👥 メンバー管理
              </button>
              {membersOpen && (
                <div className="mt-1 rounded border border-slate-200 p-2 dark:border-slate-700">
                  {memberError && (
                    <p className="mb-1 text-rose-500 dark:text-rose-400">{memberError}</p>
                  )}
                  <ul className="mb-2 space-y-0.5">
                    {members.map((m) => (
                      <li key={m.user_id} className="flex items-center justify-between text-[11px]">
                        <span className="truncate text-slate-600 dark:text-slate-300" title={m.user_id}>
                          {m.user_id.slice(0, 8)}… ({m.role})
                        </span>
                        {m.user_id !== userId && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(proj.id, m.user_id)}
                            aria-label={`${m.user_id}を削除`}
                            className="ml-1 shrink-0 rounded px-1 py-0.5 text-rose-500 hover:bg-rose-400/20 dark:text-rose-400"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newMemberUserId}
                      onChange={(e) => setNewMemberUserId(e.target.value)}
                      placeholder="ユーザー ID"
                      aria-label="追加するユーザーID"
                      className="flex-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
                    />
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as "editor" | "viewer")}
                      aria-label="ロールを選択"
                      className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAddMember(proj.id)}
                      disabled={!newMemberUserId.trim()}
                      aria-label="メンバーを追加"
                      className="rounded bg-arc-accent/70 px-2 py-0.5 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleDeleteProject(proj.id, proj.name)}
              disabled={loading}
              title="プロジェクトを削除"
              aria-label={`${proj.name}を削除`}
              className="self-end rounded bg-rose-100 px-2 py-0.5 text-rose-600 hover:bg-rose-200 disabled:opacity-40 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50"
            >
              プロジェクトを削除
            </button>
          </div>
        );
      })()}

      {/* プロジェクト作成 */}
      <form onSubmit={handleCreateProject} className="flex gap-1">
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="新しいプロジェクト名"
          className="flex-1 rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
        />
        <button
          type="submit"
          disabled={creating || !newProjectName.trim()}
          className="rounded bg-arc-accent/70 px-2 py-1 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
        >
          +
        </button>
      </form>

      {error && <p className="text-rose-500 dark:text-rose-400">{error}</p>}

      {/* ファイル一覧 */}
      {selectedProjectId && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ファイル
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              アップロード
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
            <p className="text-slate-400 dark:text-slate-500">読み込み中…</p>
          )}

          {files.length === 0 && !loading ? (
            <p className="text-slate-400 dark:text-slate-500">
              ファイルなし — モデルをアップロードしてください。
            </p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded bg-slate-100/80 px-2 py-1 dark:bg-slate-800/60"
                >
                  <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                    {f.filename}
                  </span>
                  <div className="ml-2 flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpen(f.id, f.filename)}
                      className="rounded px-1.5 py-0.5 text-arc-accent hover:bg-arc-accent/20"
                      title="3D ビューアで開く"
                    >
                      3D
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id, f.filename)}
                      className="rounded px-1.5 py-0.5 text-rose-500 hover:bg-rose-400/20 dark:text-rose-400"
                      title="ファイルを削除"
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
