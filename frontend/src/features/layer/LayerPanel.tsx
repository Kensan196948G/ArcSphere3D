import { useState } from "react";
import { useLayerStore } from "@/state/layerStore";
import { useSceneStore } from "@/state/sceneStore";

export default function LayerPanel() {
  const { layers, addLayer, removeLayer, renameLayer, toggleLayerVisibility, setLayerColor } =
    useLayerStore();
  const objects = useSceneStore((s) => s.objects);
  const { setObjectLayer } = useSceneStore.getState();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    addLayer(newName.trim());
    setNewName("");
  }

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditName(name);
  }

  function commitEdit() {
    if (editingId && editName.trim()) renameLayer(editingId, editName.trim());
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        レイヤー管理
      </h3>

      {/* 新規レイヤー追加 */}
      <form onSubmit={handleAdd} className="flex gap-1">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しいレイヤー名"
          className="flex-1 rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="rounded bg-arc-accent/70 px-2 py-1 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
        >
          +
        </button>
      </form>

      {/* レイヤー一覧 */}
      <ul className="flex flex-col gap-1">
        {layers.map((layer) => {
          const objCount = objects.filter((o) => o.layerId === layer.id).length;
          return (
            <li
              key={layer.id}
              className="flex items-center gap-1.5 rounded bg-slate-100/80 px-2 py-1.5 dark:bg-slate-800/60"
            >
              {/* カラーピッカー */}
              <input
                type="color"
                value={layer.color}
                onChange={(e) => setLayerColor(layer.id, e.target.value)}
                className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                title="レイヤーカラー"
              />

              {/* 名前 / 編集 */}
              {editingId === layer.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 rounded bg-white px-1 py-0.5 text-slate-800 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-100"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => startEdit(layer.id, layer.name)}
                  className="flex-1 truncate text-left text-slate-700 dark:text-slate-200"
                  title="ダブルクリックで名前変更"
                >
                  {layer.name}
                </button>
              )}

              {/* オブジェクト数バッジ */}
              <span className="rounded-full bg-slate-200 px-1.5 text-[9px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {objCount}
              </span>

              {/* 表示切替 */}
              <button
                type="button"
                onClick={() => {
                  toggleLayerVisibility(layer.id);
                  const visible = !layer.visible;
                  objects
                    .filter((o) => o.layerId === layer.id)
                    .forEach((o) => {
                      o.object.visible = visible;
                      useSceneStore.getState().setObjectVisibility(o.id, visible);
                    });
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title={layer.visible ? "レイヤーを非表示" : "レイヤーを表示"}
              >
                {layer.visible ? "👁" : "🙈"}
              </button>

              {/* 削除 (デフォルトレイヤーは削除不可) */}
              {layer.id !== "default" && (
                <button
                  type="button"
                  onClick={() => {
                    objects
                      .filter((o) => o.layerId === layer.id)
                      .forEach((o) => setObjectLayer(o.id, "default"));
                    removeLayer(layer.id);
                  }}
                  className="text-rose-400 hover:text-rose-500 dark:text-rose-400"
                  title="レイヤーを削除"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        ダブルクリックでレイヤー名を変更。削除時、オブジェクトはデフォルトレイヤーへ移動します。
      </p>
    </div>
  );
}
