import {
  AdaptiveLayoutStrategy,
  LayoutIntentType,
  ResultWidgetKey,
  SearchSynthesisResult,
  WidgetGridPlacement,
  WidgetStatusDetail,
  WidgetSemanticWidth,
  LayoutPlan,
  LayoutBudget,
  AutoFillGapsMode,
  ALL_RESULT_WIDGET_KEYS
} from "../types.js";

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
    intentFit: ["deep_research", "quick_definition", "travel", "comparison", "balanced"],
    isActionOriented: false
  },
  quick_answer: {
    capabilities: ["instant_verdict", "definition_snippet"],
    intentFit: ["quick_definition", "balanced", "explain" as any],
    isActionOriented: false
  },
  sources: {
    capabilities: ["evidence_chain", "citation_retrieval", "literature_archive"],
    intentFit: ["fact_check", "deep_research", "balanced", "official_portal", "install", "tool_discovery", "travel", "troubleshooting", "comparison", "code_tutorial", "news_trend", "quick_definition", "architecture"],
    isActionOriented: false
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
  ai_overview: {
    capabilities: ["overview_synthesis"],
    intentFit: ["balanced"],
    isActionOriented: false
  }
};

// ==========================================
// 1. Widget Registry: Single Source of Truth
// ==========================================
export interface WidgetDefinition {
  id: ResultWidgetKey;
  label: string;
  iconName: string;
  defaultWidth: WidgetSemanticWidth;
  minColSpan: number; // 4, 6, 8, 12 in 12-col grid
  basePriority: number; // 1 to 10 (higher = higher in reading flow)
  category: "primary" | "secondary" | "analytical" | "utility";
  requiresData?: (signals: ContentSignals) => boolean;
}

export const WIDGET_REGISTRY: Record<ResultWidgetKey, WidgetDefinition> = {
  quick_answer: {
    id: "quick_answer",
    label: "即时答案速递",
    iconName: "Zap",
    defaultWidth: "half",
    minColSpan: 6,
    basePriority: 10,
    category: "primary"
  },
  takeaways: {
    id: "takeaways",
    label: "核心结论要点",
    iconName: "Sparkles",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 9,
    category: "primary",
    requiresData: (s) => s.takeawayCount > 0
  },
  comparison: {
    id: "comparison",
    label: "多维对比矩阵",
    iconName: "Scale",
    defaultWidth: "wide",
    minColSpan: 6,
    basePriority: 8,
    category: "analytical",
    requiresData: (s) => s.comparisonRows > 0
  },
  mindmap: {
    id: "mindmap",
    label: "知识架构导图",
    iconName: "GitFork",
    defaultWidth: "wide",
    minColSpan: 6,
    basePriority: 8,
    category: "analytical",
    requiresData: (s) => s.mindMapBranches > 0
  },
  official_portal: {
    id: "official_portal",
    label: "官方认证门户",
    iconName: "ShieldCheck",
    defaultWidth: "half",
    minColSpan: 6,
    basePriority: 9,
    category: "primary",
    requiresData: (s) => s.hasOfficial
  },
  sources: {
    id: "sources",
    label: "文献信源库",
    iconName: "Database",
    defaultWidth: "half",
    minColSpan: 6,
    basePriority: 8,
    category: "primary",
    requiresData: (s) => s.sourceCount > 0
  },
  actions_toolbox: {
    id: "actions_toolbox",
    label: "快捷操作工具箱",
    iconName: "Wrench",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 7,
    category: "utility"
  },
  fast_chat: {
    id: "fast_chat",
    label: "智能追问对话",
    iconName: "MessageSquare",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 7,
    category: "utility"
  },
  topic_digest: {
    id: "topic_digest",
    label: "分面专题解析",
    iconName: "Layout",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 6,
    category: "secondary"
  },
  verification_checklist: {
    id: "verification_checklist",
    label: "事实核查审计",
    iconName: "CheckCircle2",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 6,
    category: "analytical"
  },
  analytics_trend: {
    id: "analytics_trend",
    label: "信源相关度分布",
    iconName: "TrendingUp",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 6,
    category: "analytical"
  },
  followup: {
    id: "followup",
    label: "延伸探索建议",
    iconName: "Compass",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 6,
    category: "secondary",
    requiresData: (s) => s.followUpCount > 0
  },
  metrics_telemetry: {
    id: "metrics_telemetry",
    label: "检索度量",
    iconName: "Activity",
    defaultWidth: "compact",
    minColSpan: 4,
    basePriority: 5,
    category: "utility"
  },
  mobile_qr: {
    id: "mobile_qr",
    label: "复制本页链接",
    iconName: "Link2",
    defaultWidth: "compact",
    minColSpan: 4,
    basePriority: 4,
    category: "utility",
    requiresData: (s) => s.hasOfficial
  },
  agent_workflow: {
    id: "agent_workflow",
    label: "Agent 任务分派",
    iconName: "Cpu",
    defaultWidth: "half",
    minColSpan: 4,
    basePriority: 4,
    category: "utility"
  },
  ai_overview: {
    id: "ai_overview",
    label: "AI 深度研报",
    iconName: "FileText",
    defaultWidth: "full",
    minColSpan: 6,
    basePriority: 3,
    category: "secondary"
  },
  custom_cards: {
    id: "custom_cards",
    label: "搜索定制独有组件",
    iconName: "Sparkles",
    defaultWidth: "half",
    minColSpan: 6,
    basePriority: 8,
    category: "primary"
  }
};

/**
 * Dynamic Capability Resolver based on Task Intent (Intent -> Capability -> Widgets)
 * Eliminates static hardcoded fallback templates.
 */
export function resolveDynamicCapabilityWidgets(intent: LayoutIntentType): ResultWidgetKey[] {
  switch (intent) {
    case "install":
      return ["custom_cards", "actions_toolbox", "official_portal", "verification_checklist", "sources"];
    case "tool_discovery":
      return ["custom_cards", "comparison", "official_portal", "actions_toolbox", "sources"];
    case "travel":
      return ["custom_cards", "takeaways", "official_portal", "actions_toolbox", "sources"];
    case "troubleshooting":
      return ["actions_toolbox", "verification_checklist", "custom_cards", "sources"];
    case "comparison":
      return ["comparison", "custom_cards", "takeaways", "sources"];
    case "architecture":
      return ["mindmap", "custom_cards", "takeaways", "sources"];
    case "official_portal":
      return ["official_portal", "actions_toolbox", "custom_cards", "sources"];
    case "code_tutorial":
      return ["actions_toolbox", "custom_cards", "topic_digest", "sources"];
    case "fact_check":
      return ["verification_checklist", "custom_cards", "sources", "analytics_trend"];
    case "news_trend":
      return ["analytics_trend", "sources", "takeaways", "verification_checklist"];
    case "quick_definition":
      return ["quick_answer", "takeaways", "custom_cards", "sources"];
    case "deep_research":
      return ["takeaways", "mindmap", "custom_cards", "topic_digest", "sources"];
    case "balanced":
    default:
      return ["quick_answer", "custom_cards", "takeaways", "sources", "actions_toolbox"];
  }
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
  const violations: string[] = [];
  const currentSet = new Set(enabledWidgets);

  const isActionIntent = ["install", "tool_discovery", "travel", "troubleshooting", "code_tutorial"].includes(intent);
  const hasActionWidget = enabledWidgets.some((k) => WIDGET_CAPABILITY_REGISTRY[k]?.isActionOriented);

  if (isActionIntent && !hasActionWidget) {
    violations.push(`Intent [${intent}] requires interactive/action capabilities but none were found.`);
    currentSet.add("custom_cards");
    currentSet.add("actions_toolbox");
  }

  if (intent === "install" && !currentSet.has("actions_toolbox") && !currentSet.has("custom_cards")) {
    violations.push("Install intent missing action_toolbox or custom_cards capability.");
    currentSet.add("actions_toolbox");
  }

  if (intent === "tool_discovery" && !currentSet.has("custom_cards") && !currentSet.has("comparison")) {
    violations.push("Tool discovery intent missing custom_cards or comparison capability.");
    currentSet.add("custom_cards");
  }

  if (intent === "travel" && !currentSet.has("custom_cards") && !currentSet.has("takeaways")) {
    violations.push("Travel intent missing custom_cards or takeaways capability.");
    currentSet.add("custom_cards");
  }

  return {
    passed: violations.length === 0,
    remediatedWidgets: Array.from(currentSet),
    violations
  };
}

export function getWidgetLabel(key: ResultWidgetKey): string {
  return WIDGET_REGISTRY[key]?.label || key;
}

export function getWidgetIconName(key: ResultWidgetKey): string {
  return WIDGET_REGISTRY[key]?.iconName || "Layers";
}

export const WIDTH_SPAN_OPTIONS: Array<{ span: number; label: string; shortLabel: string; percent: string }> = [
  { span: 4, label: "紧凑/次级 (33% · 4格)", shortLabel: "紧凑 (4格)", percent: "33%" },
  { span: 6, label: "半宽对齐 (50% · 6格)", shortLabel: "半宽 (6格)", percent: "50%" },
  { span: 8, label: "主宽聚焦 (66% · 8格)", shortLabel: "主宽 (8格)", percent: "66%" },
  { span: 12, label: "全宽整行 (100% · 12格)", shortLabel: "全宽 (12格)", percent: "100%" },
];

export function getWidgetSpanLabel(span: number): string {
  // Normalize span input if needed
  const normalized = normalizeWidgetSpan(span);
  switch (normalized) {
    case 4:
      return "紧凑 (4格/33%)";
    case 6:
      return "半宽 (6格/50%)";
    case 8:
      return "主宽 (8格/66%)";
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
 * Normalizes any width value (1..12, legacy 1..4, or semantic keywords)
 * to a strictly safe 12-column grid span number (4, 6, 8, 12).
 * Eliminates bugs where width=1 would squash or fail to render.
 */
export function normalizeWidgetSpan(
  span?: number | string,
  semanticWidth?: WidgetSemanticWidth | string
): number {
  if (typeof span === "string") {
    if (span === "full") return 12;
    if (span === "large" || span === "wide") return 8;
    if (span === "medium" || span === "half") return 6;
    if (span === "small" || span === "compact") return 4;
    const parsed = parseInt(span, 10);
    if (!isNaN(parsed)) span = parsed;
  }

  if (semanticWidth === "full") return 12;
  if (semanticWidth === "large" || semanticWidth === "wide") return 8;
  if (semanticWidth === "medium" || semanticWidth === "half") return 6;
  if (semanticWidth === "small" || semanticWidth === "compact") return 4;

  if (span === undefined || span === null) {
    return 12;
  }

  const s = Number(span);

  // Legacy 1..4 scale conversion (1 col of 4 = 4/12; 2 cols = 6/12; 3 cols = 8/12; 4 cols = 12/12)
  if (s === 1) return 4; // Compact 4-columns, NEVER 1-column squished
  if (s === 2) return 6; // Half
  if (s === 3) return 4; // Compact 4-columns or 3-columns
  if (s === 4) return 4; // Compact

  // 12-column scale
  if (s <= 4) return 4;
  if (s <= 6) return 6;
  if (s <= 9) return 8;
  return 12;
}

/**
 * Returns bulletproof responsive CSS classes for any placement or span.
 * Guarantees zero undefined classes and safe fluid rendering.
 */
export function normalizeWidthToGridClass(
  span?: number | string,
  semanticWidth?: WidgetSemanticWidth | string
): string {
  const normalizedSpan = normalizeWidgetSpan(span, semanticWidth);

  switch (normalizedSpan) {
    case 12:
      return "col-span-12";
    case 8:
      return "col-span-12 lg:col-span-8";
    case 6:
      return "col-span-12 lg:col-span-6";
    case 4:
    default:
      return "col-span-12 sm:col-span-6 lg:col-span-4";
  }
}

export function getWidgetGridClass(placement?: WidgetGridPlacement): string {
  return normalizeWidthToGridClass(placement?.colSpanLg, placement?.semanticWidth);
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
    /(是什么|怎么读|读音|定义|含义|解释|换算|等于多少|多少钱|几点|谁是|在哪|什么时候|拼音|\b(what is|meaning|define|definition|convert|who is|where is|when is)\b)/i.test(q)
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
      return {
        maxPrimarySections: 4,
        maxSecondarySections: 2,
        maxVisualWidgets: 1,
        maxInteractiveWidgets: 1
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
}): LayoutPlan {
  const { intent, signals, targetLanguage } = params;
  const isEn = targetLanguage === "en";

  const intentLabels: Record<LayoutIntentType, { zh: string; en: string }> = {
    install: { zh: "安装部署与下载优先", en: "Installation & Download Hub" },
    tool_discovery: { zh: "实用工具与在线体验优先", en: "Tool Discovery & Utility" },
    travel: { zh: "旅游攻略与行程路线优先", en: "Travel Guide & Itinerary" },
    troubleshooting: { zh: "报错排查与故障修复优先", en: "Troubleshooting & Fix" },
    comparison: { zh: "多维对比矩阵优先", en: "Comparison Matrix Priority" },
    architecture: { zh: "知识架构导图优先", en: "Knowledge Architecture Priority" },
    official_portal: { zh: "官方认证门户优先", en: "Official Portal Priority" },
    fact_check: { zh: "事实核查与存证优先", en: "Fact Check & Verification" },
    code_tutorial: { zh: "代码与实操教程优先", en: "Code Tutorial & Actions" },
    news_trend: { zh: "时事资讯与趋势优先", en: "News & Trend Analysis" },
    quick_definition: { zh: "简明速答与概念速查", en: "Quick Definition & Answer" },
    deep_research: { zh: "深度综合研报优先", en: "Deep Research Report" },
    balanced: { zh: "标准清晰阅读流", en: "Clean Reading Flow" }
  };

  const intentLabel = isEn ? (intentLabels[intent]?.en || "Adaptive Search Layout") : (intentLabels[intent]?.zh || "智能自适应布局");

  // Determine standard candidate reading order per intent
  let rawOrder: ResultWidgetKey[] = [];
  let featuredWidget: ResultWidgetKey = "quick_answer";
  const widths: Partial<Record<ResultWidgetKey, WidgetSemanticWidth>> = {};

  switch (intent) {
    case "install":
      featuredWidget = "actions_toolbox";
      rawOrder = [
        "custom_cards",
        "actions_toolbox",
        "official_portal",
        "verification_checklist",
        "quick_answer",
        "takeaways",
        "sources",
        "fast_chat",
        "mobile_qr",
        "followup"
      ];
      widths.custom_cards = "full";
      widths.actions_toolbox = "full";
      widths.official_portal = "half";
      widths.verification_checklist = "half";
      widths.quick_answer = "full";
      widths.takeaways = "half";
      widths.sources = "full";
      widths.fast_chat = "half";
      widths.mobile_qr = "compact";
      widths.followup = "half";
      break;

    case "tool_discovery":
      featuredWidget = "custom_cards";
      rawOrder = [
        "custom_cards",
        "comparison",
        "official_portal",
        "actions_toolbox",
        "quick_answer",
        "takeaways",
        "sources",
        "fast_chat",
        "followup"
      ];
      widths.custom_cards = "full";
      widths.comparison = "full";
      widths.official_portal = "half";
      widths.actions_toolbox = "half";
      widths.quick_answer = "full";
      widths.takeaways = "wide";
      widths.sources = "full";
      widths.fast_chat = "half";
      widths.followup = "half";
      break;

    case "travel":
      featuredWidget = "custom_cards";
      rawOrder = [
        "custom_cards",
        "takeaways",
        "official_portal",
        "actions_toolbox",
        "quick_answer",
        "sources",
        "mobile_qr",
        "fast_chat",
        "followup"
      ];
      widths.custom_cards = "full";
      widths.takeaways = "wide";
      widths.official_portal = "half";
      widths.actions_toolbox = "half";
      widths.quick_answer = "full";
      widths.sources = "full";
      widths.mobile_qr = "compact";
      widths.fast_chat = "half";
      widths.followup = "half";
      break;

    case "troubleshooting":
      featuredWidget = "actions_toolbox";
      rawOrder = [
        "actions_toolbox",
        "verification_checklist",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "sources",
        "fast_chat",
        "followup"
      ];
      widths.actions_toolbox = "full";
      widths.verification_checklist = "wide";
      widths.custom_cards = "full";
      widths.quick_answer = "full";
      widths.takeaways = "half";
      widths.sources = "full";
      widths.fast_chat = "half";
      widths.followup = "half";
      break;

    case "comparison":
      featuredWidget = "comparison";
      rawOrder = [
        "comparison",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "sources",
        "actions_toolbox",
        "fast_chat",
        "topic_digest",
        "verification_checklist",
        "analytics_trend",
        "followup",
        "metrics_telemetry",
        "agent_workflow"
      ];
      widths.comparison = "full";
      widths.custom_cards = "full";
      widths.quick_answer = "full";
      widths.takeaways = "wide";
      widths.sources = "full";
      widths.actions_toolbox = "half";
      widths.fast_chat = "half";
      widths.topic_digest = "half";
      widths.verification_checklist = "half";
      widths.analytics_trend = "half";
      widths.followup = "half";
      widths.metrics_telemetry = "compact";
      widths.agent_workflow = "half";
      break;

    case "architecture":
      featuredWidget = "mindmap";
      rawOrder = [
        "mindmap",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "sources",
        "actions_toolbox",
        "fast_chat",
        "topic_digest",
        "followup",
        "analytics_trend",
        "metrics_telemetry",
        "agent_workflow"
      ];
      widths.mindmap = "full";
      widths.custom_cards = "full";
      widths.quick_answer = "full";
      widths.takeaways = "wide";
      widths.sources = "full";
      widths.actions_toolbox = "half";
      widths.fast_chat = "half";
      widths.topic_digest = "half";
      widths.followup = "half";
      widths.analytics_trend = "half";
      widths.metrics_telemetry = "compact";
      widths.agent_workflow = "half";
      break;

    case "official_portal":
      featuredWidget = "official_portal";
      rawOrder = [
        "official_portal",
        "actions_toolbox",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "sources",
        "mobile_qr",
        "fast_chat",
        "followup",
        "metrics_telemetry",
        "agent_workflow"
      ];
      widths.official_portal = "full";
      widths.actions_toolbox = "half";
      widths.custom_cards = "full";
      widths.quick_answer = "full";
      widths.takeaways = "wide";
      widths.sources = "full";
      widths.mobile_qr = "compact";
      widths.fast_chat = "half";
      widths.followup = "half";
      widths.metrics_telemetry = "compact";
      widths.agent_workflow = "half";
      break;

    case "fact_check":
      featuredWidget = "verification_checklist";
      rawOrder = [
        "verification_checklist",
        "quick_answer",
        "custom_cards",
        "takeaways",
        "sources",
        "analytics_trend",
        "metrics_telemetry",
        "actions_toolbox",
        "fast_chat",
        "followup",
        "agent_workflow"
      ];
      widths.verification_checklist = "wide";
      widths.quick_answer = "full";
      widths.custom_cards = "full";
      widths.takeaways = "half";
      widths.sources = "full";
      widths.analytics_trend = "half";
      widths.metrics_telemetry = "compact";
      widths.actions_toolbox = "half";
      widths.fast_chat = "half";
      widths.followup = "half";
      widths.agent_workflow = "half";
      break;

    case "code_tutorial":
      featuredWidget = "actions_toolbox";
      rawOrder = [
        "actions_toolbox",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "topic_digest",
        "sources",
        "fast_chat",
        "verification_checklist",
        "followup",
        "metrics_telemetry",
        "agent_workflow"
      ];
      widths.actions_toolbox = "full";
      widths.custom_cards = "full";
      widths.quick_answer = "full";
      widths.takeaways = "half";
      widths.topic_digest = "half";
      widths.sources = "full";
      widths.fast_chat = "half";
      widths.verification_checklist = "half";
      widths.followup = "half";
      widths.metrics_telemetry = "compact";
      widths.agent_workflow = "half";
      break;

    case "news_trend":
      featuredWidget = "analytics_trend";
      rawOrder = [
        "analytics_trend",
        "quick_answer",
        "custom_cards",
        "takeaways",
        "sources",
        "verification_checklist",
        "actions_toolbox",
        "fast_chat",
        "topic_digest",
        "followup",
        "metrics_telemetry",
        "agent_workflow"
      ];
      widths.analytics_trend = "half";
      widths.quick_answer = "full";
      widths.custom_cards = "full";
      widths.takeaways = "half";
      widths.sources = "full";
      widths.verification_checklist = "half";
      widths.actions_toolbox = "half";
      widths.fast_chat = "half";
      widths.topic_digest = "half";
      widths.followup = "half";
      widths.metrics_telemetry = "compact";
      widths.agent_workflow = "half";
      break;

    case "quick_definition":
      featuredWidget = "quick_answer";
      rawOrder = [
        "quick_answer",
        "takeaways",
        "custom_cards",
        "sources",
        "actions_toolbox",
        "fast_chat",
        "followup"
      ];
      widths.quick_answer = "full";
      widths.takeaways = "wide";
      widths.custom_cards = "full";
      widths.sources = "full";
      widths.actions_toolbox = "half";
      widths.fast_chat = "half";
      widths.followup = "half";
      break;

    case "deep_research":
      featuredWidget = "takeaways";
      rawOrder = [
        "takeaways",
        "mindmap",
        "custom_cards",
        "quick_answer",
        "topic_digest",
        "sources",
        "actions_toolbox",
        "analytics_trend",
        "verification_checklist",
        "fast_chat",
        "followup",
        "metrics_telemetry",
        "agent_workflow"
      ];
      widths.takeaways = "full";
      widths.mindmap = "full";
      widths.custom_cards = "full";
      widths.quick_answer = "full";
      widths.topic_digest = "half";
      widths.sources = "full";
      widths.actions_toolbox = "half";
      widths.analytics_trend = "half";
      widths.verification_checklist = "half";
      widths.fast_chat = "half";
      widths.followup = "half";
      widths.metrics_telemetry = "compact";
      widths.agent_workflow = "half";
      break;

    case "balanced":
    default:
      featuredWidget = "quick_answer";
      rawOrder = [
        "quick_answer",
        "custom_cards",
        "takeaways",
        "sources",
        "actions_toolbox",
        "fast_chat",
        "topic_digest",
        "followup",
        "analytics_trend",
        "verification_checklist",
        "metrics_telemetry",
        "agent_workflow"
      ];
      widths.quick_answer = "full";
      widths.custom_cards = "full";
      widths.takeaways = "wide";
      widths.sources = "full";
      widths.actions_toolbox = "half";
      widths.fast_chat = "half";
      widths.topic_digest = "half";
      widths.followup = "half";
      widths.analytics_trend = "half";
      widths.verification_checklist = "half";
      widths.metrics_telemetry = "compact";
      widths.agent_workflow = "half";
      break;
  }

  // Filter out ONLY widgets that have unsatisfied data requirements
  const enabledKeys = rawOrder.filter((k) => {
    const reg = WIDGET_REGISTRY[k];
    if (!reg) return false;
    if (reg.requiresData && !reg.requiresData(signals)) {
      return false;
    }
    return true;
  });

  // Safe Fallback: Ensure critical base widgets are always present
  if (!enabledKeys.includes("quick_answer")) enabledKeys.push("quick_answer");
  if (!enabledKeys.includes("sources") && signals.sourceCount > 0) enabledKeys.push("sources");
  if (!enabledKeys.includes("takeaways") && signals.takeawayCount > 0) enabledKeys.splice(1, 0, "takeaways");

  // Capability-driven fallback resolution based on intent
  const finalEnabled = enabledKeys.length > 0 ? enabledKeys : resolveDynamicCapabilityWidgets(intent);

  const budget = getDynamicBudget(intent);

  return {
    intent,
    intentLabel,
    order: finalEnabled,
    enabled: finalEnabled,
    featured: featuredWidget,
    width: widths,
    budget: {
      maxPrimary: budget.maxPrimarySections,
      maxSecondary: budget.maxSecondarySections,
      totalActive: finalEnabled.length
    }
  };
}

/**
 * Maps LayoutPlan into complete AdaptiveLayoutStrategy
 */
export function determineClientWidgetActivation(params: {
  result?: SearchSynthesisResult;
  query?: string;
  targetLanguage?: string;
}): AdaptiveLayoutStrategy {
  const { result, query = "", targetLanguage } = params;
  const q = query || result?.query || "";
  const isEn = targetLanguage === "en";

  const intent = detectQueryIntent(q);

  const signals: ContentSignals = {
    summaryLength: (result?.summary || "").length,
    takeawayCount: (result?.keyTakeaways || []).length,
    sourceCount: (result?.filteredResults || []).length,
    comparisonRows: (result?.comparisonTable || []).length,
    mindMapBranches: result?.mindMap?.children?.length || 0,
    followUpCount: (result?.followUpQuestions || []).length,
    hasOfficial: (result?.filteredResults || []).some((r) => r.isOfficial),
    customCardCount: (result?.customCards || []).length
  };

  const plan = createLayoutPlan({ intent, signals, targetLanguage });

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
    const semanticWidth = plan.width[k] || WIDGET_REGISTRY[k]?.defaultWidth || "full";
    const span = normalizeWidgetSpan(undefined, semanticWidth);

    gridConfig[k] = {
      colSpanLg: span,
      colSpanMd: span <= 6 ? 6 : 12,
      semanticWidth,
      isCompact: span <= 4,
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
    emphasizedWidget: plan.featured || "quick_answer",
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
    const custom = options.customSpans?.[key];
    return normalizeWidgetSpan(
      custom,
      custom ? undefined : WIDGET_REGISTRY[key]?.defaultWidth
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
        semanticWidth: span >= 12 ? "full" : (span >= 8 ? "wide" : (span >= 6 ? "half" : "compact")),
        isCompact: span <= 4,
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

  // 1. 模式 A: dense (前瞻调配补位 + 缝隙闭合)
  if (autoFillMode === "dense") {
    const remaining = [...activeKeys];
    let currentRowIndex = 0;

    while (remaining.length > 0) {
      const rowKeys: ResultWidgetKey[] = [];
      const spans: Record<string, number> = {};
      const autoFilledFlags: Record<string, boolean> = {};
      let currentUsedSpan = 0;

      while (remaining.length > 0) {
        const spaceLeft = 12 - currentUsedSpan;
        if (spaceLeft < 4) break;

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
        const lastKey = rowKeys[rowKeys.length - 1];
        spans[lastKey] = (spans[lastKey] || 4) + spaceLeft;
        autoFilledFlags[lastKey] = true;
        filledGapsCount++;
        currentUsedSpan = 12;
      }

      rowKeys.forEach((key) => {
        const span = spans[key];
        gridConfig[key] = {
          colSpanLg: span,
          colSpanMd: span <= 6 ? 6 : 12,
          rowIndex: currentRowIndex,
          semanticWidth: span >= 12 ? "full" : (span >= 8 ? "wide" : (span >= 6 ? "half" : "compact")),
          isCompact: span <= 4,
          isAutoFilled: autoFilledFlags[key] || false
        };
      });

      currentRowIndex++;
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
      const lastKey = rowKeys[rowKeys.length - 1];
      spans[lastKey] = (spans[lastKey] || 4) + spaceLeft;
      autoFilledFlags[lastKey] = true;
      filledGapsCount++;
    }

    rowKeys.forEach((key) => {
      const span = spans[key];
      gridConfig[key] = {
        colSpanLg: span,
        colSpanMd: span <= 6 ? 6 : 12,
        rowIndex: currentRowIndex,
        semanticWidth: span >= 12 ? "full" : (span >= 8 ? "wide" : (span >= 6 ? "half" : "compact")),
        isCompact: span <= 4,
        isAutoFilled: autoFilledFlags[key] || false
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
