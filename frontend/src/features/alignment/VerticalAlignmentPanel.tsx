import { useEffect, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useProjectStore } from "@/state/projectStore";
import { useVerticalStore } from "@/state/verticalStore";
import { useVertical } from "./useVertical";

interface DetailProps {
  verticalId: string;
  token: string;
  projectId: string;
  alignmentId: string;
}

function VerticalDetail({
  verticalId,
  token,
  projectId,
  alignmentId,
}: DetailProps) {
  const store = useVerticalStore();
  const vertical = useVertical(verticalId);
  const [sta, setSta] = useState("0");
  const [elev, setElev] = useState("0");
  const [vcLen, setVcLen] = useState("0");

  if (!vertical) return null;

  async function handleAddVip() {
    const s = Number(sta);
    const e = Number(elev);
    const l = Number(vcLen);
    if (isNaN(s) || isNaN(e) || isNaN(l) || l < 0) return;
    store.addVip(verticalId, s, e, l);
    setSta("0");
    setElev("0");
    setVcLen("0");
    await store.syncVips(token, projectId, alignmentId, verticalId);
  }

  async function handleRemoveVip(vipId: string) {
    store.removeVip(verticalId, vipId);
    await store.syncVips(token, projectId, alignmentId, verticalId);
  }

  const gradeElements = vertical.elements.filter((el) => el.type === "grade");
  const curveElements = vertical.elements.filter((el) => el.type === "vcurve");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {vertical.name}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          縦断線形
        </span>
      </div>

      {/* VIP list */}
      {vertical.vips.length > 0 && (
        <div className="rounded bg-slate-100 px-2 py-1.5 text-[10px] dark:bg-slate-800">
          <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">
            VIP 一覧
          </p>
          {[...vertical.vips]
            .sort((a, b) => a.station - b.station)
            .map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-0.5"
              >
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  VIP{i + 1} STA={p.station.toFixed(1)} EL=
                  {p.elevation.toFixed(2)} L=
                  {p.vcLength.toFixed(0)}m
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveVip(p.id)}
                  className="ml-2 text-rose-400 hover:text-rose-600"
                  aria-label={`VIP${i + 1}を削除`}
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Add VIP form */}
      <div className="rounded bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-900">
        <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">
          VIP を追加
        </p>
        <div className="grid grid-cols-3 gap-1">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">測点 (m)</span>
            <input
              type="number"
              value={sta}
              onChange={(e) => setSta(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="測点距離"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">標高 (m)</span>
            <input
              type="number"
              value={elev}
              onChange={(e) => setElev(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="標高"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">縦曲線長 L</span>
            <input
              type="number"
              min={0}
              value={vcLen}
              onChange={(e) => setVcLen(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="縦曲線長"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleAddVip}
          className="mt-1.5 w-full rounded bg-arc-accent/20 px-2 py-1 text-[10px] font-medium text-arc-accent ring-1 ring-arc-accent/40 hover:bg-arc-accent/30"
        >
          VIP を追加
        </button>
      </div>

      {/* Computed elements */}
      {vertical.elements.length > 0 && (
        <div className="rounded bg-slate-100 px-2 py-2 text-[10px] dark:bg-slate-800">
          <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
            縦断計算結果
          </p>
          <div className="mb-1.5 flex gap-4 text-slate-500 dark:text-slate-400">
            <span>勾配区間: {gradeElements.length}</span>
            <span>縦曲線: {curveElements.length}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {vertical.elements.map((el, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded px-1.5 py-0.5 ${
                  el.type === "vcurve"
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "bg-white dark:bg-slate-900"
                }`}
              >
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {el.type === "grade" ? "勾配" : "縦曲線"} STA=
                  {el.startStation.toFixed(0)}〜{el.endStation.toFixed(0)}
                </span>
                <span className="ml-2 font-mono text-slate-500 dark:text-slate-400">
                  {el.type === "grade" && el.grade !== undefined
                    ? `${el.grade.toFixed(2)}%`
                    : el.kValue !== undefined
                      ? `K=${el.kValue.toFixed(1)}`
                      : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {vertical.vips.length > 0 && vertical.vips.length < 2 && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          VIP を 2 点以上追加すると縦断線形を計算します。
        </p>
      )}
    </div>
  );
}

interface Props {
  alignmentId: string | null;
  alignmentName: string;
}

export default function VerticalAlignmentPanel({
  alignmentId,
  alignmentName,
}: Props) {
  const store = useVerticalStore();
  const { token } = useAuthStore();
  const { selectedProjectId } = useProjectStore();
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!token || !selectedProjectId || !alignmentId) return;
    store.fetchVerticals(token, selectedProjectId, alignmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedProjectId, alignmentId]);

  const linked = alignmentId
    ? store.verticals.filter((v) => v.alignmentId === alignmentId)
    : [];

  const activeVertical =
    linked.find((v) => v.id === store.activeId) ?? linked[0] ?? null;

  async function handleCreate() {
    if (!alignmentId || !token || !selectedProjectId) return;
    const name = newName.trim() || `縦断 ${linked.length + 1}`;
    await store.createVertical(token, selectedProjectId, alignmentId, name);
    setNewName("");
  }

  async function handleRemove(id: string) {
    if (!token || !selectedProjectId || !alignmentId) return;
    await store.removeVertical(token, selectedProjectId, alignmentId, id);
  }

  if (!alignmentId) {
    return (
      <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        平面線形を選択してから縦断線形を作成します。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        対象路線:{" "}
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {alignmentName}
        </span>
      </p>

      {/* Create vertical alignment */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          縦断線形を追加
        </p>
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="縦断名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label="縦断線形名"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded bg-arc-accent/20 px-3 py-1 text-[11px] font-medium text-arc-accent ring-1 ring-arc-accent/40 hover:bg-arc-accent/30"
          >
            作成
          </button>
        </div>
      </div>

      {/* Vertical list */}
      {linked.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            縦断線形一覧
          </p>
          {linked.map((v) => (
            <div key={v.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => store.setActive(v.id)}
                className={`flex-1 rounded px-2 py-1 text-left text-[11px] transition-colors ${
                  store.activeId === v.id
                    ? "bg-arc-accent/20 font-semibold text-arc-accent ring-1 ring-arc-accent/40"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => handleRemove(v.id)}
                className="shrink-0 rounded px-1.5 py-1 text-[10px] text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                aria-label={`${v.name}を削除`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active vertical detail */}
      {activeVertical && token && selectedProjectId && alignmentId && (
        <VerticalDetail
          verticalId={activeVertical.id}
          token={token}
          projectId={selectedProjectId}
          alignmentId={alignmentId}
        />
      )}

      {linked.length === 0 && (
        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          VIP（縦断交点）の測点・標高・縦曲線長を入力して縦断線形を設計します。
        </p>
      )}
    </div>
  );
}
