import { useRef } from "react";
import { useFileProcessor } from "./useFileProcessor";

export default function FileLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { processFile, busy } = useFileProcessor();

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="w-full rounded bg-arc-accent2/80 px-3 py-2 text-sm font-medium text-white hover:bg-arc-accent2 disabled:opacity-50 dark:text-slate-900"
      >
        {busy
          ? "読み込み中…"
          : "📂 .stl / .obj / .gltf / .glb / .ifc / .step / .iges を開く"}
      </button>
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept=".stl,.obj,.gltf,.glb,.ifc,.step,.stp,.iges,.igs"
        className="hidden"
        onChange={onChange}
      />
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        ローカルファイルをブラウザだけで解析します。アップロードは行いません。
      </p>
    </div>
  );
}
