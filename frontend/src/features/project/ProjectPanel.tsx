import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useProjectStore } from "@/state/projectStore";
import { useSceneStore } from "@/state/sceneStore";
import { loadFromUrl } from "@/features/viewport/loaders";
import MultipartUploader from "@/features/viewport/MultipartUploader";
import { exportProjectZip, getProjectStats, renameFile, type ProjectStats } from "@/lib/api";
import { notifyError, notifySuccess } from "@/state/notificationStore";

const FILE_ICONS: Record<string, string> = {
  stl: "🔷",
  obj: "🟦",
  gltf: "🟩",
  glb: "🟩",
  ifc: "🏗️",
  step: "⚙️",
  stp: "⚙️",
  iges: "⚙️",
  igs: "⚙️",
  las: "☁️",
  laz: "☁️",
};

function fileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? "📄";
}

export default function ProjectPanel() {
  const token = useAuthStore((s) => s.token)!;
  const { projects, selectedProjectId, files, activity, loading, error } =
    useProjectStore();
  const {
    fetchProjects,
    selectProject,
    createProject,
    renameProject,
    deleteProject,
    uploadFile,
    deleteFile,
    getDownloadUrl,
    fetchActivity,
  } = useProjectStore.getState();
  const addObject = useSceneStore((s) => s.addObject);
  const log = useSceneStore((s) => s.log);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"files" | "activity">("files");
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renameDescInput, setRenameDescInput] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameFileInput, setRenameFileInput] = useState("");
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [fileExtFilter, setFileExtFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { fetchFiles } = useProjectStore.getState();

  const handleFileSearchChange = useCallback(
    (search: string, ext: string) => {
      if (fileSearchTimerRef.current) clearTimeout(fileSearchTimerRef.current);
      fileSearchTimerRef.current = setTimeout(() => {
        void fetchFiles(token, search.trim() || undefined, ext || undefined);
      }, 300);
    },
    [token, fetchFiles],
  );

  const handleProjectSearchChange = useCallback(
    (value: string) => {
      setProjectSearch(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        void fetchProjects(token, value.trim() || undefined);
      }, 300);
    },
    [token, fetchProjects],
  );

  useEffect(() => {
    fetchProjects(token);
  }, [token, fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (activeTab === "activity") {
      void fetchActivity(token);
    }
  }, [token, selectedProjectId, activeTab, fetchActivity]);

  useEffect(() => {
    if (!selectedProjectId) {
      setStats(null);
      return;
    }
    const controller = new AbortController();
    getProjectStats(token, selectedProjectId)
      .then((s) => {
        if (!controller.signal.aborted) setStats(s);
      })
      .catch(() => {
        /* stats are non-critical — ignore errors */
      });
    return () => controller.abort();
  }, [token, selectedProjectId]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    await createProject(token, newProjectName.trim(), newProjectDesc.trim() || undefined);
    const { error: storeErr } = useProjectStore.getState();
    if (storeErr) {
      notifyError(storeErr);
    } else {
      notifySuccess(`プロジェクト「${newProjectName.trim()}」を作成しました`);
      setNewProjectName("");
      setNewProjectDesc("");
    }
    setCreating(false);
  }

  async function handleSelectProject(id: string) {
    setFileSearch("");
    setFileExtFilter("");
    setActiveTab("files");
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

  async function handleDelete(fileId: string, filename: string) {
    await deleteFile(token, fileId);
    log(`[project] ${filename} を削除`);
  }

  async function handleDownload(fileId: string, filename: string) {
    const result = await getDownloadUrl(token, fileId);
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = filename;
    a.click();
  }

  async function handleExportZip() {
    if (!selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    const name = project?.name ?? "project";
    setExporting(true);
    try {
      await exportProjectZip(token, selectedProjectId, name);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function handleRenameProject(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !renameInput.trim()) return;
    await renameProject(token, selectedProjectId, renameInput.trim(), renameDescInput || null);
    const { error: storeErr } = useProjectStore.getState();
    if (storeErr) {
      notifyError(storeErr);
    } else {
      notifySuccess("プロジェクト名を変更しました");
      setRenaming(false);
      setRenameInput("");
      setRenameDescInput("");
      log(`[project] プロジェクト名を変更しました`);
    }
  }

  async function handleDeleteProject() {
    if (!selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (
      !confirm(
        `プロジェクト「${project?.name ?? selectedProjectId}」を削除しますか？この操作は取り消せません。`,
      )
    )
      return;
    const name = project?.name ?? selectedProjectId;
    await deleteProject(token, selectedProjectId);
    const { error: storeErr } = useProjectStore.getState();
    if (storeErr) {
      notifyError(storeErr);
    } else {
      notifySuccess(`プロジェクト「${name}」を削除しました`);
      log(`[project] プロジェクトを削除しました`);
    }
  }

  function startRenameFile(fileId: string, currentName: string) {
    setRenamingFileId(fileId);
    setRenameFileInput(currentName);
  }

  function cancelRenameFile() {
    setRenamingFileId(null);
    setRenameFileInput("");
  }

  async function handleRenameFile(fileId: string) {
    const newName = renameFileInput.trim();
    if (!newName) return;
    try {
      await renameFile(token, fileId, newName);
      notifySuccess("ファイル名を変更しました");
      setRenamingFileId(null);
      setRenameFileInput("");
      if (selectedProjectId) {
        await useProjectStore
          .getState()
          .selectProject(token, selectedProjectId);
      }
    } catch (e) {
      notifyError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* プロジェクト選択 */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          プロジェクト
        </label>
        <input
          type="search"
          placeholder="🔍 プロジェクトを検索…"
          value={projectSearch}
          onChange={(e) => handleProjectSearchChange(e.target.value)}
          data-testid="project-search-input"
          className="mb-1 w-full rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
        />
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
        {selectedProjectId && stats && (
          <div
            className="mt-1 flex gap-2 rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            data-testid="project-stats"
          >
            <span title="ファイル数">📄 {stats.file_count}</span>
            <span title="線形数">📐 {stats.alignment_count}</span>
            <span title="縦断数">📏 {stats.vertical_count}</span>
            <span title="メンバー数">👥 {stats.member_count}</span>
          </div>
        )}
        {selectedProjectId && (() => {
          const p = projects.find((x) => x.id === selectedProjectId);
          return p?.description ? (
            <p className="mt-1 text-[10px] italic text-slate-400 dark:text-slate-500">
              {p.description}
            </p>
          ) : null;
        })()}
        {selectedProjectId && !renaming && (
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              onClick={() => {
                const p = projects.find((x) => x.id === selectedProjectId);
                setRenameInput(p?.name ?? "");
                setRenameDescInput(p?.description ?? "");
                setRenaming(true);
              }}
              data-testid="project-rename-btn"
              className="flex-1 rounded border border-slate-300 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              ✏️ 名前を変更
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteProject()}
              data-testid="project-delete-btn"
              className="flex-1 rounded border border-red-300 py-0.5 text-[10px] text-red-400 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              🗑 削除
            </button>
          </div>
        )}
        {selectedProjectId && renaming && (
          <form
            onSubmit={(e) => void handleRenameProject(e)}
            className="mt-1 flex flex-col gap-1"
          >
            <div className="flex gap-1">
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                autoFocus
                data-testid="project-rename-input"
                className="flex-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
              />
              <button
                type="submit"
                disabled={!renameInput.trim()}
                data-testid="project-rename-save"
                className="rounded bg-arc-accent/70 px-2 py-0.5 text-[10px] text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 dark:border-slate-600"
              >
                取消
              </button>
            </div>
            <input
              type="text"
              value={renameDescInput}
              onChange={(e) => setRenameDescInput(e.target.value)}
              placeholder="説明（任意）"
              maxLength={500}
              className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-400"
            />
          </form>
        )}
      </div>

      {/* プロジェクト作成 */}
      <form onSubmit={handleCreateProject} className="flex flex-col gap-1">
        <div className="flex gap-1">
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
        </div>
        <input
          type="text"
          value={newProjectDesc}
          onChange={(e) => setNewProjectDesc(e.target.value)}
          placeholder="説明（任意）"
          maxLength={500}
          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-400"
        />
      </form>

      {error && <p className="text-rose-500 dark:text-rose-400">{error}</p>}

      {/* タブ切り替え */}
      {selectedProjectId && (
        <div className="flex gap-0.5 rounded bg-slate-100 p-0.5 dark:bg-slate-800" data-testid="project-tabs">
          {(["files", "activity"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              data-testid={`project-tab-${tab}`}
              className={`flex-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                activeTab === tab
                  ? "bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {tab === "files" ? "ファイル" : "アクティビティ"}
            </button>
          ))}
        </div>
      )}

      {/* ファイル一覧 */}
      {selectedProjectId && activeTab === "files" && (
        <div>
          <div className="mb-1 flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ファイル
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => void handleExportZip()}
                disabled={exporting || files.length === 0}
                data-testid="project-export-btn"
                className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                title="全ファイルをZIPでダウンロード"
              >
                {exporting ? "…" : "⬇ ZIP"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                アップロード
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl,.obj,.gltf,.glb,.ifc,.step"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          {/* 大容量ファイル用マルチパートアップローダー */}
          <MultipartUploader
            projectId={selectedProjectId}
            onComplete={() => {
              void useProjectStore.getState().selectProject(token, selectedProjectId);
            }}
          />

          {loading && (
            <p className="text-slate-400 dark:text-slate-500">読み込み中…</p>
          )}

          <div className="mb-1 flex gap-1">
            <input
              type="search"
              placeholder="🔍 ファイルを検索…"
              value={fileSearch}
              onChange={(e) => {
                setFileSearch(e.target.value);
                handleFileSearchChange(e.target.value, fileExtFilter);
              }}
              data-testid="file-filter-input"
              className="min-w-0 flex-1 rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
            />
            <select
              value={fileExtFilter}
              onChange={(e) => {
                setFileExtFilter(e.target.value);
                handleFileSearchChange(fileSearch, e.target.value);
              }}
              data-testid="file-ext-filter-select"
              className="rounded bg-slate-100 px-1 py-1 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="">全形式</option>
              {Object.keys(FILE_ICONS).map((ext) => (
                <option key={ext} value={ext}>
                  {ext.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {files.length === 0 && !loading ? (
            <p className="text-slate-400 dark:text-slate-500">
              ファイルなし — モデルをアップロードしてください。
            </p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => {
                const isRenaming = renamingFileId === f.id;
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded bg-slate-100/80 px-2 py-1 dark:bg-slate-800/60"
                  >
                    {isRenaming ? (
                      <input
                        type="text"
                        value={renameFileInput}
                        onChange={(e) => setRenameFileInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (e.nativeEvent.isComposing) return;
                            e.preventDefault();
                            void handleRenameFile(f.id);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRenameFile();
                          }
                        }}
                        autoFocus
                        data-testid={`file-rename-input-${f.id}`}
                        className="flex-1 rounded bg-slate-100 px-2 py-0.5 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
                      />
                    ) : (
                      <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                        <span className="shrink-0 text-sm" title={f.filename.split(".").pop()?.toUpperCase()}>
                          {fileIcon(f.filename)}
                        </span>
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate text-slate-600 dark:text-slate-300">
                            {f.filename}
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">
                            {f.size_bytes < 1024
                              ? `${f.size_bytes} B`
                              : f.size_bytes < 1024 * 1024
                                ? `${(f.size_bytes / 1024).toFixed(1)} KB`
                                : `${(f.size_bytes / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="ml-2 flex shrink-0 gap-1">
                      {isRenaming ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleRenameFile(f.id)}
                            disabled={!renameFileInput.trim()}
                            data-testid={`file-rename-save-${f.id}`}
                            className="rounded bg-arc-accent/70 px-1.5 py-0.5 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
                            title="ファイル名を保存"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={cancelRenameFile}
                            data-testid={`file-rename-cancel-${f.id}`}
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                            title="キャンセル"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
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
                            onClick={() => void handleDownload(f.id, f.filename)}
                            data-testid={`file-download-btn-${f.id}`}
                            className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                            title="ファイルをダウンロード"
                          >
                            ⬇
                          </button>
                          <button
                            type="button"
                            onClick={() => startRenameFile(f.id, f.filename)}
                            data-testid={`file-rename-btn-${f.id}`}
                            className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                            title="ファイル名を変更"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(f.id, f.filename)}
                            className="rounded px-1.5 py-0.5 text-rose-500 hover:bg-rose-400/20 dark:text-rose-400"
                            title="ファイルを削除"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* アクティビティフィード */}
      {selectedProjectId && activeTab === "activity" && (
        <div data-testid="activity-feed">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            最近のアクティビティ
          </span>
          {loading && (
            <p className="text-slate-400 dark:text-slate-500">読み込み中…</p>
          )}
          {!loading && activity.length === 0 && (
            <p className="text-slate-400 dark:text-slate-500">アクティビティはありません。</p>
          )}
          <ul className="space-y-1">
            {activity.map((ev) => (
              <li
                key={ev.id}
                className="rounded bg-slate-100/80 px-2 py-1 dark:bg-slate-800/60"
                data-testid="activity-item"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                    {ev.action}
                  </span>
                  <span className="shrink-0 text-[9px] text-slate-400 dark:text-slate-500">
                    {new Date(ev.created_at).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {ev.actor_email && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">
                    {ev.actor_email}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
