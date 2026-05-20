import { useState } from "react";
import { useSceneStore } from "@/state/sceneStore";
import { useIfcStore } from "@/state/ifcStore";
import { useUiStore } from "@/state/uiStore";
import { getActiveScene } from "@/lib/threeContext";
import { extOf, loadFile } from "./loaders";
import { loadIfc, getIfcSpatialStructure } from "./ifcLoader";
import type { IFCSpatialNode } from "@/state/ifcStore";

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

export function useFileProcessor() {
  const [busy, setBusy] = useState(false);
  const addObject = useSceneStore((s) => s.addObject);
  const log = useSceneStore((s) => s.log);
  const ifcStore = useIfcStore();
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  async function processFile(file: File): Promise<void> {
    const ext = extOf(file.name);
    if (!ext) {
      log(`[ローダー] ✗ 非対応形式: ${file.name}`);
      return;
    }

    // STEP/IGES does not need the 3D scene — handle before scene init
    if (ext === "step" || ext === "stp" || ext === "iges" || ext === "igs") {
      log(
        `[CAD] ${file.name} を受信しました。STEP/IGES 読み込みは OpenCascade.js WASM カーネル統合後に利用可能になります。CAD パネルで詳細をご確認ください。`,
      );
      setActivePanel("cad");
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
    }
  }

  return { processFile, busy };
}
