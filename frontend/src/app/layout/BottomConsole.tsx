import { useSceneStore } from "@/state/sceneStore";

export default function BottomConsole() {
  const logs = useSceneStore((s) => s.logs);
  return (
    <div className="h-full overflow-auto bg-slate-100/60 p-2 font-mono text-xs text-slate-700 dark:bg-black/40 dark:text-slate-300">
      {logs.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500">
          [コンソール] ArcSphere3D 準備完了。右パネルからモデルを読み込むか、ドラッグ＆ドロップしてください。
        </p>
      ) : (
        logs.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap">
            {line}
          </div>
        ))
      )}
    </div>
  );
}
