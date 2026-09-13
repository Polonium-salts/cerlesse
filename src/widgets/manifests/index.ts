import type { TileSize, TileRatio } from "../../lib/tileLayoutEngine.js";
import type { WidgetCategoryType, TileThemeConfig } from "../sdk/types.js";

import actionsToolbox from "./actions_toolbox.json";
import agentWorkflow from "./agent_workflow.json";
import aiOverview from "./ai_overview.json";
import analyticsTrend from "./analytics_trend.json";
import comparison from "./comparison.json";
import fastChat from "./fast_chat.json";
import followup from "./followup.json";
import metricsTelemetry from "./metrics_telemetry.json";
import mindmap from "./mindmap.json";
import mobileQr from "./mobile_qr.json";
import officialPortal from "./official_portal.json";
import quickAnswer from "./quick_answer.json";
import sources from "./sources.json";
import takeaways from "./takeaways.json";
import topicDigest from "./topic_digest.json";
import verificationChecklist from "./verification_checklist.json";

/**
 * 小组件插件清单聚合层 (Widget Manifest Catalog)
 * ============================================================
 * 一个小组件 = 一份 JSON 清单（元信息 + 网格规格 + 主题）+ 一个渲染实现（TSX）。
 * 本文件把目录下散落的清单汇聚成统一目录，让"改 JSON 即改磁贴"成为可能。
 *
 * ── 为什么清单必须编译期内联（静态 import），而不是运行时 fetch ──────────────
 * 布局求解必须**同步**拿到网格比例：`solveTileLayout` 在首帧渲染时就要按比例
 * 算高度，组件渲染同样要按比例定位。若清单靠 `fetch()` 异步加载，
 * 首帧必然拿不到比例而回落到默认值 —— 磁贴会先按 4:3 画一遍、清单到达后再跳变，
 * 这正是本项目历史上反复出现的"小组件没加载出来/形状不对"的成因。
 * 静态 import 让清单在构建期就进入包内，任何时刻查询都是同步且确定的。
 *
 * ── 依赖方向（必须保持，否则会形成运行时循环）────────────────────────────
 *   布局引擎 (lib/tileLayoutEngine)  ──值依赖──▶  本文件
 *   本文件                            ──仅类型──▶  布局引擎 / sdk/types
 * 本文件的运行时依赖**只有 16 份 JSON**，对布局引擎与 sdk 全部是 `import type`
 * （编译后完全擦除）。因此布局引擎可以安全地反向引用本文件取比例表。
 *
 * ── 字段合法性 ──────────────────────────────────────────────────────────
 * 手写清单时，编辑器会依据同目录的 `widget-manifest.schema.json` 实时校验并补全
 * （`$schema` 字段已指向它），ratio / size 等枚举写错会立刻出现波浪线。
 */

/** 网格规格 —— 磁贴形状的唯一事实来源 */
export interface WidgetGridSpec {
  /** 默认占列宽度档位（12 栅格基准） */
  defaultSize: TileSize;
  /** 允许用户切换的宽度档位 */
  supportedSizes: TileSize[];
  /** 网格宽高比：磁贴高度恒等于 宽度 ÷ ratio */
  ratio: TileRatio;
  /** 可选。允许求解器收窄的最小列跨度；缺省沿用通用规则「最多收窄一档」 */
  minSpan?: number;
}

/** 插件清单 (Widget Manifest) */
export interface WidgetManifest {
  $schema?: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  category?: WidgetCategoryType;
  icon?: string;
  grid: WidgetGridSpec;
  theme?: TileThemeConfig;
}

/**
 * JSON 导入推断出的字段类型是宽化的 `string`，与清单里的字面量联合类型
 * （TileSize / TileRatio / WidgetCategoryType）无法直接赋值。
 * 这里用一次显式转换收敛，字段合法性由 JSON Schema 在编辑期保证。
 */
function asManifest(raw: unknown): WidgetManifest {
  return raw as WidgetManifest;
}

/** 全部官方小组件清单（顺序即插件市场的默认展示顺序） */
export const WIDGET_MANIFESTS: WidgetManifest[] = [
  quickAnswer,
  aiOverview,
  sources,
  mindmap,
  comparison,
  takeaways,
  actionsToolbox,
  metricsTelemetry,
  officialPortal,
  followup,
  verificationChecklist,
  analyticsTrend,
  fastChat,
  mobileQr,
  topicDigest,
  agentWorkflow
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
 * id → 最小列跨度（仅声明了 minSpan 的清单会出现）。
 * 未声明的组件由调用方回落到通用规则「最多收窄一档」。
 */
export const MANIFEST_MIN_SPANS: Record<string, number> = WIDGET_MANIFESTS.reduce<
  Record<string, number>
>((acc, manifest) => {
  if (typeof manifest.grid.minSpan === "number") {
    acc[manifest.id] = manifest.grid.minSpan;
  }
  return acc;
}, {});

/** 按 id 取清单 */
export function getManifest(id: string): WidgetManifest | undefined {
  return MANIFEST_BY_ID[id];
}
