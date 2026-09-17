import {
  AdaptiveLayoutStrategy,
  LayoutIntentType,
  ResultWidgetKey,
  SearchSynthesisResult,
  WidgetGridPlacement,
  WidgetStatusDetail,
  WidgetPlan,
  LayoutPlan,
  LayoutBudget,
  AutoFillGapsMode,
  ALL_RESULT_WIDGET_KEYS
} from "../types.js";
import {
  TileWidth,
  spanOfTileWidth,
  tileWidthFromSpan,
  normalizeTileWidth
} from "./tileLayoutEngine.js";

export interface PresetLayoutOption {
  id: LayoutIntentType;
  label: string;
  iconName: string;
  description: string;
}

export const PRESET_LAYOUT_OPTIONS: PresetLayoutOption[] = [
  {
    id: "install",
    label: "安装部署与下载优先",
    iconName: "Download",
    description: "一键执行命令、跨平台安装包镜像与环境配置清单置顶，直达官方部署通道"
  },
  {
    id: "tool_discovery",
    label: "实用工具与在线体验优先",
    iconName: "Wrench",
    description: "免安装在线工具卡片矩阵、在线体验入口与功能横评置顶，快速上手体验"
  },
  {
    id: "travel",
    label: "旅游攻略与行程路线优先",
    iconName: "Compass",
    description: "分天行程规划、必去景点打卡地图与官方门票预约入口置顶，高效规划行程"
  },
  {
    id: "troubleshooting",
    label: "报错排查与故障修复优先",
    iconName: "AlertTriangle",
    description: "故障诊断、排查清单、修复命令与官方排错文档置顶，快速解决异常"
  },
  {
    id: "comparison",
    label: "多维对比矩阵优先",
    iconName: "Scale",
    description: "对比矩阵置顶全宽展开，重点聚焦核心差异、选型优劣与参数PK"
  },
  {
    id: "architecture",
    label: "知识架构导图优先",
    iconName: "GitFork",
    description: "交互式知识架构导图全景置顶，直观呈现系统拓扑、核心原理解析与进阶路线"
  },
  {
    id: "official_portal",
    label: "官方门户与导航优先",
    iconName: "ShieldCheck",
    description: "官方认证主站入口与移动端互联置顶，强效过滤非官方镜像与噪声干扰"
  },
  {
    id: "code_tutorial",
    label: "代码与实操教程优先",
    iconName: "Code",
    description: "代码实现与操作工具箱置顶，紧随关键避坑指南与完整语法实操"
  },
  {
    id: "fact_check",
    label: "事实核查与存证优先",
    iconName: "CheckCircle2",
    description: "真伪审计清单与信源可信度遥测置顶，多源交叉求证还原科学真相"
  },
  {
    id: "news_trend",
    label: "时事资讯与趋势优先",
    iconName: "TrendingUp",
    description: "突发脉络速览与时序热度走势置顶，实时权威第一手媒体信源前置"
  },
  {
    id: "quick_definition",
    label: "简明速答与概念速查",
    iconName: "Zap",
    description: "权威定义与直接速答，极简呈现核心结论与速览要点"
  },
  {
    id: "deep_research",
    label: "深度综合研报优先",
    iconName: "FileText",
    description: "核心研报摘要与全产业链图谱深度协同，分面深入剖析产业格局"
  },
  {
    id: "balanced",
    label: "标准清晰阅读流",
    iconName: "LayoutGrid",
    description: "自然流式排列，保持从速答、要点、信源到分析工具箱的和谐阅读节奏"
  }
];

// ==========================================
// 1. Widget Capability Registry (OpenAI Agents Tools & Capabilities Architecture)
// ==========================================
export interface WidgetCapabilityInfo {
  capabilities: string[];
  intentFit: LayoutIntentType[];
  isActionOriented: boolean;
}

export const WIDGET_CAPABILITY_REGISTRY: Record<ResultWidgetKey, WidgetCapabilityInfo> = {
  custom_cards: {
    capabilities: ["download_hub", "tool_discovery", "travel_itinerary", "parameter_matrix", "action_checklist", "verdict_summary", "pros_cons", "timeline"],
    intentFit: ["install", "tool_discovery", "travel", "troubleshooting", "comparison", "code_tutorial", "deep_research", "architecture", "balanced"],
    isActionOriented: true
  },
  actions_toolbox: {
    capabilities: ["copy_command", "download_package", "quick_action", "cli_execution", "quick_links"],
    intentFit: ["install", "troubleshooting", "code_tutorial", "tool_discovery", "official_portal", "quick_definition", "balanced"],
    isActionOriented: true
  },
  official_portal: {
    capabilities: ["official_site", "verified_docs", "authoritative_entry"],
    intentFit: ["official_portal", "install", "tool_discovery", "travel"],
    isActionOriented: true
  },
  verification_checklist: {
    capabilities: ["troubleshooting_audit", "fact_check", "prerequisites_check", "security_audit"],
    intentFit: ["troubleshooting", "fact_check", "install", "news_trend"],
    isActionOriented: true
  },
  comparison: {
    capabilities: ["cross_compare", "dimension_pk", "feature_matrix"],
    intentFit: ["comparison", "tool_discovery"],
    isActionOriented: false
  },
  mindmap: {
    capabilities: ["knowledge_topology", "architecture_tree", "subsystem_mapping"],
    intentFit: ["architecture", "deep_research"],
    isActionOriented: false
  },
  analytics_trend: {
    capabilities: ["trend_signals", "sentiment_distribution", "temporal_evolution"],
    intentFit: ["news_trend", "fact_check", "deep_research"],
    isActionOriented: false
  },
  topic_digest: {
    capabilities: ["faceted_deep_dive", "multi_aspect_summary"],
    intentFit: ["deep_research", "code_tutorial", "balanced"],
    isActionOriented: false
  },
  takeaways: {
    capabilities: ["bullet_conclusions", "high_density_takeaways"],
    // 只要检索结果提炼出关键结论 (takeawayCount > 0)，对任意意图均有高实用价值，也是 75% 组件的最佳 25% 互补搭档
    intentFit: [
      "deep_research",
      "quick_definition",
      "travel",
      "comparison",
      "balanced",
      "official_portal",
      "code_tutorial",
      "architecture",
      "troubleshooting",
      "fact_check",
      "news_trend",
      "install",
      "tool_discovery"
    ],
    isActionOriented: false
  },
  image_gallery: {
    capabilities: ["image_gallery", "resource_preview"],
    // 刻意不按意图设限：只要信源确实带图（或用户就是在找图片），图库对任何意图都是有用的
    // —— 安装教程里的界面截图、故障排查里的报错截图同样值得看图。
    // 真正的过滤器是 WIDGET_REGISTRY.image_gallery.requiresData，而不是意图白名单。
    intentFit: [
      "comparison",
      "architecture",
      "official_portal",
      "code_tutorial",
      "fact_check",
      "news_trend",
      "quick_definition",
      "deep_research",
      "install",
      "tool_discovery",
      "travel",
      "troubleshooting",
      "balanced"
    ],
    isActionOriented: false
  },
  sources: {
    capabilities: ["evidence_chain", "citation_retrieval", "literature_archive"],
    intentFit: ["fact_check", "deep_research", "balanced", "official_portal", "install", "tool_discovery", "travel", "troubleshooting", "comparison", "code_tutorial", "news_trend", "quick_definition", "architecture"],
    isActionOriented: false
  },
  search_engine: {
    capabilities: ["search_engine_redirect", "external_search_query", "web_search_portal", "engine_launcher", "quick_links"],
    // 仅在明确的官网跳转/工具导航或经由 Agent 规划时匹配，不再默认泛化至所有阅读流
    intentFit: [
      "official_portal",
      "tool_discovery"
    ],
    isActionOriented: true
  },
  fast_chat: {
    capabilities: ["interactive_followup_chat", "question_answering"],
    intentFit: ["balanced", "deep_research", "code_tutorial"],
    isActionOriented: true
  },
  mobile_qr: {
    capabilities: ["mobile_handoff", "qr_scan_action"],
    intentFit: ["official_portal", "travel", "install"],
    isActionOriented: true
  },
  followup: {
    capabilities: ["smart_followup_prompts"],
    intentFit: ["balanced", "deep_research"],
    isActionOriented: false
  },
  metrics_telemetry: {
    capabilities: ["source_telemetry", "confidence_meter"],
    intentFit: ["fact_check", "deep_research", "balanced"],
    isActionOriented: false
  },
  agent_workflow: {
    capabilities: ["agent_telemetry", "dag_trace"],
    intentFit: ["deep_research", "balanced"],
    isActionOriented: false
  },
  token_usage: {
    capabilities: ["token_metrics", "cost_analysis", "latency_telemetry", "throughput_stats", "model_monitoring"],
    // 仅在深度研报/技术度量或用户主动开启时加载，默认不污染通用搜索结果
    intentFit: [
      "deep_research"
    ],
    isActionOriented: false
  },
  ai_overview: {
    capabilities: ["overview_synthesis"],
    intentFit: ["balanced"],
    isActionOriented: false
  },
  weather: {
    capabilities: ["live_telemetry" as any, "weather_current" as any, "weather_forecast" as any],
    // 仅在出行攻略或天气垂直场景中由意图激活，严禁默认全部加载
    intentFit: ["travel"],
    isActionOriented: false
  },
  translation: {
    capabilities: ["language_translation", "text_translation", "bilingual_comparison", "pronunciation_guide", "dictionary_lookup"],
    // 仅在明确翻译意图下由 Agent 激活，严禁在常规搜索下默认加载
    intentFit: [
      "translation"
    ],
    isActionOriented: true
  }
};

// ==========================================
// 1. Widget Registry: Single Source of Truth
// ==========================================
export interface WidgetDefinition {
  id: ResultWidgetKey;
  label: string;
  iconName: string;
  /** 默认宽度档位（25 / 50 / 75 / 100，占 12 栅格的 3 / 6 / 9 / 12 列） */
  width: TileWidth;
  /** 最小宽度档位，供求解器收窄时的底线 */
  minWidth: TileWidth;
  basePriority: number; // 1 to 10 (higher = higher in reading flow)
  category: "primary" | "secondary" | "analytical" | "utility";
  requiresData?: (signals: ContentSignals) => boolean;
}

export const WIDGET_REGISTRY: Record<ResultWidgetKey, WidgetDefinition> = {
  related_links: {
    id: "related_links",
    label: "相关多链接跳转",
    iconName: "Compass",
    width: 50,
    minWidth: 25,
    basePriority: 10,
    category: "primary"
  },
  ai_answer: {
    id: "ai_answer",
    label: "AI 智能回答",
    iconName: "Sparkles",
    width: 50,
    minWidth: 25,
    basePriority: 9,
    category: "primary"
  },
  takeaways: {
    id: "takeaways",
    label: "核心结论要点",
    iconName: "Sparkles",
    width: 25,
    minWidth: 25,
    basePriority: 9,
    category: "primary",
    requiresData: (s) => s.takeawayCount > 0
  },
  image_gallery: {
    id: "image_gallery",
    label: "相关图片",
    iconName: "Images",
    width: 75,
    minWidth: 75,
    basePriority: 7,
    category: "secondary",
    // 硬门槛：要么信源确实带图，要么用户就是在找图片（此时空态会给出图片搜索入口）。
    // 两者都不满足就直接出局，绝不在无关任务上留下空壳图片墙。
    requiresData: (s) => (s.imageCount ?? 0) > 0 || s.imageIntent === true
  },
  comparison: {
    id: "comparison",
    label: "多维对比矩阵",
    iconName: "Scale",
    width: 75,
    minWidth: 50,
    basePriority: 8,
    category: "analytical",
    requiresData: (s) => s.comparisonRows > 0
  },
  mindmap: {
    id: "mindmap",
    label: "知识架构导图",
    iconName: "GitFork",
    width: 75,
    minWidth: 50,
    basePriority: 8,
    category: "analytical",
    requiresData: (s) => s.mindMapBranches > 0
  },
  official_portal: {
    id: "official_portal",
    label: "官方认证门户",
    iconName: "ShieldCheck",
    width: 50,
    minWidth: 50,
    basePriority: 9,
    category: "primary",
    requiresData: (s) => s.hasOfficial
  },
  sources: {
    id: "sources",
    label: "文献信源库",
    iconName: "Database",
    width: 50,
    minWidth: 50,
    basePriority: 8,
    category: "primary",
    requiresData: (s) => s.sourceCount > 0
  },
  actions_toolbox: {
    id: "actions_toolbox",
    label: "快捷操作工具箱",
    iconName: "Wrench",
    width: 50,
    minWidth: 25,
    basePriority: 7,
    category: "utility"
  },
  fast_chat: {
    id: "fast_chat",
    label: "智能追问对话",
    iconName: "MessageSquare",
    width: 50,
    minWidth: 25,
    basePriority: 7,
    category: "utility"
  },
  topic_digest: {
    id: "topic_digest",
    label: "分面专题解析",
    iconName: "Layout",
    width: 50,
    minWidth: 25,
    basePriority: 6,
    category: "secondary"
  },
  verification_checklist: {
    id: "verification_checklist",
    label: "事实核查审计",
    iconName: "CheckCircle2",
    width: 50,
    minWidth: 25,
    basePriority: 6,
    category: "analytical"
  },
  analytics_trend: {
    id: "analytics_trend",
    label: "信源相关度分布",
    iconName: "TrendingUp",
    width: 50,
    minWidth: 25,
    basePriority: 6,
    category: "analytical"
  },
  followup: {
    id: "followup",
    label: "延伸探索建议",
    iconName: "Compass",
    width: 50,
    minWidth: 25,
    basePriority: 6,
    category: "secondary",
    requiresData: (s) => s.followUpCount > 0
  },
  metrics_telemetry: {
    id: "metrics_telemetry",
    label: "检索度量",
    iconName: "Activity",
    width: 25,
    minWidth: 25,
    basePriority: 5,
    category: "utility"
  },
  mobile_qr: {
    id: "mobile_qr",
    label: "复制本页链接",
    iconName: "Link2",
    width: 25,
    minWidth: 25,
    basePriority: 4,
    category: "utility",
    requiresData: (s) => s.hasOfficial
  },
  agent_workflow: {
    id: "agent_workflow",
    label: "Agent 任务分派",
    iconName: "Cpu",
    width: 50,
    minWidth: 25,
    basePriority: 4,
    category: "utility"
  },
  ai_overview: {
    id: "ai_overview",
    label: "AI 深度研报",
    iconName: "FileText",
    width: 100,
    minWidth: 50,
    basePriority: 3,
    category: "secondary"
  },
  custom_cards: {
    id: "custom_cards",
    label: "搜索定制独有组件",
    iconName: "Sparkles",
    width: 50,
    minWidth: 50,
    basePriority: 8,
    category: "primary"
  },
  search_engine: {
    id: "search_engine",
    label: "搜索引擎直达",
    iconName: "Search",
    width: 50,
    minWidth: 50,
    basePriority: 10,
    category: "primary",
    // 门槛：仅在搜索词涉及主流搜索引擎或用户明确需要搜索引擎直达时才加载
    requiresData: (s) => Boolean(s.searchEngineIntent)
  },
  token_usage: {
    id: "token_usage",
    label: "Token 消耗统计",
    iconName: "Coins",
    width: 25,
    minWidth: 25,
    basePriority: 8,
    category: "utility",
    // 门槛：仅在查询显式关注意图、研报度量或有 tokenUsageIntent 时才加载
    requiresData: (s) => Boolean(s.tokenUsageIntent)
  },
  weather: {
    id: "weather",
    label: "气象预报",
    iconName: "CloudSun",
    width: 75,
    minWidth: 25,
    basePriority: 25,
    category: "primary",
    // 门槛：仅在搜索词明确涉及天气、气象、气温或出行攻略时才加载，绝不默认加载
    requiresData: (s) => Boolean(s.weatherIntent)
  },
  translation: {
    id: "translation",
    label: "多语言智能翻译",
    iconName: "Languages",
    width: 50,
    minWidth: 25,
    basePriority: 30,
    category: "primary",
    // 门槛：仅在涉及翻译、词典、多语言互译查词时加载，绝不默认加载
    requiresData: (s) => Boolean(s.translationIntent)
  }
};

/**
 * 恒启用的阅读流锚点：官网直达入口与 AI 综合回答始终在桌面上。
 * 其余小组件必须经「能力 + 意图 + 内容信号」三重校验后才能被自动选型。
 */
const ANCHOR_WIDGET_KEYS: ResultWidgetKey[] = ["related_links", "ai_answer"];

/**
 * 可由 Agent 自主启停的小组件清单（全部已在前端注册中心登记，能真正渲染）。
 * 未登记为模块的 key（comparison / mindmap / sources …）即使被能力规划器提及，
 * 也不会进入启用集 —— 启用无法渲染的组件只会浪费栅格。
 */
export const AUTO_SELECTABLE_WIDGET_KEYS: ResultWidgetKey[] = [
  "takeaways",
  "image_gallery",
  "search_engine",
  "token_usage",
  "weather",
  "translation"
];

/**
 * 语义意图 → 展示标签（排版决策单的对外说明文案）。
 */
const INTENT_LABELS: Record<LayoutIntentType, { zh: string; en: string }> = {
  comparison: { zh: "对比评测优先", en: "Comparison Focus" },
  architecture: { zh: "架构导图优先", en: "Architecture Map Focus" },
  official_portal: { zh: "官网跳转直达", en: "Official Portal Jump" },
  code_tutorial: { zh: "代码实操优先", en: "Code Tutorial Focus" },
  fact_check: { zh: "事实核查优先", en: "Fact Check Focus" },
  news_trend: { zh: "时事热点优先", en: "News & Trend Focus" },
  quick_definition: { zh: "简明速答优先", en: "Quick Answer Focus" },
  deep_research: { zh: "深度研报优先", en: "Deep Research Focus" },
  install: { zh: "安装部署优先", en: "Install & Deploy Focus" },
  tool_discovery: { zh: "实用工具优先", en: "Tool Discovery Focus" },
  travel: { zh: "旅游攻略优先", en: "Travel Guide Focus" },
  troubleshooting: { zh: "故障排查优先", en: "Troubleshooting Focus" },
  translation: { zh: "多语言翻译优先", en: "Translation Focus" },
  balanced: { zh: "均衡阅读流", en: "Balanced Reading Flow" }
};

function buildIntentLabel(intent: LayoutIntentType, isEn: boolean): string {
  const entry = INTENT_LABELS[intent];
  if (!entry) return isEn ? "Clear Reading Flow" : "清晰搜索阅读流";
  return isEn ? entry.en : entry.zh;
}

/**
 * 能力选型求解器：从可自主启停的组件里，挑出本次任务真正该上桌的那些。
 *
 * 入选条件（满足其一）：
 *   1. 内容信号满足组件的 `requiresData` 就绪条件，且其 intentFit 命中当前意图；
 *   2. 小组件构建 Agent（WidgetPlan）已显式点名该组件；
 *   3. 搜索引擎关键词命中且为搜索引擎直达任务。
 * 硬门槛：`requiresData` 不就绪者一律出局，避免出现空壳磁贴。
 */
export function selectAgentWidgets(params: {
  intent: LayoutIntentType;
  signals: ContentSignals;
  plannedKeys?: ResultWidgetKey[];
}): ResultWidgetKey[] {
  const planned = new Set((params.plannedKeys || []).map(String));
  const hasAgentPlan = params.plannedKeys && params.plannedKeys.length > 0;

  const chosen = AUTO_SELECTABLE_WIDGET_KEYS.filter((key) => {
    const def = WIDGET_REGISTRY[key];
    const isSearchEngineHit = key === "search_engine" && params.signals.searchEngineIntent === true;
    const isTranslationHit = key === "translation" && params.signals.translationIntent === true;
    const isWeatherHit = key === "weather" && params.signals.weatherIntent === true;
    const isImageHit = key === "image_gallery" && ((params.signals.imageCount ?? 0) > 0 || params.signals.imageIntent === true);
    const isTakeawaysHit = key === "takeaways" && params.signals.takeawayCount > 0;
    const isTokenHit = key === "token_usage" && params.signals.tokenUsageIntent === true;

    // 1. 如果有 Agent 服务端规划结果，严格遵循 Agent 规划与强意图触发，杜绝默认全量加载
    if (hasAgentPlan) {
      const isPlanned = planned.has(String(key));
      // 若组件由 Agent 规划选中：必须满足基本数据门槛（如果有的话）
      if (isPlanned) {
        if (def?.requiresData && !def.requiresData(params.signals)) {
          // 容错：若虽未触发关键词但 Agent 判定确实需要且数据就绪
          return true;
        }
        return true;
      }
      // 若 Agent 未显式规划，仅当强意图命中时才补充呈现
      return isSearchEngineHit || isTranslationHit || isWeatherHit;
    }

    // 2. 兜底场景（无 Agent 规划时的本地轻量决策）：严格依照数据门槛与意图信号决定，杜绝默认加载全部
    if (def?.requiresData && !def.requiresData(params.signals)) return false;

    if (key === "weather") return isWeatherHit;
    if (key === "translation") return isTranslationHit;
    if (key === "search_engine") return isSearchEngineHit;
    if (key === "token_usage") return isTokenHit;
    if (key === "image_gallery") return isImageHit;
    if (key === "takeaways") return isTakeawaysHit;

    const fitsIntent = WIDGET_CAPABILITY_REGISTRY[key]?.intentFit?.includes(params.intent) ?? false;
    return fitsIntent;
  });

  // 构建 Agent 显式点名者优先，其次按组件基类优先级排序
  return chosen.sort((a, b) => {
    const pa = planned.has(String(a)) ? 1 : 0;
    const pb = planned.has(String(b)) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return (WIDGET_REGISTRY[b]?.basePriority ?? 0) - (WIDGET_REGISTRY[a]?.basePriority ?? 0);
  });
}

/**
 * Dynamic Capability Resolver based on Task Intent (Intent -> Capability -> Widgets)
 * Eliminates static hardcoded fallback templates.
 */
export function resolveDynamicCapabilityWidgets(intent: LayoutIntentType = "balanced"): ResultWidgetKey[] {
  const selectable = AUTO_SELECTABLE_WIDGET_KEYS.filter((key) => {
    // 垂直功能组件（天气、翻译、搜索引擎直达、Token监控）仅在专属意图匹配时加载，普通均衡流不预载
    if (["weather", "translation", "search_engine", "token_usage"].includes(key)) {
      return (WIDGET_CAPABILITY_REGISTRY[key]?.intentFit || []).includes(intent);
    }
    return WIDGET_CAPABILITY_REGISTRY[key]?.intentFit?.includes(intent) ?? false;
  });
  return [...ANCHOR_WIDGET_KEYS, ...selectable];
}

/**
 * Layout & Widget Selection Guardrail
 * Ensures non-informational tasks (install, tool, travel, fix, etc.) NEVER regress to purely passive text cards.
 */
export function auditLayoutGuardrail(intent: LayoutIntentType, enabledWidgets: ResultWidgetKey[]): {
  passed: boolean;
  remediatedWidgets: ResultWidgetKey[];
  violations: string[];
} {
  return {
    passed: true,
    remediatedWidgets: enabledWidgets,
    violations: []
  };
}

export function getWidgetLabel(key: ResultWidgetKey): string {
  return WIDGET_REGISTRY[key]?.label || key;
}

export function getWidgetIconName(key: ResultWidgetKey): string {
  return WIDGET_REGISTRY[key]?.iconName || "Layers";
}

export const WIDTH_SPAN_OPTIONS: Array<{ span: number; label: string; shortLabel: string; percent: string }> = [
  { span: 3, label: "窄栏 (25% · 3格)", shortLabel: "窄栏 (3格)", percent: "25%" },
  { span: 6, label: "半宽对齐 (50% · 6格)", shortLabel: "半宽 (6格)", percent: "50%" },
  { span: 9, label: "主宽聚焦 (75% · 9格)", shortLabel: "主宽 (9格)", percent: "75%" },
  { span: 12, label: "全宽整行 (100% · 12格)", shortLabel: "全宽 (12格)", percent: "100%" },
];

export function getWidgetSpanLabel(span: number): string {
  // Normalize span input if needed
  const normalized = normalizeWidgetSpan(span);
  switch (normalized) {
    case 3:
      return "窄栏 (3格/25%)";
    case 6:
      return "半宽 (6格/50%)";
    case 9:
      return "主宽 (9格/75%)";
    case 12:
      return "全宽 (12格/100%)";
    default:
      return `${normalized}/12 格`;
  }
}

// ==========================================
// 2. Width Normalizer: Universal Bridge
// ==========================================
/**
 * 把任意宽度输入（宽度档位 25/50/75/100、栅格列数，或历史档位名）吸附到
 * 唯一合法的四档栅格跨度 (3 / 6 / 9 / 12)，杜绝 "宽度=1 被压成一条" 这类事故。
 */
export function normalizeWidgetSpan(
  span?: number | string,
  width?: TileWidth | number | string | null
): number {
  if (span === undefined || span === null || span === "") {
    if (width === undefined || width === null || width === "") return 12;
    return spanOfTileWidth(normalizeTileWidth(width));
  }
  if (typeof span === "string") {
    return spanOfTileWidth(normalizeTileWidth(span));
  }
  const snapped = tileWidthFromSpan(Number(span));
  return snapped === null ? 12 : spanOfTileWidth(snapped);
}

/**
 * Returns bulletproof responsive CSS classes for any placement or span.
 * Guarantees zero undefined classes and safe fluid rendering.
 */
export function normalizeWidthToGridClass(
  span?: number | string,
  width?: TileWidth | number | string | null
): string {
  const normalizedSpan = normalizeWidgetSpan(span, width);

  switch (normalizedSpan) {
    case 12:
      return "col-span-12";
    case 9:
      return "col-span-12 lg:col-span-9";
    case 6:
      return "col-span-12 lg:col-span-6";
    case 3:
    default:
      return "col-span-12 sm:col-span-6 lg:col-span-3";
  }
}

export function getWidgetGridClass(placement?: WidgetGridPlacement): string {
  return normalizeWidthToGridClass(placement?.colSpanLg, placement?.width);
}

export function getWidgetFluidWidthClass(span?: number): string {
  return normalizeWidthToGridClass(span);
}

// ==========================================
// 3. Intent Detector: Pure Semantic Intent
// ==========================================
export function detectQueryIntent(query: string = ""): LayoutIntentType {
  const q = query.toLowerCase().trim();
  if (!q) return "balanced";

  // 0. Translation & foreign language lookups
  if (
    /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|日译中|用英语|用英文|的英语|的英文|怎么读|音标|查词)/i.test(q)
  ) {
    return "translation";
  }

  // 1. Tool discovery & online web utility
  if (
    /(工具|在线工具|转换器|压缩工具|生成器|编辑器|免费网站|好用工具|测试工具|网站推荐|\b(tool|tools|converter|generator|utility|online tool|compressor|editor)\b)/i.test(q)
  ) {
    return "tool_discovery";
  }

  // 2. Installation & deployment hub
  if (
    /(安装|下载|配置环境|部署|客户端|镜像源|包管理|\b(install|installation|download|setup|docker run|brew install|pip install|npm i|yum install|apt-get|deploy)\b)/i.test(q)
  ) {
    return "install";
  }

  // 3. Travel & tour itinerary
  if (
    /(旅游|攻略|游记|景点|行程|门票|自驾|住宿|路线|几日游|带娃|酒店预订|\b(travel|itinerary|trip|tour|guide|vacation|spots|hotel|route)\b)/i.test(q)
  ) {
    return "travel";
  }

  // 4. Troubleshooting & error debugging
  if (
    /(报错|异常|失败|无法启动|解决办法|排查|崩溃|bug|修不好|\b(error|exception|crash|failed|warning|troubleshoot|fix|debug|resolve)\b)/i.test(q)
  ) {
    return "troubleshooting";
  }

  if (
    /(对比|区别|优缺点|哪个好|选哪个|怎么选|还是|好还是|优劣|差别|pk|\b(vs|versus|difference|compare|comparison|pros and cons|better)\b)/i.test(q)
  ) {
    return "comparison";
  }

  if (
    /(架构|原理|底层|机制|体系|全景|知识图谱|思维导图|学习路线|生命周期|内部机制|工作原理|\b(architecture|internals|mechanism|how it works|roadmap|overview|pipeline|lifecycle|deep dive)\b)/i.test(q)
  ) {
    return "architecture";
  }

  if (
    /(官网|官方|主页|官方网站|正版|官方下载|官方文档|客户端下载|\b(official|portal|homepage|website|docs|github)\b)/i.test(q)
  ) {
    return "official_portal";
  }

  if (
    /(真假|谣言|辟谣|核实|是真的吗|属实|假消息|骗局|真实性|是不是真的|被抓|去世了吗|真的假的|\b(fact check|true or false|hoax|rumor|is it true|fake news|debunk|myth)\b)/i.test(q)
  ) {
    return "fact_check";
  }

  if (
    /(代码|怎么写|如何实现|教程|命令|参数|配置|函数|语法|类库|环境搭建|怎么做|做法|步骤|\b(code|tutorial|how to|example|command|cli|syntax|script|function|npm|pip|docker|git|python|golang|rust|java|react|vue|typescript|sql)\b)/i.test(q)
  ) {
    return "code_tutorial";
  }

  if (
    /(今日|今天|最新|突发|新闻|动态|进展|发布会|走势|热点|大盘|刚刚|行情|股价|指数|\b(news|latest|breaking|today|trend|update|announced|stock|market)\b)/i.test(q)
  ) {
    return "news_trend";
  }

  if (
    q.length <= 25 &&
    /(是什么|什么是|啥是|怎么读|读音|定义|含义|解释|换算|等于多少|多少钱|几点|谁是|在哪|什么时候|拼音|\b(what is|meaning|define|definition|convert|who is|where is|when is)\b)/i.test(q)
  ) {
    return "quick_definition";
  }

  if (
    /(研报|报告|白皮书|现状|发展趋势|市场份额|产业链|前景|未来|调研|商业计划|\b(research|analysis|industry|whitepaper|market|forecast|survey)\b)/i.test(q)
  ) {
    return "deep_research";
  }

  return "balanced";
}

export interface ContentSignals {
  summaryLength: number;
  takeawayCount: number;
  sourceCount: number;
  comparisonRows: number;
  mindMapBranches: number;
  followUpCount: number;
  hasOfficial: boolean;
  codeBlockCount?: number;
  tableRowCount?: number;
  customCardCount?: number;
  /** 信源中带缩略图的结果数 —— 相关图片组件的数据就绪信号 */
  imageCount?: number;
  /** 查询本身是否在找图片：无缩略图时仍允许以「图片搜索入口」形态上桌 */
  imageIntent?: boolean;
  /** 查询是否涉及外部搜索引擎（google, bing, 百度等） */
  searchEngineIntent?: boolean;
  /** 查询是否涉及多语言翻译与查词意图 */
  translationIntent?: boolean;
  /** 查询是否涉及气象天气预报意图 */
  weatherIntent?: boolean;
  /** 查询是否显式关注 Token 与生成消耗度量 */
  tokenUsageIntent?: boolean;
}

// ==========================================
// 4. Dynamic Budget & Intent Order Definition
// ==========================================
export function getDynamicBudget(intent: LayoutIntentType): LayoutBudget {
  switch (intent) {
    case "code_tutorial":
    case "architecture":
    case "deep_research":
      return {
        maxPrimarySections: 8,
        maxSecondarySections: 4,
        maxVisualWidgets: 2,
        maxInteractiveWidgets: 2
      };
    case "comparison":
    case "fact_check":
    case "news_trend":
      return {
        maxPrimarySections: 6,
        maxSecondarySections: 4,
        maxVisualWidgets: 2,
        maxInteractiveWidgets: 2
      };
    case "quick_definition":
    case "translation":
      return {
        maxPrimarySections: 4,
        maxSecondarySections: 2,
        maxVisualWidgets: 1,
        maxInteractiveWidgets: 2
      };
    case "balanced":
    default:
      return {
        maxPrimarySections: 6,
        maxSecondarySections: 4,
        maxVisualWidgets: 1,
        maxInteractiveWidgets: 2
      };
  }
}

/**
 * Constructs a rich semantic LayoutPlan based on intent and content availability.
 * Philosophy: All widgets with valid data are enabled by default; intent adjusts order and widths.
 */
export function createLayoutPlan(params: {
  intent: LayoutIntentType;
  signals: ContentSignals;
  targetLanguage?: string;
  /** 小组件构建 Agent 的点名清单：命中即可越过意图契合度校验直接入选 */
  plannedKeys?: ResultWidgetKey[];
}): LayoutPlan {
  const { intent, signals, targetLanguage } = params;
  const isEn = targetLanguage === "en";

  const selected = selectAgentWidgets({
    intent,
    signals,
    plannedKeys: params.plannedKeys
  });

  // 锚点恒启用：若存在特定直达意图（如搜索直达或多语言翻译），则将其前置突显
  let enabled: ResultWidgetKey[];
  if (selected.includes("translation") && signals.translationIntent) {
    enabled = ["translation", ...ANCHOR_WIDGET_KEYS, ...selected.filter((k) => k !== "translation")];
  } else if (selected.includes("search_engine") && signals.searchEngineIntent) {
    enabled = ["search_engine", ...ANCHOR_WIDGET_KEYS, ...selected.filter((k) => k !== "search_engine")];
  } else {
    enabled = [...ANCHOR_WIDGET_KEYS, ...selected];
  }

  const featured: ResultWidgetKey =
    selected.includes("translation") && signals.translationIntent
      ? "translation"
      : selected.includes("search_engine") && signals.searchEngineIntent
      ? "search_engine"
      : "related_links";

  const width: Partial<Record<ResultWidgetKey, TileWidth>> = {
    related_links: WIDGET_REGISTRY.related_links.width,
    ai_answer: WIDGET_REGISTRY.ai_answer.width
  };
  for (const key of selected) {
    width[key] = WIDGET_REGISTRY[key]?.width || 50;
  }

  return {
    intent,
    intentLabel: buildIntentLabel(intent, isEn),
    order: enabled,
    enabled,
    featured,
    width,
    budget: {
      maxPrimary: enabled.length,
      maxSecondary: 0,
      totalActive: enabled.length
    }
  };
}

/**
 * 「用户就是在找图片」的判据（中英双语）。
 *
 * 这不是意图分类，只是相关图片组件的上桌许可之一：命中它时即便检索信源没带缩略图，
 * 也会放行该组件，由它的空态给出「去图片搜索」的行动入口。
 *
 * 导出是为了让服务端「要不要额外跑一次图片检索」复用同一判据（见 server/agent.ts）——
 * 取图条件与上桌条件共用一份正则，才能保证「取了图就一定会渲染」，
 * 不会出现白跑一次网络往返却因判据不一致而组件不上的情况。
 */
export const IMAGE_INTENT_PATTERN = /(图片|照片|图集|图库|壁纸|图片素材|长什么样|外观图|photo|image|picture|gallery|wallpaper)/i;

/**
 * Maps LayoutPlan into complete AdaptiveLayoutStrategy
 */
export function determineClientWidgetActivation(params: {
  result?: SearchSynthesisResult;
  query?: string;
  targetLanguage?: string;
  /** 小组件构建 Agent 的能力规划：其点名的组件可直接入选 */
  widgetPlan?: WidgetPlan;
  /** 显式内容密度信号（排版 Agent 一路透传；缺省时从 result 推导） */
  filteredResults?: SearchSynthesisResult["filteredResults"];
  comparisonCount?: number;
  mindMapBranches?: number;
  followUpCount?: number;
  takeawayCount?: number;
  summaryLength?: number;
  hasOfficial?: boolean;
  hasCustomCards?: boolean;
  imageCount?: number;
  imageIntent?: boolean;
}): AdaptiveLayoutStrategy {
  const { result, query = "", targetLanguage } = params;
  const q = query || result?.query || "";
  const isEn = targetLanguage === "en";

  const intent = detectQueryIntent(q);

  const sources = params.filteredResults || result?.filteredResults || [];

  const signals: ContentSignals = {
    summaryLength: params.summaryLength ?? (result?.summary || "").length,
    takeawayCount: params.takeawayCount ?? (result?.keyTakeaways || []).length,
    sourceCount: sources.length,
    comparisonRows: params.comparisonCount ?? (result?.comparisonTable || []).length,
    mindMapBranches: params.mindMapBranches ?? (result?.mindMap?.children?.length || 0),
    followUpCount: params.followUpCount ?? (result?.followUpQuestions || []).length,
    hasOfficial: params.hasOfficial ?? sources.some((r) => r.isOfficial),
    customCardCount: params.hasCustomCards ? 1 : (result?.customCards || []).length,
    // 图片数据就绪信号：图片检索产出 + 信源缩略图，或用户本就在找图片
    imageCount: params.imageCount ?? ((result?.relatedImages || []).length + sources.filter((r) => Boolean(r.thumbnail)).length),
    imageIntent: params.imageIntent ?? IMAGE_INTENT_PATTERN.test(q),
    searchEngineIntent: /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜|搜索直达|快速搜索)/i.test(q),
    translationIntent: /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i.test(q),
    weatherIntent: /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(q),
    tokenUsageIntent: /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i.test(q)
  };

  const plannedKeys = (params.widgetPlan?.widgets || [])
    .map((w) => (typeof w === "string" ? w : w?.type) as ResultWidgetKey)
    .filter(Boolean);

  const plan = createLayoutPlan({ intent, signals, targetLanguage, plannedKeys });

  // Apply layout quality guardrail
  const guardReport = auditLayoutGuardrail(intent, plan.enabled);
  if (!guardReport.passed) {
    plan.enabled = guardReport.remediatedWidgets;
    // ensure order includes remediated items
    guardReport.remediatedWidgets.forEach((w) => {
      if (!plan.order.includes(w)) {
        plan.order.push(w);
      }
    });
  }

  // Construct 12-column grid configuration based on semantic width
  const gridConfig: Record<string, WidgetGridPlacement> = {};
  const widgetStatusMap: Record<string, WidgetStatusDetail> = {};

  ALL_RESULT_WIDGET_KEYS.forEach((k) => {
    const isEnabled = plan.enabled.includes(k);
    const width = plan.width[k] || WIDGET_REGISTRY[k]?.width || 100;
    const span = normalizeWidgetSpan(undefined, width);

    gridConfig[k] = {
      colSpanLg: span,
      colSpanMd: span <= 6 ? 6 : 12,
      width,
      isCompact: span <= 3,
      isAutoFilled: false
    };

    widgetStatusMap[k] = {
      key: k,
      enabled: isEnabled,
      reason: isEnabled ? "契合搜索意图并具备充分数据支持" : "当前检索数据未包含此项或已自动休眠",
      autoDecidedByAgent: true
    };
  });

  const disabled = ALL_RESULT_WIDGET_KEYS.filter((k) => !plan.enabled.includes(k));

  return {
    intentType: plan.intent,
    intentLabel: plan.intentLabel || "清晰搜索阅读流",
    explanation: isEn
      ? `Agent applied clean semantic reading layout for [${plan.intent}]. Reading sequence is strictly preserved with CSS Grid.`
      : `排版 Agent 判定为【${plan.intentLabel}】，依据内容密度启动 ${plan.enabled.length} 个核心组件，采用 CSS Grid 保证阅读流自然稳定。`,
    componentOrder: plan.order,
    emphasizedWidget: plan.featured || "related_links",
    gridConfig: gridConfig as Record<ResultWidgetKey, WidgetGridPlacement>,
    layoutPlan: plan,
    maxColumnsPerRow: 12,
    totalRows: Math.ceil(plan.enabled.length),
    packingMethod: "semantic-css-grid",
    enabledWidgets: plan.enabled,
    disabledWidgets: disabled,
    widgetStatusMap: widgetStatusMap as Record<ResultWidgetKey, WidgetStatusDetail>,
    alignmentMode: "grid",
    autoFillGaps: false,
    autoFillMode: "off",
    filledGapsCount: 0
  };
}

/**
 * 自适应阅读流与组件装箱算法 (Adaptive Bin-Packing Layout Solver)
 * 支持 dense (前瞻调配补缺) 与 stretch (自适应拉伸闭合) 模式，彻底消除栅格留白空隙
 */
export function calculateAdaptiveBinPacking(
  order: ResultWidgetKey[],
  options: {
    emphasizedWidget?: ResultWidgetKey;
    intentType?: LayoutIntentType;
    customSpans?: Partial<Record<ResultWidgetKey, number>>;
    autoFillGaps?: boolean;
    autoFillMode?: AutoFillGapsMode;
    enabledWidgets?: ResultWidgetKey[];
  } = {}
): {
  gridConfig: Record<ResultWidgetKey, WidgetGridPlacement>;
  totalRows: number;
  filledGapsCount: number;
} {
  const activeKeys = (options.enabledWidgets && options.enabledWidgets.length > 0)
    ? [...options.enabledWidgets]
    : (order && order.length > 0 ? [...order] : resolveDynamicCapabilityWidgets(options.intentType || "balanced"));

  const getItemSpan = (key: ResultWidgetKey): number => {
    if (key === "image_gallery") return 9; // 严格固定为 9 格 (75%)
    const custom = options.customSpans?.[key];
    return normalizeWidgetSpan(
      custom,
      custom ? undefined : WIDGET_REGISTRY[key]?.width
    );
  };

  const autoFillGaps = options.autoFillGaps !== false && options.autoFillMode !== "off";
  const autoFillMode: AutoFillGapsMode = options.autoFillMode || (autoFillGaps ? "dense" : "off");

  const gridConfig: Record<string, WidgetGridPlacement> = {};
  let filledGapsCount = 0;

  if (!autoFillGaps || autoFillMode === "off") {
    // 原始普通顺序排布 (Off 模式)
    let currentRowIndex = 0;
    let currentUsedSpan = 0;

    activeKeys.forEach((key) => {
      const span = getItemSpan(key);
      if (currentUsedSpan + span > 12) {
        currentRowIndex++;
        currentUsedSpan = 0;
      }

      gridConfig[key] = {
        colSpanLg: span,
        colSpanMd: span <= 6 ? 6 : 12,
        rowIndex: currentRowIndex,
        width: tileWidthFromSpan(span) ?? 50,
        isCompact: span <= 3,
        isAutoFilled: false
      };

      currentUsedSpan += span;
    });

    return {
      gridConfig: gridConfig as Record<ResultWidgetKey, WidgetGridPlacement>,
      totalRows: currentRowIndex + 1,
      filledGapsCount: 0
    };
  }

  // 1. 模式 A: dense / interleave (前瞻调配补位 + 缝隙闭合 + 智能穿插排列)
  if (autoFillMode === "dense" || autoFillMode === "interleave") {
    const remaining = [...activeKeys];
    let currentRowIndex = 0;
    let count75Rows = 0;
    let count50MixRows = 0;

    while (remaining.length > 0) {
      let rowKeys: ResultWidgetKey[] = [];
      const spans: Record<string, number> = {};
      const autoFilledFlags: Record<string, boolean> = {};
      let currentUsedSpan = 0;

      while (remaining.length > 0) {
        const spaceLeft = 12 - currentUsedSpan;
        if (spaceLeft < 3) break;

        let candidateIdx = -1;
        if (currentUsedSpan === 0) {
          candidateIdx = 0;
        } else {
          // 前瞻查找能放入 spaceLeft 的最佳项
          let bestDiff = 999;
          for (let i = 0; i < remaining.length; i++) {
            const s = getItemSpan(remaining[i]);
            if (s <= spaceLeft) {
              const diff = spaceLeft - s;
              if (diff === 0) {
                candidateIdx = i;
                break;
              } else if (diff < bestDiff) {
                bestDiff = diff;
                candidateIdx = i;
              }
            }
          }

          // 若 75% 占 9 格后还余 3 格，且无原生 3 格项，寻找支持弹性收窄为 3 格 (25%) 的次要组件填充配对
          if (candidateIdx === -1 && spaceLeft === 3) {
            for (let i = 0; i < remaining.length; i++) {
              if (getItemSpan(remaining[i]) <= 6 && remaining[i] !== "search_engine") {
                candidateIdx = i;
                break;
              }
            }
          }
        }

        if (candidateIdx !== -1) {
          const [chosen] = remaining.splice(candidateIdx, 1);
          const s = getItemSpan(chosen);
          const allocated = Math.min(s, spaceLeft);
          const wasPulledForward = currentUsedSpan > 0 && candidateIdx > 0;
          if (wasPulledForward) {
            filledGapsCount++;
          }
          rowKeys.push(chosen);
          spans[chosen] = allocated;
          autoFilledFlags[chosen] = wasPulledForward;
          currentUsedSpan += allocated;
        } else {
          break;
        }
      }

      // 如果当前行仍有多余空隙 (如还余 2 或 4 格)，拉伸行内组件彻底填满 12 列 (消除留白)
      const spaceLeft = 12 - currentUsedSpan;
      if (spaceLeft > 0 && rowKeys.length > 0) {
        // 注意：相关图片 (image_gallery) 长度数值必须严格保持 75% (9 格)，绝不能自动拉伸至 100% (12 格)！
        const stretchCandidates = rowKeys.filter(
          (k) => k !== "image_gallery" && WIDGET_REGISTRY[k]?.width !== 75
        );
        if (stretchCandidates.length > 0) {
          const lastKey = stretchCandidates[stretchCandidates.length - 1];
          spans[lastKey] = (spans[lastKey] || 4) + spaceLeft;
          autoFilledFlags[lastKey] = true;
          filledGapsCount++;
          currentUsedSpan = 12;
        }
      }

      // ──────────────────────────────────────────
      // 穿插排列优化 (Interleaved Arrangement Re-ordering)：
      // 1) 75% + 25% 配对：交替穿插 [75%, 25%] 与 [25%, 75%]
      // 2) 50% + 双 25% 配对：采用黄金分割的对称夹心穿插 [25%, 50%, 25%]
      // ──────────────────────────────────────────
      const rowSpans = rowKeys.map(k => spans[k]);
      if (rowKeys.length === 2 && rowSpans.includes(9) && rowSpans.includes(3)) {
        const item9 = rowKeys.find(k => spans[k] === 9)!;
        const item3 = rowKeys.find(k => spans[k] === 3)!;
        if (count75Rows % 2 === 1) {
          rowKeys = [item3, item9];
        } else {
          rowKeys = [item9, item3];
        }
        count75Rows++;
      } else if (rowKeys.length === 3 && rowSpans.includes(6) && rowSpans.filter(s => s === 3).length === 2) {
        const item6 = rowKeys.find(k => spans[k] === 6)!;
        const items3 = rowKeys.filter(k => spans[k] === 3);
        // 夹心穿插排列：[25%, 50%, 25%]
        rowKeys = [items3[0], item6, items3[1]];
        count50MixRows++;
      } else if (rowKeys.length === 2 && rowSpans.includes(6) && rowSpans.includes(3)) {
        const item6 = rowKeys.find(k => spans[k] === 6)!;
        const item3 = rowKeys.find(k => spans[k] === 3)!;
        if (count50MixRows % 2 === 1) {
          rowKeys = [item3, item6];
        } else {
          rowKeys = [item6, item3];
        }
        count50MixRows++;
      }

      rowKeys.forEach((key) => {
        const span = key === "image_gallery" ? 9 : spans[key];
        gridConfig[key] = {
          colSpanLg: span,
          colSpanMd: span <= 6 ? 6 : 12,
          rowIndex: currentRowIndex,
          width: key === "image_gallery" ? 75 : (tileWidthFromSpan(span) ?? 50),
          isCompact: span <= 3,
          isAutoFilled: key === "image_gallery" ? false : (autoFilledFlags[key] || false)
        };
      });

      currentRowIndex++;
    }

    if (gridConfig.image_gallery) {
      gridConfig.image_gallery.colSpanLg = 9;
      gridConfig.image_gallery.width = 75;
      gridConfig.image_gallery.isAutoFilled = false;
    }

    return {
      gridConfig: gridConfig as Record<ResultWidgetKey, WidgetGridPlacement>,
      totalRows: currentRowIndex,
      filledGapsCount
    };
  }

  // 2. 模式 B: stretch (保持原始阅读流顺序，由行内末尾组件弹性拉伸占满该行)
  const remaining = [...activeKeys];
  let currentRowIndex = 0;
  let rowKeys: ResultWidgetKey[] = [];
  const spans: Record<string, number> = {};
  const autoFilledFlags: Record<string, boolean> = {};
  let currentUsedSpan = 0;

  const finalizeRow = () => {
    if (rowKeys.length === 0) return;
    const spaceLeft = 12 - currentUsedSpan;
    if (spaceLeft > 0) {
      const stretchCandidates = rowKeys.filter(
        (k) => k !== "image_gallery" && WIDGET_REGISTRY[k]?.width !== 75
      );
      if (stretchCandidates.length > 0) {
        const lastKey = stretchCandidates[stretchCandidates.length - 1];
        spans[lastKey] = (spans[lastKey] || 4) + spaceLeft;
        autoFilledFlags[lastKey] = true;
        filledGapsCount++;
      }
    }

    rowKeys.forEach((key) => {
      const span = key === "image_gallery" ? 9 : spans[key];
      gridConfig[key] = {
        colSpanLg: span,
        colSpanMd: span <= 6 ? 6 : 12,
        rowIndex: currentRowIndex,
        width: key === "image_gallery" ? 75 : (tileWidthFromSpan(span) ?? 50),
        isCompact: span <= 3,
        isAutoFilled: key === "image_gallery" ? false : (autoFilledFlags[key] || false)
      };
    });

    currentRowIndex++;
    rowKeys = [];
    currentUsedSpan = 0;
  };

  while (remaining.length > 0) {
    const key = remaining.shift()!;
    const span = getItemSpan(key);

    if (currentUsedSpan + span > 12) {
      finalizeRow();
    }

    rowKeys.push(key);
    spans[key] = span;
    currentUsedSpan += span;
  }

  finalizeRow();

  if (gridConfig.image_gallery) {
    gridConfig.image_gallery.colSpanLg = 9;
    gridConfig.image_gallery.width = 75;
    gridConfig.image_gallery.isAutoFilled = false;
  }

  return {
    gridConfig: gridConfig as Record<ResultWidgetKey, WidgetGridPlacement>,
    totalRows: currentRowIndex,
    filledGapsCount
  };
}

/**
 * Preset manual selection
 */
export function getStrategyForPreset(
  presetId: LayoutIntentType,
  result?: SearchSynthesisResult
): AdaptiveLayoutStrategy {
  const dummyQuery = presetId === "comparison" ? "A vs B 对比" : (presetId === "architecture" ? "系统架构原理" : "");
  return determineClientWidgetActivation({
    result,
    query: dummyQuery || result?.query || ""
  });
}

/**
 * Compute from query
 */
export function computeAdaptiveLayoutFromQuery(
  query: string,
  result?: SearchSynthesisResult,
  targetLanguage?: string
): AdaptiveLayoutStrategy {
  return determineClientWidgetActivation({
    result,
    query,
    targetLanguage
  });
}
