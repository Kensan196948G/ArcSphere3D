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
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            STEP / CAD 読み込み — 近日実装予定
          </p>
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
