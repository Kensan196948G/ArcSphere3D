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
      log(`[loader] ✗ unsupported: ${file.name}`);
      e.target.value = "";
      return;
    }
    setBusy(true);
    log(`[loader] loading ${file.name} (${file.size} bytes) …`);
    try {
      const obj = await loadFile(file);
      const scene = getActiveScene();
      if (!scene) {
        throw new Error("Three.js scene is not initialised yet");
      }
      scene.add(obj);
      const id = `obj-${Date.now()}`;
      addObject({ id, name: file.name, object: obj });
      log(`[loader] ✓ loaded ${file.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[loader] ✗ ${msg}`);
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
        className="w-full rounded bg-arc-accent2/80 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-arc-accent2 disabled:opacity-50"
      >
        {busy ? "Loading…" : "📂 Open .stl / .obj / .gltf / .glb"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".stl,.obj,.gltf,.glb"
        className="hidden"
        onChange={onChange}
      />
      <p className="text-[11px] text-slate-500">
        ローカルファイルをブラウザだけで解析します。アップロードは行いません。
      </p>
    </div>
  );
}
