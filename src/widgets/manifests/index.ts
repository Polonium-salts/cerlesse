import type { TileWidth, TileRatio, Breakpoint, TileRatioMode } from "../../lib/tileLayoutEngine.js";
import type { WidgetCategoryType, TileThemeConfig, WidgetAgentPromptHint } from "../sdk/types.js";

import relatedLinks from "./related_links.json";
import aiAnswer from "./ai_answer.json";
import sources from "./sources.json";
import takeaways from "./takeaways.json";
import imageGallery from "./image_gallery.json";
import searchEngine from "./search_engine.json";
import tokenUsage from "./token_usage.json";
import weather from "./weather.json";
import translation from "./translation.json";
import comparison from "./comparison.json";
import mindmap from "./mindmap.json";
import actionsToolbox from "./actions_toolbox.json";
import verificationChecklist from "./verification_checklist.json";
import troubleshooting from "./troubleshooting.json";

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
  /** 比例模式：strict（严格锁定比例高，溢出内部滚动）| flexible（比例为下限，内容多则自然长高） */
  ratioMode?: TileRatioMode;
  /** 响应式断点比例覆盖 */
  ratioByBreakpoint?: Partial<Record<Breakpoint, TileRatio>>;
  /** 可选。允许求解器收窄到的最小占宽百分比；缺省沿用通用规则「最多收窄一档」 */
  minWidth?: TileWidth;
  /** 可选：单个内容条目的估算高度（px） */
  itemHeightPx?: number;
  /** 可选：除条目列表外的固定开销高度（px） */
  baseHeightPx?: number;
}

/** 插件清单 (Widget Manifest) */
export interface WidgetLayoutMeta {
  defaultWidth: TileWidth;
  minWidth: TileWidth;
  maxWidth: TileWidth;
  preferredRoles: ("hero" | "primary" | "secondary" | "supporting" | "utility")[];
  canPairWith?: string[];
  avoidPairWith?: string[];
}

export interface WidgetManifest {
  $schema?: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  presence?: "conditional" | "resident";
  category?: WidgetCategoryType;
  /** 语义与功能标签列表 (Tags) */
  tags?: string[];
  /** Agent 实用性提示词与底层属性定义 */
  agentHint?: WidgetAgentPromptHint;
  icon?: string;
  grid: WidgetGridSpec;
  layout?: WidgetLayoutMeta;
  theme?: TileThemeConfig;
}

function asManifest(raw: unknown): WidgetManifest {
  return raw as WidgetManifest;
}

/** 全部小组件清单 */
export const WIDGET_MANIFESTS: WidgetManifest[] = [
  aiAnswer,
  sources,
  relatedLinks,
  takeaways,
  imageGallery,
  searchEngine,
  tokenUsage,
  weather,
  translation,
  comparison,
  mindmap,
  actionsToolbox,
  verificationChecklist,
  troubleshooting
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
 * id → 比例模式（strict | flexible）。
 */
export const MANIFEST_RATIO_MODES: Record<string, TileRatioMode> = WIDGET_MANIFESTS.reduce<
  Record<string, TileRatioMode>
>((acc, manifest) => {
  if (manifest.grid.ratioMode) {
    acc[manifest.id] = manifest.grid.ratioMode;
  }
  return acc;
}, {});

/**
 * id → 断点比例映射。
 */
export const MANIFEST_RATIOS_BY_BREAKPOINT: Record<string, Partial<Record<Breakpoint, TileRatio>>> = WIDGET_MANIFESTS.reduce<
  Record<string, Partial<Record<Breakpoint, TileRatio>>>
>((acc, manifest) => {
  if (manifest.grid.ratioByBreakpoint) {
    acc[manifest.id] = manifest.grid.ratioByBreakpoint;
  }
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

/**
 * id → 条目预估参数（声明了 itemHeightPx / baseHeightPx 的清单）。
 */
export const MANIFEST_ITEM_HEIGHTS: Record<string, { itemHeightPx?: number; baseHeightPx?: number }> = WIDGET_MANIFESTS.reduce<
  Record<string, { itemHeightPx?: number; baseHeightPx?: number }>
>((acc, manifest) => {
  if (typeof manifest.grid.itemHeightPx === "number" || typeof manifest.grid.baseHeightPx === "number") {
    acc[manifest.id] = {
      itemHeightPx: manifest.grid.itemHeightPx,
      baseHeightPx: manifest.grid.baseHeightPx
    };
  }
  return acc;
}, {});

export const DEFAULT_LAYOUT_METAS: Record<string, WidgetLayoutMeta> = {
  ai_answer: {
    defaultWidth: 100,
    minWidth: 50,
    maxWidth: 100,
    preferredRoles: ["hero", "primary"],
    canPairWith: ["sources", "takeaways", "related_links", "image_gallery"]
  },
  sources: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 100,
    preferredRoles: ["primary", "secondary"],
    canPairWith: ["ai_answer", "related_links", "takeaways"]
  },
  related_links: {
    defaultWidth: 25,
    minWidth: 25,
    maxWidth: 50,
    preferredRoles: ["supporting", "utility"],
    canPairWith: ["ai_answer", "takeaways", "search_engine"]
  },
  takeaways: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredRoles: ["primary", "secondary"],
    canPairWith: ["ai_answer", "related_links", "image_gallery"]
  },
  image_gallery: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredRoles: ["primary", "secondary"],
    canPairWith: ["takeaways", "related_links"]
  },
  search_engine: {
    defaultWidth: 25,
    minWidth: 25,
    maxWidth: 50,
    preferredRoles: ["utility", "supporting"],
    canPairWith: ["related_links", "token_usage"]
  },
  token_usage: {
    defaultWidth: 25,
    minWidth: 25,
    maxWidth: 50,
    preferredRoles: ["utility"],
    canPairWith: ["search_engine", "related_links"]
  },
  weather: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredRoles: ["primary", "secondary"],
    canPairWith: ["translation", "related_links"]
  },
  translation: {
    defaultWidth: 50,
    minWidth: 50,
    maxWidth: 100,
    preferredRoles: ["primary", "hero"],
    canPairWith: ["related_links", "takeaways"]
  },
  comparison: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredRoles: ["hero", "primary"],
    canPairWith: ["takeaways", "related_links", "actions_toolbox"]
  },
  mindmap: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredRoles: ["primary", "hero"],
    canPairWith: ["takeaways", "related_links"]
  },
  actions_toolbox: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredRoles: ["secondary", "supporting"],
    canPairWith: ["troubleshooting", "comparison"]
  },
  verification_checklist: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredRoles: ["secondary", "supporting"],
    canPairWith: ["troubleshooting", "actions_toolbox"]
  },
  troubleshooting: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredRoles: ["hero", "primary"],
    canPairWith: ["verification_checklist", "actions_toolbox"]
  }
};

/**
 * id → 布局元数据索引
 */
export const MANIFEST_LAYOUT_METAS: Record<string, WidgetLayoutMeta> = WIDGET_MANIFESTS.reduce<
  Record<string, WidgetLayoutMeta>
>((acc, manifest) => {
  acc[manifest.id] = manifest.layout || DEFAULT_LAYOUT_METAS[manifest.id] || {
    defaultWidth: manifest.grid.width,
    minWidth: manifest.grid.minWidth || 25,
    maxWidth: 100,
    preferredRoles: ["primary", "secondary"]
  };
  return acc;
}, {});

/** 按 id 取清单 */
export function getManifest(id: string): WidgetManifest | undefined {
  return MANIFEST_BY_ID[id];
}

/** 按 id 取小组件布局元数据 */
export function getWidgetLayoutMeta(id: string): WidgetLayoutMeta {
  return MANIFEST_LAYOUT_METAS[id] || DEFAULT_LAYOUT_METAS[id] || {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 100,
    preferredRoles: ["primary", "secondary"]
  };
}
