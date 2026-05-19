import { useEffect, useState } from "react";
import { useAlignmentStore } from "@/state/alignmentStore";
import { useProjectStore } from "@/state/projectStore";
import { useAuthStore } from "@/state/authStore";
import { useAlignment } from "./useAlignment";
import VerticalAlignmentPanel from "./VerticalAlignmentPanel";

const DESIGN_SPEEDS = [20, 30, 40, 50, 60, 80, 100, 120] as const;

interface DetailProps {
  alignmentId: string;
  token: string;
  projectId: string;
}

function AlignmentDetail({ alignmentId, token, projectId }: DetailProps) {
  const store = useAlignmentStore();
  const alignment = useAlignment(alignmentId);
  const [ipX, setIpX] = useState("0");
  const [ipZ, setIpZ] = useState("0");
  const [ipR, setIpR] = useState("50");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSpeed, setEditSpeed] = useState("");

  if (!alignment) return null;

  const totalLength = alignment.elements.reduce((s, e) => s + e.length, 0);
  const curveCount = alignment.elements.filter(
    (e) => e.type === "curve",
  ).length;

  async function handleAddIp() {
    const x = Number(ipX);
    const z = Number(ipZ);
    const r = Number(ipR);
    if (isNaN(x) || isNaN(z) || isNaN(r) || r < 0) return;
    store.addIpPoint(alignmentId, x, z, r);
    await store.syncIpPoints(token, projectId, alignmentId);
    setIpX("0");
    setIpZ("0");
    setIpR("50");
  }

  async function handleRemoveIp(pointId: string) {
    store.removeIpPoint(alignmentId, pointId);
    await store.syncIpPoints(token, projectId, alignmentId);
  }

  function startEdit() {
    setEditName(alignment.name);
    setEditSpeed(String(alignment.designSpeed));
    setEditing(true);
  }

  async function handleSaveEdit() {
    const patch: { name?: string; designSpeed?: number } = {};
    const trimmed = editName.trim();
    if (trimmed && trimmed !== alignment.name) patch.name = trimmed;
    const speed = Number(editSpeed);
    if (!isNaN(speed) && speed !== alignment.designSpeed) patch.designSpeed = speed;
    if (Object.keys(patch).length > 0) {
      await store.updateAlignment(token, projectId, alignmentId, patch);
    }
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {editing ? (
        <div className="flex flex-col gap-1.5 rounded bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-900">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500 dark:text-slate-400">線形名</span>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              aria-label="線形名を編集"
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500 dark:text-slate-400">設計速度 (km/h)</span>
            <select
              value={editSpeed}
              onChange={(e) => setEditSpeed(e.target.value)}
              aria-label="設計速度を編集"
              className="rounded border border-slate-200 bg-white px-1 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {DESIGN_SPEEDS.map((s) => (
                <option key={s} value={s}>{s} km/h</option>
              ))}
            </select>
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="flex-1 rounded bg-arc-accent/20 px-2 py-1 text-arc-accent ring-1 ring-arc-accent/40 hover:bg-arc-accent/30"
              aria-label="線形情報を保存"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded px-2 py-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            {alignment.name}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              V={alignment.designSpeed} km/h
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="ml-1 rounded px-1 py-0.5 text-[10px] text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="線形情報を編集"
              title="線形名・設計速度を編集"
            >
              ✎
            </button>
          </div>
        </div>
      )}

      {/* IP point list */}
      {alignment.ipPoints.length > 0 && (
        <div className="rounded bg-slate-100 px-2 py-1.5 text-[10px] dark:bg-slate-800">
          <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">
            IP 点一覧
          </p>
          {alignment.ipPoints.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-0.5"
            >
              <span className="text-slate-500 dark:text-slate-400">
                IP{i + 1} ({p.x.toFixed(1)}, {p.z.toFixed(1)}) R={p.radius}m
              </span>
              <button
                type="button"
                onClick={() => handleRemoveIp(p.id)}
                className="ml-2 text-rose-400 hover:text-rose-600"
                aria-label={`IP${i + 1}を削除`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add IP point form */}
      <div className="rounded bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-900">
        <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">
          IP 点を追加
        </p>
        <div className="flex gap-1">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">X</span>
            <input
              type="number"
              value={ipX}
              onChange={(e) => setIpX(e.target.value)}
              className="w-16 rounded border border-slate-200 bg-white px-1 py-0.5 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="IP点X座標"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Z</span>
            <input
              type="number"
              value={ipZ}
              onChange={(e) => setIpZ(e.target.value)}
              className="w-16 rounded border border-slate-200 bg-white px-1 py-0.5 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="IP点Z座標"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">R (m)</span>
            <input
              type="number"
              min={0}
              value={ipR}
              onChange={(e) => setIpR(e.target.value)}
              className="w-16 rounded border border-slate-200 bg-white px-1 py-0.5 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="曲線半径"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleAddIp}
          className="mt-1.5 w-full rounded bg-arc-accent/20 px-2 py-1 text-[10px] font-medium text-arc-accent ring-1 ring-arc-accent/40 hover:bg-arc-accent/30"
        >
          IP 点を追加
        </button>
      </div>

      {/* Computed results */}
      {alignment.elements.length > 0 && (
        <div className="rounded bg-slate-100 px-2 py-2 text-[11px] dark:bg-slate-800">
          <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
            線形計算結果
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">総延長</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {totalLength.toFixed(2)} m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">曲線数</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {curveCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                エレメント数
              </span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {alignment.elements.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type AlignTab = "horizontal" | "vertical";

export default function AlignmentPanel() {
  const store = useAlignmentStore();
  const { selectedProjectId } = useProjectStore();
  const { token } = useAuthStore();
  const [newName, setNewName] = useState("");
  const [newSpeed, setNewSpeed] = useState<number>(60);
  const [tab, setTab] = useState<AlignTab>("horizontal");

  useEffect(() => {
    if (!token || !selectedProjectId) return;
    store.fetchAlignments(token, selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedProjectId]);

  async function handleCreate() {
    if (!token || !selectedProjectId) return;
    const name = newName.trim() || `線形 ${store.alignments.length + 1}`;
    await store.createAlignment(token, selectedProjectId, name, newSpeed);
    setNewName("");
  }

  async function handleRemove(id: string) {
    if (!token || !selectedProjectId) return;
    await store.removeAlignment(token, selectedProjectId, id);
  }

  const active = store.alignments.find((a) => a.id === store.activeId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* No project selected */}
      {!selectedProjectId && (
        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          プロジェクトを選択すると線形一覧が表示されます。
        </p>
      )}

      {selectedProjectId && (
        <>
          {/* Tab switcher */}
          <div className="flex rounded bg-slate-100 p-0.5 dark:bg-slate-800">
            {(["horizontal", "vertical"] as AlignTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded py-1 text-[11px] font-medium transition-colors ${
                  tab === t
                    ? "bg-white text-arc-accent shadow-sm dark:bg-slate-700 dark:text-arc-accent"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
                aria-label={
                  t === "horizontal" ? "平面線形タブ" : "縦断線形タブ"
                }
              >
                {t === "horizontal" ? "平面" : "縦断"}
              </button>
            ))}
          </div>

          {tab === "horizontal" && (
            <>
              {/* Create new alignment */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  新規線形を作成
                </p>
                <input
                  type="text"
                  placeholder="線形名"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  aria-label="線形名"
                />
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400">
                    設計速度
                  </label>
                  <select
                    value={newSpeed}
                    onChange={(e) => setNewSpeed(Number(e.target.value))}
                    className="flex-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    aria-label="設計速度"
                  >
                    {DESIGN_SPEEDS.map((v) => (
                      <option key={v} value={v}>
                        {v} km/h
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={store.loading}
                  className="w-full rounded bg-arc-accent/20 px-3 py-1.5 text-[11px] font-medium text-arc-accent ring-1 ring-arc-accent/40 transition-colors hover:bg-arc-accent/30 disabled:opacity-50"
                >
                  {store.loading ? "処理中…" : "線形を作成"}
                </button>
                {store.error && (
                  <p className="text-[10px] text-rose-500">{store.error}</p>
                )}
              </div>

              {/* Alignment list */}
              {store.alignments.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    線形一覧
                  </p>
                  {store.alignments.map((a) => (
                    <div key={a.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => store.setActive(a.id)}
                        className={`flex-1 rounded px-2 py-1 text-left text-[11px] transition-colors ${
                          store.activeId === a.id
                            ? "bg-arc-accent/20 font-semibold text-arc-accent ring-1 ring-arc-accent/40"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {a.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(a.id)}
                        className="shrink-0 rounded px-1.5 py-1 text-[10px] text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                        aria-label={`${a.name}を削除`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Active alignment detail */}
              {active && token && selectedProjectId && (
                <AlignmentDetail
                  alignmentId={active.id}
                  token={token}
                  projectId={selectedProjectId}
                />
              )}

              {store.alignments.length === 0 && !store.loading && (
                <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
                  設計速度を選択して線形を作成し、IP
                  点を追加することで平面線形を設計します。
                </p>
              )}
            </>
          )}

          {tab === "vertical" && (
            <VerticalAlignmentPanel
              alignmentId={active?.id ?? null}
              alignmentName={active?.name ?? ""}
            />
          )}
        </>
      )}
    </div>
  );
}
