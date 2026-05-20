import { useState } from "react";
import { useMeasureStore, type MeasureMode } from "@/state/measureStore";

const MODES: { id: MeasureMode; label: string; description: string }[] = [
  {
    id: "distance",
    label: "距離",
    description: "クリックで点を追加、複数点間の累計距離を計算",
  },
  {
    id: "area",
    label: "面積",
    description: "3点以上クリックでポリゴン面積を計算（XZ平面）",
  },
  {
    id: "height",
    label: "高さ",
    description: "2点クリックでY軸方向の高低差を計算",
  },
];

const UNIT: Record<MeasureMode, string> = {
  off: "",
  distance: "m",
  area: "m²",
  height: "m",
};

export default function MeasurePanel() {
  const { mode, points, result, setMode, clear } = useMeasureStore();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (result === null) return;
    void navigator.clipboard
      .writeText(`${result.toFixed(3)} ${UNIT[mode]}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  }

  const handleMode = (id: MeasureMode) => {
    if (mode === id) {
      setMode("off");
    } else {
      setMode(id);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Mode selector */}
      <div className="flex flex-col gap-1">
        {MODES.map(({ id, label, description }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleMode(id)}
            title={description}
            className={[
              "rounded px-3 py-1.5 text-left text-[11px] font-medium transition-colors",
              mode === id
                ? "bg-arc-accent/20 text-arc-accent ring-1 ring-arc-accent/40"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status */}
      {mode !== "off" && (
        <div className="rounded bg-slate-100 px-2 py-2 text-[11px] dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            計測中:{" "}
            <span className="font-medium text-arc-accent">
              {MODES.find((m) => m.id === mode)?.label}
            </span>
          </p>
          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
            点数: {points.length}
          </p>
          {result !== null && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base font-mono font-semibold text-slate-700 dark:text-slate-200">
                {result.toFixed(3)} {UNIT[mode]}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                data-testid="measure-copy-btn"
                title="クリップボードにコピー"
                className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
              >
                {copied ? "✓" : "コピー"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          disabled={points.length === 0}
          className="flex-1 rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          クリア
        </button>
        {mode !== "off" && (
          <button
            type="button"
            onClick={() => setMode("off")}
            className="flex-1 rounded bg-rose-100 px-2 py-1 text-[11px] text-rose-600 transition-colors hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400"
          >
            計測終了
          </button>
        )}
      </div>

      {/* Instructions */}
      <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        {mode === "off" && "計測モードを選択してください。"}
        {mode === "distance" && "3Dビューをクリックして計測点を追加します。"}
        {mode === "area" && "3点以上クリックすると面積が表示されます。"}
        {mode === "height" && "最初の点と最後の点の高低差を計算します。"}
      </p>
    </div>
  );
}
