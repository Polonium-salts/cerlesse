import type { TileWidth, TileRatio } from "../../lib/tileLayoutEngine.js";
import type { WidgetCategoryType, TileThemeConfig, WidgetAgentPromptHint } from "../sdk/types.js";

import relatedLinks from "./related_links.json";
import aiAnswer from "./ai_answer.json";
import takeaways from "./takeaways.json";
import imageGallery from "./image_gallery.json";

/**
 * 小组件插件清单聚合层 (Widget Manifest Catalog)
 * ============================================================
 * 统一管理官方小组件清单（AI 智能回答、相关多链接跳转等）。
 */

/** 网格规格 —— 磁贴形状的唯一事实来源 */
export interface WidgetGridSpec {
  /** 默认占宽百分比（12 栅格基准）：25 / 50 / 75 / 100 */
  width: TileWidth;
  /** 允许用户切换的宽度百分比 */
  supportedWidths: TileWidth[];
  /** 网格宽高比：磁贴高度恒等于 宽度 ÷ ratio */
  ratio: TileRatio;
  /** 可选。允许求解器收窄到的最小占宽百分比；缺省沿用通用规则「最多收窄一档」 */
  minWidth?: TileWidth;
}

/** 插件清单 (Widget Manifest) */
export interface WidgetManifest {
  $schema?: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  category?: WidgetCategoryType;
  /** 语义与功能标签列表 (Tags) */
  tags?: string[];
  /** Agent 实用性提示词与底层属性定义 */
  agentHint?: WidgetAgentPromptHint;
  icon?: string;
  grid: WidgetGridSpec;
  theme?: TileThemeConfig;
}

function asManifest(raw: unknown): WidgetManifest {
  return raw as WidgetManifest;
}

/** 全部小组件清单 */
export const WIDGET_MANIFESTS: WidgetManifest[] = [
  aiAnswer,
  relatedLinks,
  takeaways,
  imageGallery
].map(asManifest);

/** id → 清单 索引 */
export const MANIFEST_BY_ID: Record<string, WidgetManifest> = WIDGET_MANIFESTS.reduce<
  Record<string, WidgetManifest>
>((acc, manifest) => {
  acc[manifest.id] = manifest;
  return acc;
}, {});

/**
 * id → 网格宽高比。
 * 布局引擎的 WIDGET_RATIOS 由此派生，因此比例表的唯一事实来源就是这些 JSON 清单。
 */
export const MANIFEST_RATIOS: Record<string, TileRatio> = WIDGET_MANIFESTS.reduce<
  Record<string, TileRatio>
>((acc, manifest) => {
  acc[manifest.id] = manifest.grid.ratio;
  return acc;
}, {});

/**
 * id → 最小占宽百分比（仅声明了 minWidth 的清单会出现）。
 * 未声明的组件由调用方回落到通用规则「最多收窄一档」。
 */
export const MANIFEST_MIN_WIDTHS: Record<string, TileWidth> = WIDGET_MANIFESTS.reduce<
  Record<string, TileWidth>
>((acc, manifest) => {
  if (typeof manifest.grid.minWidth === "number") {
    acc[manifest.id] = manifest.grid.minWidth;
  }
  return acc;
}, {});

/** 按 id 取清单 */
export function getManifest(id: string): WidgetManifest | undefined {
  return MANIFEST_BY_ID[id];
}
