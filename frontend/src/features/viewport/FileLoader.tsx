import { useRef, useState } from "react";
import { useSceneStore } from "@/state/sceneStore";
import { getActiveScene } from "@/lib/threeContext";
import { extOf, loadFile } from "./loaders";

export default function FileLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const addObject = useSceneStore((s) => s.addObject);
  const log = useSceneStore((s) => s.log);

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!extOf(file.name)) {
      log(`[ローダー] ✗ 非対応形式: ${file.name}`);
      e.target.value = "";
      return;
    }
    setBusy(true);
    log(`[ローダー] ${file.name} を読み込み中 (${file.size} バイト)…`);
    try {
      const obj = await loadFile(file);
      const scene = getActiveScene();
      if (!scene) {
        throw new Error("Three.js シーンがまだ初期化されていません");
      }
      scene.add(obj);
      const id = `obj-${Date.now()}`;
      addObject({ id, name: file.name, object: obj });
      log(`[ローダー] ✓ ${file.name} を読み込みました`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[ローダー] ✗ ${msg}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="w-full rounded bg-arc-accent2/80 px-3 py-2 text-sm font-medium text-white hover:bg-arc-accent2 disabled:opacity-50 dark:text-slate-900"
      >
        {busy ? "読み込み中…" : "📂 .stl / .obj / .gltf / .glb / .ifc を開く"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".stl,.obj,.gltf,.glb,.ifc"
        className="hidden"
        onChange={onChange}
      />
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        ローカルファイルをブラウザだけで解析します。アップロードは行いません。
      </p>
    </div>
  );
}
