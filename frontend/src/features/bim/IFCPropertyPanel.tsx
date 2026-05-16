import { useEffect, useState } from "react";
import { useIfcStore, type IFCPropertySet } from "@/state/ifcStore";
import { fetchPropertiesForElement } from "@/features/viewport/FileLoader";
import IFCSpatialTree from "./IFCSpatialTree";

function PropertySetBlock({ pset }: { pset: IFCPropertySet }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2 rounded border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
      >
        <span className="truncate">{pset.name}</span>
        <span className="ml-1 shrink-0 text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <table className="w-full border-t border-slate-100 text-[11px] dark:border-slate-700">
          <tbody>
            {pset.properties.map((p) => (
              <tr
                key={p.name}
                className="border-b border-slate-100 last:border-0 dark:border-slate-700"
              >
                <td className="w-2/5 break-words px-2 py-1 text-slate-500 dark:text-slate-400">
                  {p.name}
                </td>
                <td className="w-3/5 break-words px-2 py-1 font-mono text-slate-800 dark:text-slate-200">
                  {p.value == null ? (
                    <span className="text-slate-300 dark:text-slate-600">
                      —
                    </span>
                  ) : (
                    String(p.value)
                  )}
                </td>
              </tr>
            ))}
            {pset.properties.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="px-2 py-1 text-slate-400 dark:text-slate-600"
                >
                  プロパティなし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function IFCPropertyPanel() {
  const activeModelId = useIfcStore((s) => s.activeModelId);
  const selectedExpressId = useIfcStore((s) => s.selectedExpressId);
  const propertySets = useIfcStore((s) => s.propertySets);
  const loading = useIfcStore((s) => s.loading);
  const setPropertySets = useIfcStore((s) => s.setPropertySets);
  const setLoading = useIfcStore((s) => s.setLoading);
  const models = useIfcStore((s) => s.models);

  // Fetch properties when selection changes (e.g., from viewport raycasting click)
  useEffect(() => {
    if (selectedExpressId == null || activeModelId == null) return;
    let cancelled = false;
    setLoading(true);
    fetchPropertiesForElement(activeModelId, selectedExpressId)
      .then((sets) => {
        if (!cancelled) setPropertySets(sets);
      })
      .catch(() => {
        if (!cancelled) setPropertySets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedExpressId, activeModelId, setPropertySets, setLoading]);

  if (models.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          🏗️ IFC ファイルを読み込むと BIM 属性パネルが有効になります。
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          モデルパネル → 📂 を開いて .ifc ファイルを選択してください。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Model info */}
      <div className="rounded bg-slate-100 px-2 py-1.5 text-[11px] dark:bg-slate-800">
        <span className="text-slate-500 dark:text-slate-400">モデル: </span>
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {models[models.length - 1]?.filename}
        </span>
      </div>

      {/* Spatial tree */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          空間ツリー
        </p>
        <IFCSpatialTree />
      </div>

      {/* Properties */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {selectedExpressId != null
            ? `属性 (expressID: ${selectedExpressId})`
            : "属性 — 要素を選択してください"}
        </p>
        {loading && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            読み込み中…
          </p>
        )}
        {!loading && selectedExpressId != null && propertySets.length === 0 && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            このオブジェクトにプロパティセットはありません。
          </p>
        )}
        {!loading &&
          propertySets.map((pset) => (
            <PropertySetBlock key={pset.name} pset={pset} />
          ))}
      </div>
    </div>
  );
}
