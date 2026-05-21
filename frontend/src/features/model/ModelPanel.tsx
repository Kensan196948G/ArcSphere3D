import { useSceneStore, type TransformMode } from "@/state/sceneStore";
import { useLayerStore } from "@/state/layerStore";
import { useViewportStore } from "@/state/viewportStore";
import FileLoader from "@/features/viewport/FileLoader";
import { useState } from "react";

const MODES: { id: TransformMode; label: string; hint: string }[] = [
  { id: "translate", label: "移動", hint: "W" },
  { id: "rotate", label: "回転", hint: "E" },
  { id: "scale", label: "拡縮", hint: "R" },
];

function Vec3Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (axis: "x" | "y" | "z", v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex gap-1">
        {(["x", "y", "z"] as const).map((ax) => (
          <label key={ax} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[9px] text-slate-400">
              {ax.toUpperCase()}
            </span>
            <input
              type="number"
              step="0.01"
              value={Number(value[ax].toFixed(3))}
              onChange={(e) => onChange(ax, Number(e.target.value))}
              className="w-full rounded bg-slate-100 px-1 py-0.5 text-center text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ModelPanel() {
  const objects = useSceneStore((s) => s.objects);
  const selectedId = useSceneStore((s) => s.selectedId);
  const select = useSceneStore((s) => s.select);
  const removeObject = useSceneStore((s) => s.removeObject);
  const clearScene = useSceneStore((s) => s.clearScene);
  const transformMode = useSceneStore((s) => s.transformMode);
  const setTransformMode = useSceneStore((s) => s.setTransformMode);
  const { renameObject, duplicateObject, setObjectVisibility, setObjectLayer } =
    useSceneStore.getState();
  const layers = useLayerStore((s) => s.layers);

  const selected = objects.find((o) => o.id === selectedId);
  const obj3d = selected?.object;

  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState("");

  function startRename() {
    if (!selected) return;
    setNameInput(selected.name);
    setRenaming(true);
  }

  function commitRename() {
    if (selected && nameInput.trim()) {
      renameObject(selected.id, nameInput.trim());
    }
    setRenaming(false);
  }

  function centerObject() {
    if (!obj3d) return;
    obj3d.position.set(0, 0, 0);
  }

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* ファイル読み込み */}
      <section>
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          モデル読み込み
        </h3>
        <FileLoader />
      </section>

      {/* 変形モード */}
      <section>
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          変形モード
        </h3>
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
                    ? "bg-arc-accent/80 text-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60")
                }
              >
                {m.label}
                <span className="ml-1 text-[10px] opacity-60">{m.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 選択オブジェクト操作 */}
      {selected && obj3d && (
        <section className="flex flex-col gap-2 rounded bg-slate-100/60 p-2 dark:bg-slate-800/40">
          {/* 名前 */}
          {renaming ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="flex-1 rounded bg-white px-2 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={commitRename}
                className="rounded bg-arc-accent/70 px-2 text-white dark:text-slate-900"
              >
                ✓
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                {selected.name}
              </span>
              <button
                type="button"
                onClick={startRename}
                className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                ✎ 名前変更
              </button>
            </div>
          )}

          {/* 座標 */}
          <Vec3Input
            label="位置"
            value={obj3d.position}
            onChange={(ax, v) => {
              obj3d.position[ax] = v;
            }}
          />
          <Vec3Input
            label="回転 (deg)"
            value={{
              x: (obj3d.rotation.x * 180) / Math.PI,
              y: (obj3d.rotation.y * 180) / Math.PI,
              z: (obj3d.rotation.z * 180) / Math.PI,
            }}
            onChange={(ax, v) => {
              obj3d.rotation[ax] = (v * Math.PI) / 180;
            }}
          />
          <Vec3Input
            label="拡縮"
            value={obj3d.scale}
            onChange={(ax, v) => {
              obj3d.scale[ax] = v;
            }}
          />

          {/* アクション */}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={centerObject}
              className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
            >
              中心へ
            </button>
            <button
              type="button"
              data-testid="focus-btn"
              onClick={() => useViewportStore.getState().focusObject()}
              className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
              title="選択オブジェクトにカメラをフォーカス (F)"
            >
              フォーカス
            </button>
            <button
              type="button"
              onClick={() => duplicateObject(selected.id)}
              className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
            >
              複製
            </button>
            <button
              type="button"
              onClick={() =>
                setObjectVisibility(selected.id, !selected.visible)
              }
              className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
            >
              {selected.visible ? "非表示" : "表示"}
            </button>
            <button
              type="button"
              onClick={() => removeObject(selected.id)}
              className="rounded bg-rose-500/20 px-2 py-0.5 text-rose-500 hover:bg-rose-500/30 dark:text-rose-400"
            >
              削除
            </button>
          </div>

          {/* レイヤー */}
          <div>
            <span className="mb-0.5 block text-[10px] text-slate-500">
              レイヤー
            </span>
            <select
              value={selected.layerId}
              onChange={(e) => setObjectLayer(selected.id, e.target.value)}
              className="w-full rounded bg-slate-100 px-2 py-0.5 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {/* シーンオブジェクト一覧 */}
      <section className="flex-1 overflow-auto">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            シーンオブジェクト
          </h3>
          {objects.length > 0 && (
            <button
              type="button"
              data-testid="scene-clear-btn"
              onClick={() => {
                if (confirm("シーン内の全オブジェクトを削除しますか？")) {
                  clearScene();
                }
              }}
              className="rounded px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
              title="シーンをクリア"
            >
              全削除
            </button>
          )}
        </div>
        {objects.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500">オブジェクトなし</p>
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
                      : "bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800")
                  }
                >
                  <button
                    type="button"
                    onClick={() => select(active ? null : o.id)}
                    className="flex-1 truncate text-left"
                  >
                    <span className="mr-1 text-slate-400">
                      {active ? "◉" : "▣"}
                    </span>
                    <span className={o.visible ? "" : "opacity-40"}>
                      {o.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setObjectVisibility(o.id, !o.visible)}
                    className="ml-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={o.visible ? "非表示" : "表示"}
                  >
                    {o.visible ? "👁" : "🙈"}
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
