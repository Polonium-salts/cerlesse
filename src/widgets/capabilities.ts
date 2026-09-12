import { WidgetPlannedSize } from "../types.js";
import { TileSize } from "../lib/tileLayoutEngine.js";
import {
  CANONICAL_CAPABILITIES,
  normalizeCapabilities,
  isCanonicalCapability,
  type CanonicalCapability
} from "./capabilityTaxonomy.js";

export {
  CANONICAL_CAPABILITIES,
  CAPABILITY_ALIASES,
  CAPABILITY_PROMPT_ENUM,
  normalizeCapability,
  normalizeCapabilities,
  isCanonicalCapability
} from "./capabilityTaxonomy.js";
export type { CanonicalCapability, NormalizedCapabilities } from "./capabilityTaxonomy.js";

/**
 * 规范能力字典（按业务域分组的只读视图）
 *
 * ⚠️ 这里不再独立维护词表：所有取值都来自 capabilityTaxonomy 的 CANONICAL_CAPABILITIES。
 * 改造前本文件是一份与组件侧互不相通的独立词表（33 项），
 * 导致 matchCapabilitiesScore 对 tech_comparison / troubleshooting / portal_navigation
 * 三个意图的得分恒为 0。
 */
export const WIDGET_CAPABILITIES = {
  // 软件与工具安装类
  SOFTWARE_INFO: "software_info",
  DOWNLOAD: "download",
  RELEASES: "releases",
  VERSION_HISTORY: "version_history",
  RELEASE_BINARY: "release_binary",
  SYSTEM_REQUIREMENT: "environment_checklist",
  INSTALL_COMMAND: "install_command",
  INSTALL_STEP: "install_step",
  SECURITY_CHECK: "security_audit",
  OFFICIAL_PORTAL: "official_portal",

  // 资源与多媒体类
  RESOURCE_SEARCH: "resource_search",
  RESOURCE_PREVIEW: "resource_preview",
  FAVORITE: "favorite",
  TAGS_FILTER: "tags_filter",
  AUTHOR_CREDIT: "author_credit",
  LICENSE_INFO: "license_info",
  RESOLUTION_SPEC: "resolution_spec",

  // 编程与技能学习类
  TUTORIAL_ROADMAP: "roadmap_step",
  ROADMAP_STEP: "roadmap_step",
  CODE_RUN: "code_run",
  CODE_SNIPPET: "code_snippet",
  REFERENCE_DOCS: "verified_docs",
  PROGRESS_TRACKER: "progress_tracker",
  RECOMMENDED_COURSES: "recommended_courses",
  PRACTICE_EXERCISES: "practice_exercises",
  PREREQUISITES_CHECK: "prerequisites_check",

  // GitHub 与开源项目类
  REPO_SUMMARY: "software_info",
  STAR_TREND: "trend_signals",
  GIT_CLONE: "git_clone",

  // 气象与环境类
  WEATHER_CURRENT: "weather_current",
  WEATHER_FORECAST: "weather_forecast",
  WEATHER_INDICES: "weather_indices",
  CLOTHING_ADVICE: "clothing_advice",
  AIR_QUALITY: "air_quality",
  LOCATION_MAP: "location_map",

  // 综合分析与研报类
  INSTANT_VERDICT: "instant_verdict",
  SUMMARY_POINTS: "summary_points",
  COMPARE_TABLE: "compare_table",
  BENCHMARK_TABLE: "benchmark_table",
  MINDMAP_TREE: "mindmap_tree",
  EVIDENCE_CHAIN: "evidence_chain",
  VERDICT_RECOMMENDATION: "verdict_recommendation",
  PROS_CONS: "pros_cons"
} as const satisfies Record<string, CanonicalCapability>;

export type WidgetCapabilityKey = (typeof WIDGET_CAPABILITIES)[keyof typeof WIDGET_CAPABILITIES];

/**
 * 根据组件内的信息密度和交互复杂度，智能计算推荐的磁贴尺寸
 */
export function recommendTileSize(options: {
  componentCount: number;
  hasRichActions?: boolean;
  hasComplexGrid?: boolean;
  preferredLayout?: "compact" | "spacious";
}): TileSize {
  const { componentCount, hasRichActions = false, hasComplexGrid = false, preferredLayout = "spacious" } = options;

  if (componentCount <= 1 && !hasRichActions && !hasComplexGrid) {
    return "small"; // 2x2
  }

  if (componentCount <= 2 && !hasComplexGrid) {
    return "medium"; // 4x2
  }

  if (hasComplexGrid || componentCount >= 5) {
    return preferredLayout === "spacious" ? "large" : "wide"; // 4x4 or 6x2
  }

  if (hasRichActions || componentCount >= 3) {
    return "medium"; // 4x2
  }

  return "medium";
}

/**
 * 测算组件能力与任务需求的交集匹配度得分 (0 - 100)
 *
 * 两侧都会先经能力分类法归一化：历史别名、LLM 自由拼写都会被映射到规范 ID，
 * 无法识别的输入计入分母并扣分（而不是静默当成不匹配），以暴露词表漂移。
 */
export function matchCapabilitiesScore(supportedCaps: string[], neededCaps: string[]): number {
  if (!supportedCaps || supportedCaps.length === 0 || !neededCaps || neededCaps.length === 0) {
    return 0;
  }

  const supported = new Set<string>(normalizeCapabilities(supportedCaps).canonical);
  const needed = normalizeCapabilities(neededCaps);

  if (needed.canonical.length === 0) {
    return 0;
  }

  let matchCount = 0;
  for (const need of needed.canonical) {
    if (supported.has(need)) {
      matchCount += 1;
    }
  }

  // 分母采用需求总数（含无法识别的项），识别不了的词表会拉低得分而非被忽略
  const denominator = needed.canonical.length + needed.unmapped.length;
  return Math.round((matchCount / denominator) * 100);
}

/**
 * 两个能力集合的规范 ID 交集（供诊断与调试使用）
 */
export function intersectCapabilities(a: string[], b: string[]): CanonicalCapability[] {
  const setB = new Set<string>(normalizeCapabilities(b).canonical);
  return normalizeCapabilities(a).canonical.filter((cap) => setB.has(cap));
}

/** 规范能力总数，便于回归护栏断言词表未意外膨胀 */
export const CANONICAL_CAPABILITY_COUNT = CANONICAL_CAPABILITIES.length;
