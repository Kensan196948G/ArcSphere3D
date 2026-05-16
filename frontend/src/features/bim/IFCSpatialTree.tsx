import { useState, useCallback } from "react";
import { useIfcStore, type IFCSpatialNode } from "@/state/ifcStore";
import { fetchPropertiesForElement } from "@/features/viewport/ifcProperties";

const IFC_TYPE_LABEL: Record<string, string> = {
  IFCPROJECT: "🏗️ プロジェクト",
  IFCSITE: "🌍 敷地",
  IFCBUILDING: "🏢 建物",
  IFCBUILDINGSTOREY: "📐 階",
  IFCSPACE: "📦 空間",
  IFCWALL: "🧱 壁",
  IFCWALLSTANDARDCASE: "🧱 壁(標準)",
  IFCSLAB: "⬜ スラブ",
  IFCDOOR: "🚪 ドア",
  IFCWINDOW: "🪟 窓",
  IFCCOLUMN: "🏛️ 柱",
  IFCBEAM: "━ 梁",
  IFCSTAIR: "🪜 階段",
  IFCROOF: "🏠 屋根",
  IFCFURNISHINGELEMENT: "🪑 家具",
  IFCFLOWSEGMENT: "〰️ 配管",
};

function typeLabel(type: string): string {
  return IFC_TYPE_LABEL[type.toUpperCase()] ?? type;
}

interface NodeProps {
  node: IFCSpatialNode;
  depth: number;
  onSelect: (expressId: number) => void;
  selectedId: number | null;
}

function TreeNode({ node, depth, onSelect, selectedId }: NodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = node.expressID === selectedId;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) setExpanded((v) => !v);
          onSelect(node.expressID);
        }}
        className={[
          "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition-colors",
          isSelected
            ? "bg-arc-accent/20 text-arc-accent dark:bg-arc-accent/30"
            : "hover:bg-slate-100 dark:hover:bg-slate-700",
        ].join(" ")}
        style={{ paddingLeft: `${4 + depth * 12}px` }}
      >
        <span className="shrink-0 w-3 text-center text-slate-400">
          {hasChildren ? (expanded ? "▾" : "▸") : "•"}
        </span>
        <span className="truncate">
          {typeLabel(node.type)}
          {node.Name?.value ? (
            <span className="ml-1 text-slate-500 dark:text-slate-400">
              — {node.Name.value}
            </span>
          ) : null}
        </span>
      </button>
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.expressID}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function IFCSpatialTree() {
  const spatialTree = useIfcStore((s) => s.spatialTree);
  const selectedId = useIfcStore((s) => s.selectedExpressId);
  const activeModelId = useIfcStore((s) => s.activeModelId);
  const selectElement = useIfcStore((s) => s.selectElement);
  const setPropertySets = useIfcStore((s) => s.setPropertySets);
  const setLoading = useIfcStore((s) => s.setLoading);

  const handleSelect = useCallback(
    async (expressId: number) => {
      selectElement(expressId);
      if (activeModelId == null) return;
      setLoading(true);
      try {
        const sets = await fetchPropertiesForElement(activeModelId, expressId);
        setPropertySets(sets);
      } catch {
        setPropertySets([]);
      } finally {
        setLoading(false);
      }
    },
    [activeModelId, selectElement, setPropertySets, setLoading],
  );

  if (!spatialTree) {
    return (
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        IFC ファイルを読み込むと空間ツリーが表示されます。
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <ul className="select-none">
        <TreeNode
          node={spatialTree}
          depth={0}
          onSelect={handleSelect}
          selectedId={selectedId}
        />
      </ul>
    </div>
  );
}
