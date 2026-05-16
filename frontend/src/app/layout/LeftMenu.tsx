import { useUiStore, type PanelId } from "@/state/uiStore";

const items: { id: PanelId; icon: string; label: string }[] = [
  { id: "project", icon: "📁", label: "プロジェクト" },
  { id: "model", icon: "🧊", label: "モデル" },
  { id: "layer", icon: "🧱", label: "レイヤー" },
  { id: "bim", icon: "🏗️", label: "BIM" },
  { id: "material", icon: "🎨", label: "マテリアル" },
  { id: "ai", icon: "🤖", label: "AI アシスト" },
  { id: "settings", icon: "⚙️", label: "設定" },
];

export default function LeftMenu() {
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  return (
    <nav className="flex h-full flex-col gap-1 p-2">
      {items.map((it) => {
        const active = activePanel === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setActivePanel(it.id)}
            className={
              "flex items-center gap-2 rounded px-2 py-2 text-left text-sm transition " +
              (active
                ? "bg-arc-accent/20 text-arc-accent dark:bg-arc-accent/30 dark:text-arc-accent"
                : "text-slate-600 hover:bg-slate-200/80 dark:text-slate-200 dark:hover:bg-slate-700/40")
            }
          >
            <span aria-hidden>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
