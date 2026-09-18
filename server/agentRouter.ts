import type { AgentIntent, CustomCardArchetype, ResultWidgetKey } from "../src/types.js";
import type { CandidateWidget } from "../src/widgets/widgetContract.js";

/**
 * 意图路由配置 (Intent Routing Matrix)
 * 明确约束每种意图的白名单、黑名单（硬过滤）、必选组件及数据预期
 */
export interface IntentRouteConfig {
  intent: AgentIntent;
  description: string;
  allowedWidgets: ResultWidgetKey[];
  forbiddenWidgets: ResultWidgetKey[];
  mandatoryWidgets: ResultWidgetKey[];
  requiresImages: boolean;
  recommendedArchetype?: CustomCardArchetype;
  defaultCapabilities: string[];
}

/**
 * 规范化意图映射（将别名/历史意图统一收敛至标准 AgentIntent）
 */
const INTENT_ALIAS_MAP: Record<string, AgentIntent> = {
  install: "software_download",
  download: "software_download",
  software: "software_download",
  compare: "tech_comparison",
  comparison: "tech_comparison",
  tutorial: "study_tutorial",
  guide: "study_tutorial",
  explain: "concept_explanation",
  explanation: "concept_explanation",
  definition: "concept_explanation",
  weather: "weather",
  translation: "translation",
  translate: "translation",
  troubleshooting: "troubleshooting",
  error: "troubleshooting",
  fix: "troubleshooting",
  resource_search: "resource_search",
  image: "resource_search",
  images: "resource_search",
  study_tutorial: "study_tutorial",
  github_project: "github_project",
  github: "github_project",
  tech_comparison: "tech_comparison",
  portal_navigation: "portal_navigation",
  official: "portal_navigation",
  search_engine_portal: "search_engine_portal",
  search_engine: "search_engine_portal",
  concept_explanation: "concept_explanation",
  general_knowledge: "general_knowledge",
  travel: "travel",
  trip: "travel",
  research: "research",
  deep_research: "research",
  tool_discovery: "tool_discovery",
  tools: "tool_discovery"
};

/**
 * 归一化意图字符串为标准 AgentIntent
 */
export function normalizeIntent(rawIntent?: string): AgentIntent {
  if (!rawIntent) return "general_knowledge";
  const clean = rawIntent.toLowerCase().trim();
  return INTENT_ALIAS_MAP[clean] || "general_knowledge";
}

/**
 * 权威意图路由决策矩阵 (Authoritative Routing Table)
 * 核心哲学：规则管能不能上（Hard Filter），算法管该不该上（Scorer），LLM管为什么上（Selector），校验器管最终验收（Validator）
 */
export const INTENT_ROUTING_TABLE: Record<AgentIntent, IntentRouteConfig> = {
  weather: {
    intent: "weather",
    description: "实时天气、气温预报、空气质量与出行指数",
    allowedWidgets: ["weather", "ai_answer", "related_links", "sources", "token_usage"],
    forbiddenWidgets: [
      "translation",
      "troubleshooting",
      "comparison",
      "actions_toolbox",
      "verification_checklist",
      "mindmap",
      "image_gallery"
    ],
    mandatoryWidgets: ["weather"],
    requiresImages: false,
    defaultCapabilities: ["weather_current", "weather_forecast", "weather_indices", "air_quality", "clothing_advice"]
  },

  translation: {
    intent: "translation",
    description: "多语言智能翻译、双语词典释义、发音与例句对照",
    allowedWidgets: ["translation", "ai_answer", "related_links", "sources", "takeaways", "token_usage"],
    forbiddenWidgets: [
      "weather",
      "troubleshooting",
      "comparison",
      "actions_toolbox",
      "verification_checklist",
      "mindmap",
      "image_gallery"
    ],
    mandatoryWidgets: ["translation"],
    requiresImages: false,
    defaultCapabilities: ["language_translation", "text_translation", "bilingual_comparison", "pronunciation_guide", "dictionary_lookup"]
  },

  troubleshooting: {
    intent: "troubleshooting",
    description: "错误现象分析、根因诊断、分步修复指令与交互式验证清单",
    allowedWidgets: [
      "troubleshooting",
      "code_playground",
      "actions_toolbox",
      "verification_checklist",
      "ai_answer",
      "related_links",
      "sources",
      "takeaways",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["troubleshooting"],
    requiresImages: false,
    defaultCapabilities: ["error_diagnosis", "fix_command", "troubleshooting_audit", "verification_checklist", "cli_execution"]
  },

  software_download: {
    intent: "software_download",
    description: "软件官方下载枢纽、多平台安装包、包管理器命令与系统要求",
    allowedWidgets: [
      "software_info",
      "download",
      "release_history",
      "repository",
      "tool_discovery",
      "actions_toolbox",
      "related_links",
      "verification_checklist",
      "ai_answer",
      "sources",
      "takeaways",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["software_info", "download"],
    requiresImages: false,
    defaultCapabilities: ["software_info", "download", "releases", "install_command", "official_site"]
  },

  tech_comparison: {
    intent: "tech_comparison",
    description: "技术方案/产品多维参数横向评测、优缺点对比与选型裁决",
    allowedWidgets: [
      "comparison",
      "trend_chart",
      "tool_discovery",
      "ai_answer",
      "takeaways",
      "sources",
      "mindmap",
      "related_links",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["comparison"],
    requiresImages: false,
    defaultCapabilities: ["compare_table", "feature_matrix", "cross_compare", "dimension_pk", "pros_cons"]
  },

  resource_search: {
    intent: "resource_search",
    description: "素材预览、图片图集、视觉参考与资源聚合",
    allowedWidgets: [
      "image_gallery",
      "ai_answer",
      "related_links",
      "takeaways",
      "sources",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "troubleshooting"],
    mandatoryWidgets: ["image_gallery"],
    requiresImages: true,
    defaultCapabilities: ["image_gallery", "resource_preview", "resource_search"]
  },

  study_tutorial: {
    intent: "study_tutorial",
    description: "循序渐进教程、实操代码、阶段演进与架构导图",
    allowedWidgets: [
      "code_playground",
      "document_preview",
      "repository",
      "actions_toolbox",
      "ai_answer",
      "mindmap",
      "sources",
      "takeaways",
      "related_links",
      "verification_checklist",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["ai_answer"],
    requiresImages: false,
    defaultCapabilities: ["roadmap_step", "code_snippet", "core_principles"]
  },

  travel: {
    intent: "travel",
    description: "分天行程路线规划、必去景点、天气实况与旅行预算",
    allowedWidgets: [
      "map",
      "image_gallery",
      "weather",
      "ai_answer",
      "related_links",
      "takeaways",
      "sources",
      "token_usage"
    ],
    forbiddenWidgets: ["troubleshooting", "translation"],
    mandatoryWidgets: ["map"],
    requiresImages: false,
    defaultCapabilities: ["location_map", "attractions_map", "itinerary_timeline", "travel_budget", "weather_forecast", "resource_preview"]
  },

  portal_navigation: {
    intent: "portal_navigation",
    description: "官方网站/主入口/认证平台精准直达与导航",
    allowedWidgets: [
      "related_links",
      "ai_answer",
      "search_engine",
      "takeaways",
      "sources",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "troubleshooting", "image_gallery"],
    mandatoryWidgets: ["related_links"],
    requiresImages: false,
    defaultCapabilities: ["official_site", "authoritative_entry", "verified_docs", "quick_links"]
  },

  search_engine_portal: {
    intent: "search_engine_portal",
    description: "外部主流搜索引擎快捷检索与跳转",
    allowedWidgets: [
      "search_engine",
      "related_links",
      "ai_answer",
      "takeaways",
      "sources",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "troubleshooting", "image_gallery"],
    mandatoryWidgets: ["search_engine"],
    requiresImages: false,
    defaultCapabilities: ["search_engine_redirect", "external_search_query", "web_search_portal"]
  },

  github_project: {
    intent: "github_project",
    description: "开源项目详情、Star趋势、Release下载与快速克隆指令",
    allowedWidgets: [
      "repository",
      "software_info",
      "download",
      "release_history",
      "trend_chart",
      "code_playground",
      "actions_toolbox",
      "related_links",
      "sources",
      "ai_answer",
      "takeaways",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["repository"],
    requiresImages: false,
    defaultCapabilities: ["git_clone", "software_info", "download", "install_command", "official_site"]
  },

  concept_explanation: {
    intent: "concept_explanation",
    description: "核心概念剖析、底层原理阐释与认知拓扑导图",
    allowedWidgets: [
      "document_preview",
      "code_playground",
      "ai_answer",
      "takeaways",
      "mindmap",
      "sources",
      "related_links",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "troubleshooting", "image_gallery"],
    mandatoryWidgets: ["ai_answer"],
    requiresImages: false,
    defaultCapabilities: ["direct_answer", "concept_definition", "core_principles", "knowledge_topology"]
  },

  general_knowledge: {
    intent: "general_knowledge",
    description: "全网多信源综合问答、要点提炼与引文溯源",
    allowedWidgets: [
      "news_feed",
      "document_preview",
      "map",
      "ai_answer",
      "takeaways",
      "sources",
      "related_links",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "troubleshooting", "image_gallery"],
    mandatoryWidgets: ["ai_answer"],
    requiresImages: false,
    defaultCapabilities: ["direct_answer", "summary_points", "bullet_conclusions", "evidence_chain"]
  },

  research: {
    intent: "research",
    description: "深度行业研报、产业链图谱、横向对比与权威信源存证",
    allowedWidgets: [
      "document_preview",
      "trend_chart",
      "news_feed",
      "ai_answer",
      "takeaways",
      "sources",
      "comparison",
      "mindmap",
      "related_links",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "troubleshooting", "image_gallery"],
    mandatoryWidgets: ["ai_answer", "sources"],
    requiresImages: false,
    defaultCapabilities: ["overview_synthesis", "bullet_conclusions", "evidence_chain", "literature_archive", "token_metrics"]
  },

  tool_discovery: {
    intent: "tool_discovery",
    description: "实用工具筛选矩阵、在线体验沙盒与选型评价",
    allowedWidgets: [
      "tool_discovery",
      "software_info",
      "download",
      "actions_toolbox",
      "related_links",
      "ai_answer",
      "sources",
      "takeaways",
      "search_engine",
      "token_usage"
    ],
    forbiddenWidgets: ["weather", "translation", "troubleshooting", "image_gallery"],
    mandatoryWidgets: ["tool_discovery"],
    requiresImages: false,
    defaultCapabilities: ["tool_discovery", "try_online", "software_info", "quick_links"]
  },

  // 兼容别名回退
  install: {
    intent: "software_download",
    description: "软件安装与下载",
    allowedWidgets: ["actions_toolbox", "related_links", "verification_checklist", "ai_answer", "sources", "takeaways", "token_usage"],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["actions_toolbox"],
    requiresImages: false,
    defaultCapabilities: ["software_info", "download", "releases", "install_command", "official_site"]
  },

  compare: {
    intent: "tech_comparison",
    description: "多方案对比与选型",
    allowedWidgets: ["comparison", "ai_answer", "takeaways", "sources", "mindmap", "related_links", "token_usage"],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["comparison"],
    requiresImages: false,
    defaultCapabilities: ["compare_table", "feature_matrix", "cross_compare", "dimension_pk", "pros_cons"]
  },

  tutorial: {
    intent: "study_tutorial",
    description: "操作教程与学习指南",
    allowedWidgets: ["actions_toolbox", "ai_answer", "mindmap", "sources", "takeaways", "related_links", "verification_checklist", "token_usage"],
    forbiddenWidgets: ["weather", "translation", "image_gallery"],
    mandatoryWidgets: ["ai_answer"],
    requiresImages: false,
    defaultCapabilities: ["roadmap_step", "code_snippet", "core_principles"]
  },

  explain: {
    intent: "concept_explanation",
    description: "概念解释与原理",
    allowedWidgets: ["ai_answer", "takeaways", "mindmap", "sources", "related_links", "token_usage"],
    forbiddenWidgets: ["weather", "translation", "troubleshooting", "image_gallery"],
    mandatoryWidgets: ["ai_answer"],
    requiresImages: false,
    defaultCapabilities: ["direct_answer", "concept_definition", "core_principles", "knowledge_topology"]
  }
};

/**
 * 获取指定意图的路由配置
 */
export function getRouteForIntent(rawIntent?: string): IntentRouteConfig {
  const canonical = normalizeIntent(rawIntent);
  return INTENT_ROUTING_TABLE[canonical] || INTENT_ROUTING_TABLE.general_knowledge;
}

/**
 * 判断某个组件在当前意图下是否被硬性禁止 (Hard Exclusion)
 */
export function isWidgetForbidden(widgetKey: ResultWidgetKey, rawIntent?: string): boolean {
  const route = getRouteForIntent(rawIntent);
  return route.forbiddenWidgets.includes(widgetKey);
}

/**
 * 判断某个组件在当前意图下是否被允许
 */
export function isWidgetAllowed(widgetKey: ResultWidgetKey, rawIntent?: string): boolean {
  const route = getRouteForIntent(rawIntent);
  if (route.forbiddenWidgets.includes(widgetKey)) return false;
  return route.allowedWidgets.includes(widgetKey);
}

/**
 * 根据路由规则对候选组件执行硬性过滤 (Hard Filtering)
 */
export function filterAllowedCandidates(
  candidates: CandidateWidget[],
  rawIntent?: string
): CandidateWidget[] {
  const route = getRouteForIntent(rawIntent);
  return candidates.filter((c) => {
    // 1. 检查黑名单
    if (route.forbiddenWidgets.includes(c.key)) {
      return false;
    }
    // 2. 检查白名单
    if (!route.allowedWidgets.includes(c.key)) {
      return false;
    }
    return true;
  });
}
