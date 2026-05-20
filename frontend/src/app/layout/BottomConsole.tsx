import { useSceneStore } from "@/state/sceneStore";

export default function BottomConsole() {
  const logs = useSceneStore((s) => s.logs);

  function handleExport() {
    const text = logs.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arcsphere3d-console-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 py-0.5 dark:border-slate-700">
        <span className="font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          コンソール
        </span>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            data-testid="console-export-btn"
            title="ログをファイルに保存"
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            ↓ 保存
          </button>
        )}
      </div>
      <div
        data-testid="bottom-console"
        className="min-h-0 flex-1 overflow-auto bg-slate-100/60 p-2 font-mono text-xs text-slate-700 dark:bg-black/40 dark:text-slate-300"
      >
        {logs.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500">
            [コンソール] ArcSphere3D
            準備完了。右パネルからモデルを読み込むか、ドラッグ＆ドロップしてください。
          </p>
        ) : (
          logs.map((line, idx) => (
            <div key={idx} className="whitespace-pre-wrap">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
