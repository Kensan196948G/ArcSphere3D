import { useUiStore } from "@/state/uiStore";
import { useAuthStore } from "@/state/authStore";

import ProjectPanel from "@/features/project/ProjectPanel";
import ModelPanel from "@/features/model/ModelPanel";
import LayerPanel from "@/features/layer/LayerPanel";
import MaterialPanel from "@/features/material/MaterialPanel";
import AIPanel from "@/features/ai/AIPanel";
import SettingsPanel from "@/features/settings/SettingsPanel";
import IFCPropertyPanel from "@/features/bim/IFCPropertyPanel";
import GisPanel from "@/features/gis/GisPanel";
import MeasurePanel from "@/features/measure/MeasurePanel";
import PointCloudPanel from "@/features/pointcloud/PointCloudPanel";
import TerrainPanel from "@/features/terrain/TerrainPanel";
import EarthworkPanel from "@/features/earthwork/EarthworkPanel";
import AlignmentPanel from "@/features/alignment/AlignmentPanel";

const PANEL_TITLES: Record<string, string> = {
  project: "プロジェクト",
  model: "モデル",
  layer: "レイヤー",
  bim: "BIM",
  material: "マテリアル",
  ai: "AI アシスト",
  settings: "設定",
  gis: "GIS 背景地図",
  measure: "計測",
  pointcloud: "点群",
  terrain: "地形 / TIN",
  earthwork: "土量計算",
  alignment: "線形設計",
  cad: "CAD 読み込み",
};

export default function RightPanel() {
  const activePanel = useUiStore((s) => s.activePanel);
  const token = useAuthStore((s) => s.token);

  function renderPanel() {
    switch (activePanel) {
      case "project":
        return token ? (
          <ProjectPanel />
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            ログインしてプロジェクトを表示します。
          </p>
        );
      case "model":
        return <ModelPanel />;
      case "layer":
        return <LayerPanel />;
      case "bim":
        return <IFCPropertyPanel />;
      case "material":
        return <MaterialPanel />;
      case "ai":
        return <AIPanel />;
      case "settings":
        return <SettingsPanel />;
      case "gis":
        return <GisPanel />;
      case "measure":
        return <MeasurePanel />;
      case "pointcloud":
        return <PointCloudPanel />;
      case "terrain":
        return <TerrainPanel />;
      case "earthwork":
        return <EarthworkPanel />;
      case "alignment":
        return <AlignmentPanel />;
      case "cad":
        return (
          <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
            <p>STEP / IGES 読み込み — OpenCascade.js (WASM) ローダー実装済み。</p>
            <p className="text-slate-400 dark:text-slate-500">
              有効化するには <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">public/opencascade/</code> に
              opencascade.js + opencascade.wasm を配置してください。
            </p>
            <p>対応拡張子: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.step .stp .iges .igs</code></p>
            <p>プロジェクトパネルのアップロードから直接読み込めます。</p>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-3 text-sm">
      <h2 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {PANEL_TITLES[activePanel]}
      </h2>
      <div className="flex-1 overflow-y-auto">{renderPanel()}</div>
    </div>
  );
}
