import { useRef, useState } from "react";
import { useSceneStore } from "@/state/sceneStore";
import { useIfcStore } from "@/state/ifcStore";
import { useUiStore } from "@/state/uiStore";
import { getActiveScene } from "@/lib/threeContext";
import { extOf, loadFile } from "./loaders";
import { loadIfc, getIfcSpatialStructure } from "./ifcLoader";
import type { IFCSpatialNode } from "@/state/ifcStore";

export default function FileLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const addObject = useSceneStore((s) => s.addObject);
  const log = useSceneStore((s) => s.log);
  const ifcStore = useIfcStore();
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = extOf(file.name);
    if (!ext) {
      log(`[ローダー] ✗ 非対応形式: ${file.name}`);
      e.target.value = "";
      return;
    }

    // STEP/IGES does not need the 3D scene — handle before scene init
    if (ext === "step" || ext === "stp" || ext === "iges" || ext === "igs") {
      log(
        `[CAD] ${file.name} を受信しました。STEP/IGES 読み込みは OpenCascade.js WASM カーネル統合後に利用可能になります。CAD パネルで詳細をご確認ください。`,
      );
      setActivePanel("cad");
      e.target.value = "";
      return;
    }

    setBusy(true);
    log(`[ローダー] ${file.name} を読み込み中 (${file.size} バイト)…`);
    try {
      const scene = getActiveScene();
      if (!scene) throw new Error("Three.js シーンがまだ初期化されていません");

      if (ext === "ifc") {
        const buf = await file.arrayBuffer();
        const { group, modelId } = await loadIfc(buf, file.name);
        scene.add(group);
        const id = `obj-${Date.now()}`;
        addObject({ id, name: file.name, object: group });
        ifcStore.addModel({ modelId, sceneObjectId: id, filename: file.name });

        try {
          const rawTree = await getIfcSpatialStructure(modelId);
          ifcStore.setSpatialTree(normalizeNode(rawTree));
        } catch {
          log("[BIM] 空間ツリーの読み込みに失敗しました");
        }

        setActivePanel("bim");
        log(
          `[ローダー] ✓ ${file.name} (IFC modelId=${modelId}) を読み込みました`,
        );
      } else {
        const obj = await loadFile(file);
        scene.add(obj);
        const id = `obj-${Date.now()}`;
        addObject({ id, name: file.name, object: obj });
        log(`[ローダー] ✓ ${file.name} を読み込みました`);
      }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNode(raw: any): IFCSpatialNode {
  return {
    expressID: raw.expressID ?? 0,
    type: raw.type ?? "UNKNOWN",
    Name: raw.Name ?? null,
    children: Array.isArray(raw.children)
      ? raw.children.map(normalizeNode)
      : [],
  };
}
