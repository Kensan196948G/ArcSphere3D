const items = [
  { icon: "📁", label: "Project" },
  { icon: "🧊", label: "Model" },
  { icon: "🧱", label: "Layer" },
  { icon: "🏗️", label: "BIM" },
  { icon: "🎨", label: "Material" },
  { icon: "🤖", label: "AI Assist" },
  { icon: "⚙️", label: "Settings" },
];

export default function LeftMenu() {
  return (
    <nav className="flex h-full flex-col gap-1 p-2">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          className="flex items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/40"
        >
          <span aria-hidden>{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
