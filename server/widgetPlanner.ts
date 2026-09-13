import { 
  QueryIntent, 
  CustomCardArchetype, 
  ResultWidgetKey, 
  WidgetPlan, 
  SearchResult, 
  WidgetAction,
  WidgetPlannedItem,
  WidgetIntentAnalysis,
  WidgetBlueprint,
  BlueprintComponent
} from "../src/types.js";
import type { TileWidth } from "../src/lib/tileLayoutEngine.js";
import { classifyQueryIntent, planTaskCapabilities } from "./intentAgent.js";
import { synthesizeToolActions } from "./toolRegistry.js";
import { analyzeWidgetIntent, INTENT_CAPABILITIES_MAP } from "./widgetIntentAnalyzer.js";
import { normalizeCapabilities, INTENT_TAXONOMY_ALIGNMENT, GENERIC_INTENTS, INTENT_CONFIDENCE_OVERRIDE_THRESHOLD, INTENT_GOAL_LABELS, ARCHETYPE_PROFILES, OFFICIAL_WIDGET_PROFILES, type CanonicalCapability } from "../src/widgets/capabilityTaxonomy.js";
import { composeWidgetsForTask } from "./widgetComposer.js";

// ==========================================
// 1. Archetype Capability Registry (原型能力与标签库)
// 业务原型声明所能提供的能力集合、语义标签与选型准则
// ==========================================
interface ArchetypeDefinition {
  archetype: CustomCardArchetype;
  capabilities: string[];
  tags: string[];
  description: string;
  selectionHeuristics: string;
  themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
  iconName: string;
  width: TileWidth;
  matchPatterns?: RegExp;
}

const ARCHETYPE_REGISTRY: Record<CustomCardArchetype, ArchetypeDefinition> = {
  download_hub: {
    archetype: "download_hub",
    capabilities: ["download", "releases", "binary", "system_requirements", "package_manager", "installer", "install_command"],
    tags: ARCHETYPE_PROFILES.download_hub?.tags || ["软件下载", "版本发布", "客户端", "安装包"],
    description: ARCHETYPE_PROFILES.download_hub?.functionality || "多平台安装包聚合、版本发布与环境核对",
    selectionHeuristics: ARCHETYPE_PROFILES.download_hub?.selectionHeuristics || "搜索涉及软件/工具下载时实用性最高",
    themeColor: "blue",
    iconName: "Download",
    width: 75,
    matchPatterns: /(下载|安装包|release|installer|client|客户端|安装教程)/i
  },
  action_checklist: {
    archetype: "action_checklist",
    capabilities: ["install_step", "checklist", "step_by_step", "environment_checklist", "troubleshooting_audit", "prerequisites_check", "fix_command", "verification"],
    tags: ARCHETYPE_PROFILES.action_checklist?.tags || ["操作步骤", "排查清单", "配置指南", "实操避坑"],
    description: ARCHETYPE_PROFILES.action_checklist?.functionality || "分步骤实操指引、排查清单与前置检查",
    selectionHeuristics: ARCHETYPE_PROFILES.action_checklist?.selectionHeuristics || "用户提出具体操作步骤或排查报错时实用性最高",
    themeColor: "emerald",
    iconName: "CheckCircle",
    width: 75,
    matchPatterns: /(步骤|排查|checklist|清单|指南|排错|配置步骤)/i
  },
  tool_discovery: {
    archetype: "tool_discovery",
    capabilities: ["tool_cards", "demo_button", "try_online", "software_directory", "online_tool", "free_tool", "pricing_comparison"],
    tags: ARCHETYPE_PROFILES.tool_discovery?.tags || ["在线工具", "神器推荐", "免安装", "在线体验"],
    description: ARCHETYPE_PROFILES.tool_discovery?.functionality || "聚合多款同类实用工具与在线服务",
    selectionHeuristics: ARCHETYPE_PROFILES.tool_discovery?.selectionHeuristics || "寻找实用工具与替代品时实用性最高",
    themeColor: "emerald",
    iconName: "Wrench",
    width: 75,
    matchPatterns: /(工具|在线|推荐|转换器|免安装|体验|网站推荐)/i
  },
  travel_itinerary: {
    archetype: "travel_itinerary",
    capabilities: ["itinerary_timeline", "travel_budget", "booking_resources", "attractions_map", "sightseeing", "route_plan"],
    tags: ARCHETYPE_PROFILES.travel_itinerary?.tags || ["旅游攻略", "行程路线", "景点规划", "出行门票"],
    description: ARCHETYPE_PROFILES.travel_itinerary?.functionality || "分天数规划游玩路线、景点地图与出行预算",
    selectionHeuristics: ARCHETYPE_PROFILES.travel_itinerary?.selectionHeuristics || "用户查询旅游行程与出行规划时实用性最高",
    themeColor: "amber",
    iconName: "Compass",
    width: 100,
    matchPatterns: /(旅游|攻略|行程|路线|景点|门票|自驾|几日游)/i
  },
  pros_cons: {
    archetype: "pros_cons",
    capabilities: ["pros_cons", "tradeoffs", "risk_mitigation", "advantages_disadvantages"],
    tags: ARCHETYPE_PROFILES.pros_cons?.tags || ["优缺点", "利弊权衡", "优劣对比", "客观评价"],
    description: ARCHETYPE_PROFILES.pros_cons?.functionality || "双栏对比核心优势与局限不足",
    selectionHeuristics: ARCHETYPE_PROFILES.pros_cons?.selectionHeuristics || "用户犹豫不决或探寻某事物好坏时实用性最高",
    themeColor: "violet",
    iconName: "Scale",
    width: 75,
    matchPatterns: /(优缺点|利弊|权衡|避坑|优势与不足)/i
  },
  verdict_summary: {
    archetype: "verdict_summary",
    capabilities: ["verdict_recommendation", "scenario_selection", "best_choice", "decision_matrix", "final_advice"],
    tags: ARCHETYPE_PROFILES.verdict_summary?.tags || ["最终裁决", "场景选型", "推荐建议", "购买指南"],
    description: ARCHETYPE_PROFILES.verdict_summary?.functionality || "针对不同场景的权威推荐结论与决策建议",
    selectionHeuristics: ARCHETYPE_PROFILES.verdict_summary?.selectionHeuristics || "用户直接发问'哪个好/买哪个'时实用性最高",
    themeColor: "violet",
    iconName: "Scale",
    width: 75,
    matchPatterns: /(谁更好|推荐|买哪个|选型|裁决|选哪个|pk)/i
  },
  parameter_matrix: {
    archetype: "parameter_matrix",
    capabilities: ["parameter_matrix", "spec_matrix", "spec_comparison", "benchmark_table", "feature_matrix", "concept_definition", "deep_report", "industry_matrix"],
    tags: ARCHETYPE_PROFILES.parameter_matrix?.tags || ["参数表格", "规格对比", "性能基准", "指标矩阵"],
    description: ARCHETYPE_PROFILES.parameter_matrix?.functionality || "结构化二维多维对比表格，逐项对齐核心参数",
    selectionHeuristics: ARCHETYPE_PROFILES.parameter_matrix?.selectionHeuristics || "用户对比多个型号或技术参数时实用性最高",
    themeColor: "zinc",
    iconName: "Layers",
    width: 100,
    matchPatterns: /(参数|指标|规格|基准|配置对比|矩阵|概念|原理|什么是)/i
  },
  timeline: {
    archetype: "timeline",
    capabilities: ["timeline_evolution", "milestones", "history", "version_history", "roadmap"],
    tags: ARCHETYPE_PROFILES.timeline?.tags || ["发展历程", "版本历史", "演进路线", "大事件"],
    description: ARCHETYPE_PROFILES.timeline?.functionality || "时间轴垂直串联历史版本与演进里程碑",
    selectionHeuristics: ARCHETYPE_PROFILES.timeline?.selectionHeuristics || "查询历史、发展史或演进过程时实用性最高",
    themeColor: "zinc",
    iconName: "Calendar",
    width: 100,
    matchPatterns: /(演进|历程|版本历史|发展史|里程碑|时间线)/i
  },
  quote_dossier: {
    archetype: "quote_dossier",
    capabilities: ["quote_dossier", "expert_opinion", "literature_archive", "viewpoints"],
    tags: ARCHETYPE_PROFILES.quote_dossier?.tags || ["名家观点", "权威言论", "多方评语", "引文档案"],
    description: ARCHETYPE_PROFILES.quote_dossier?.functionality || "汇集行业专家观点与多方争议言论引用",
    selectionHeuristics: ARCHETYPE_PROFILES.quote_dossier?.selectionHeuristics || "用户探寻业界观点与多方争议时实用性最高",
    themeColor: "blue",
    iconName: "Quote",
    width: 75,
    matchPatterns: /(言论|评价|争议|观点|评语)/i
  },
  schema: {
    archetype: "schema",
    capabilities: ["custom_schema", "declarative_ui", "dynamic_components"],
    tags: ["动态蓝图", "声明式UI", "定制卡片", "业务组件"],
    description: "自适应渲染任意数据结构的动态声明式组件树",
    selectionHeuristics: "当无预置模板可完美承载时实用性最高",
    themeColor: "blue",
    iconName: "Box",
    width: 75,
    matchPatterns: /(schema|组件|蓝图|动态组件)/i
  }
};

// ==========================================
// 2. Widget Capability Registry (小组件能力注册表)
// 包含组件所承载的能力、默认尺寸与基础权重
// ==========================================
interface WidgetDefinition {
  type: ResultWidgetKey;
  capabilities: string[];
  tags: string[];
  description: string;
  selectionHeuristics: string;
  basePriority: number; // 1 - 100
  width: TileWidth;
  flexible: boolean;
  isActionOriented: boolean;
}

const WIDGET_REGISTRY: Record<ResultWidgetKey, WidgetDefinition> = {
  custom_cards: {
    type: "custom_cards",
    // custom_cards 是复合蓝图宿主：WidgetComposer 会按 intent 渲染软件/素材/学习/开源/气象套件。
    // 因此它必须声明这些套件真实渲染出的全部能力，否则外围磁贴选择拿不到任何能力信号。
    capabilities: [
      "download", "releases", "software_info", "version_history", "release_binary", "git_clone",
      "tool_cards", "demo_button", "try_online",
      "itinerary_timeline", "travel_budget",
      "pros_cons", "checklist", "install_step", "verdict_recommendation", "parameter_matrix",
      "timeline_evolution", "quote_dossier",
      // 学习套件 (composeStudySuite)
      "roadmap_step", "code_run", "recommended_courses", "practice_exercises", "progress_tracker",
      // 素材套件 (composeResourceSuite)
      "resource_search", "resource_preview", "favorite", "tags_filter", "author_credit",
      "license_info", "resolution_spec",
      // 气象套件 (composeWeatherSuite)
      "weather_current", "weather_forecast", "weather_indices", "air_quality",
      "clothing_advice", "location_map"
    ],
    tags: ["独有卡片", "动态套件", "高密度业务", "场景定制", "全能卡片"],
    description: "场景专属业务卡片套件（包含软件下载枢纽、学习路线图、素材预览、气象看板等）",
    selectionHeuristics: "具备极高场景针对性，在具有明确领域意图时优先级最高",
    basePriority: 95,
    width: 75,
    flexible: true,
    isActionOriented: true
  },
  actions_toolbox: {
    type: "actions_toolbox",
    capabilities: ["install_command", "copy_text", "quick_action", "cli_execution", "quick_links", "code_snippet", "fix_command", "download", "git_clone"],
    tags: ["快捷指令", "安装命令", "代码执行", "一键复制", "行动工具"],
    description: "提供一键运行 CLI、安装命令复制、代码片段与快捷链接",
    selectionHeuristics: "在技术实施、命令行执行、快速安装等场景下实用性最高",
    basePriority: 88,
    width: 50,
    flexible: true,
    isActionOriented: true
  },
  official_portal: {
    type: "official_portal",
    capabilities: ["official_site", "official_url", "verified_docs", "authoritative_entry", "official_portal", "booking_resources", "service_status", "contact_entry"],
    tags: OFFICIAL_WIDGET_PROFILES.related_links?.tags || ["官方入口", "官网直达", "多链接", "权威信源", "导航", "外部跳转"],
    description: OFFICIAL_WIDGET_PROFILES.related_links?.functionality || "识别官方正版网站、官方文档与服务入口并提供一键直达",
    selectionHeuristics: OFFICIAL_WIDGET_PROFILES.related_links?.selectionHeuristics || "查询涉及品牌、软件名或寻找官网时实用性最高",
    basePriority: 85,
    width: 50,
    flexible: true,
    isActionOriented: true
  },
  verification_checklist: {
    type: "verification_checklist",
    capabilities: ["troubleshooting_audit", "fact_check", "prerequisites_check", "security_audit", "environment_checklist", "error_diagnosis", "verification_checklist"],
    tags: ["核验清单", "故障排查", "环境核对", "安全审计", "排错诊断"],
    description: "前置依赖检查、故障排查诊断与多项核验清单",
    selectionHeuristics: "遇到报错、依赖冲突或环境安装时实用性最高",
    basePriority: 80,
    width: 75,
    flexible: true,
    isActionOriented: true
  },
  comparison: {
    type: "comparison",
    capabilities: ["compare_table", "feature_matrix", "cross_compare", "dimension_pk", "spec_comparison", "benchmark_table"],
    tags: ["多维对比", "参数矩阵", "特性对比", "性能基准", "横向PK"],
    description: "多维度横向对比表格与技术指标 PK",
    selectionHeuristics: "用户面临二选一或多选一对决选型时实用性最高",
    basePriority: 86,
    width: 100,
    flexible: false,
    isActionOriented: false
  },
  mindmap: {
    type: "mindmap",
    capabilities: ["knowledge_topology", "architecture_tree", "subsystem_mapping", "mindmap_tree", "concept_definition", "roadmap_step", "core_principles", "typical_scenarios"],
    tags: ["思维导图", "知识图谱", "技术架构", "核心原理", "体系梳理"],
    description: "层级知识树、系统拓扑与核心架构导图",
    selectionHeuristics: "解析复杂系统、技术原理与概念全景时实用性最高",
    basePriority: 82,
    width: 75,
    flexible: true,
    isActionOriented: false
  },
  takeaways: {
    type: "takeaways",
    capabilities: ["bullet_conclusions", "high_density_takeaways", "summary_points"],
    tags: ["核心结论", "要点提炼", "关键洞察", "速览摘要"],
    description: "高密度条目式核心结论提炼与洞察速览",
    selectionHeuristics: "长文内容研报需要快速抓住要点时实用性最高",
    basePriority: 84,
    // 与 src/widgets/manifests/takeaways.json 的 grid.width 保持一致（25% 窄栏，3 格）。
    // 规划层宽度是该组件的最终上桌宽度来源，二者一旦漂移，清单改尺寸就不生效。
    width: 25,
    flexible: true,
    isActionOriented: false
  },
  image_gallery: {
    type: "image_gallery",
    capabilities: ["image_gallery", "resource_preview", "resource_search"],
    tags: OFFICIAL_WIDGET_PROFILES.image_gallery?.tags || ["相关图片", "图片墙", "视觉素材", "缩略图", "图集"],
    description: OFFICIAL_WIDGET_PROFILES.image_gallery?.functionality || "聚合检索结果中的相关图片，以自适应网格墙呈现并支持放大预览与图源溯源",
    selectionHeuristics: OFFICIAL_WIDGET_PROFILES.image_gallery?.selectionHeuristics || "查询对象具备明确视觉形态且信源含图片时实用性最高",
    basePriority: 74,
    // 与 src/widgets/manifests/image_gallery.json 的 grid.width 保持一致（75% 主宽，9 格）
    width: 75,
    flexible: true,
    isActionOriented: false
  },
  sources: {
    type: "sources",
    capabilities: ["evidence_chain", "citation_retrieval", "literature_archive", "literature_sources"],
    tags: ["权威信源", "存证引文", "文献溯源", "佐证依据"],
    description: "全网信源引文出处、发布时间与存证溯源",
    selectionHeuristics: "严肃调研、学术研报与结论核实时必备",
    basePriority: 72,
    width: 50,
    flexible: false,
    isActionOriented: false
  },
  topic_digest: {
    type: "topic_digest",
    capabilities: ["faceted_deep_dive", "multi_aspect_summary", "code_explanation", "related_topics"],
    tags: ["专题研读", "多面解读", "代码解析", "关联主题"],
    description: "多维度深挖解读与延伸技术点",
    selectionHeuristics: "综合调研与知识延展时实用性最高",
    basePriority: 65,
    width: 75,
    flexible: true,
    isActionOriented: false
  },
  analytics_trend: {
    type: "analytics_trend",
    capabilities: ["trend_signals", "sentiment_distribution", "temporal_evolution", "temporal_analysis"],
    tags: ["相关度分布", "趋势信号", "数据量化", "演化分析"],
    description: "信源热度分析、时间趋势与情感分布统计",
    selectionHeuristics: "舆情分析、趋势研判与统计量化场景下实用性最高",
    basePriority: 60,
    width: 50,
    flexible: true,
    isActionOriented: false
  },
  fast_chat: {
    type: "fast_chat",
    capabilities: ["interactive_followup_chat", "question_answering"],
    tags: ["交互问答", "实时追问", "灵感延伸", "即时对话"],
    description: "基于上下文的多轮交互式问答气泡",
    selectionHeuristics: "用户需要持续追问、深度交互探索时实用性最高",
    basePriority: 55,
    width: 50,
    flexible: true,
    isActionOriented: true
  },
  followup: {
    type: "followup",
    capabilities: ["smart_followup_prompts"],
    tags: ["延伸探索", "智能追问", "相关问题", "发散思考"],
    description: "智能推荐高频延展问题与发散探索方向",
    selectionHeuristics: "引导用户拓宽视野时实用性最高",
    basePriority: 50,
    width: 25,
    flexible: true,
    isActionOriented: false
  },
  metrics_telemetry: {
    type: "metrics_telemetry",
    capabilities: ["source_telemetry", "confidence_meter"],
    tags: ["检索遥测", "置信度评分", "信源分析", "性能指标"],
    description: "检索质量、模型置信度与响应遥测指标",
    selectionHeuristics: "系统状态监控与信源质检时展示",
    basePriority: 45,
    width: 25,
    flexible: true,
    isActionOriented: false
  },
  mobile_qr: {
    type: "mobile_qr",
    capabilities: ["mobile_handoff", "qr_scan_action"],
    tags: ["跨端流转", "扫码阅读", "移动端同步", "快速分享"],
    description: "生成专属二维码，支持手机扫码快速续读与跨端流转",
    selectionHeuristics: "需要随时随地分享或手机继续浏览时实用性最高",
    basePriority: 40,
    width: 25,
    flexible: true,
    isActionOriented: true
  },
  agent_workflow: {
    type: "agent_workflow",
    capabilities: ["agent_telemetry", "dag_trace"],
    tags: ["Agent协同", "流水线追踪", "DAG链路", "阶段耗时"],
    description: "可视化多 Agent 协同流水线、思考步骤与执行耗时",
    selectionHeuristics: "展示 Agentic 思考过程与复杂执行流程时实用性最高",
    basePriority: 35,
    width: 50,
    flexible: true,
    isActionOriented: false
  },
  ai_overview: {
    type: "ai_overview",
    capabilities: ["overview_synthesis"],
    tags: ["全景报告", "综合综述", "深度报告", "知识整合"],
    description: "全景式深度分析长篇综述报告",
    selectionHeuristics: "需要一站式长篇研报时实用性最高",
    basePriority: 30,
    width: 100,
    flexible: false,
    isActionOriented: false
  }
};

/**
 * 纯能力匹配求解卡片原型 (Dynamic Capability Archetype Resolver)
 * 彻底消除 switch(intent)，通过能力交集与语义特征动态打分
 */
function resolveArchetypeFromCapabilities(
  capabilities: string[],
  query: string
): { archetype: CustomCardArchetype; themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc"; iconName: string } {
  const capSet = new Set(capabilities.map(c => c.toLowerCase()));
  let bestArchetype: CustomCardArchetype = /(演进|历程|版本|历史)/i.test(query)
    ? "timeline"
    : /(言论|评价|争议|观点)/i.test(query)
      ? "quote_dossier"
      : "parameter_matrix";
  let maxScore = 0;

  for (const [archKey, def] of Object.entries(ARCHETYPE_REGISTRY) as [CustomCardArchetype, ArchetypeDefinition][]) {
    let score = 0;

    // 1. 能力交集打分 (每命中一个关键能力 +10 分)
    for (const cap of def.capabilities) {
      if (capSet.has(cap.toLowerCase())) {
        score += 10;
      }
    }

    // 2. 查询词语义特征增强打分 (+15 分)
    if (def.matchPatterns && def.matchPatterns.test(query)) {
      score += 15;
    }

    if (score > maxScore) {
      maxScore = score;
      bestArchetype = archKey;
    }
  }

  const resolvedDef = ARCHETYPE_REGISTRY[bestArchetype] || ARCHETYPE_REGISTRY.parameter_matrix;
  return {
    archetype: bestArchetype,
    themeColor: resolvedDef.themeColor,
    iconName: resolvedDef.iconName
  };
}

/**
 * 磁贴宽度阶梯（按占用面积从小到大）：25% → 50% → 75% → 100%
 */
const TILE_WIDTH_LADDER: TileWidth[] = [25, 50, 75, 100];

/** 在宽度阶梯上上下移动若干级（越界则钳制到端点） */
function scaleTileWidth(base: TileWidth, steps: number): TileWidth {
  const idx = TILE_WIDTH_LADDER.indexOf(base);
  if (idx < 0) return base;
  const next = Math.max(0, Math.min(TILE_WIDTH_LADDER.length - 1, idx + steps));
  return TILE_WIDTH_LADDER[next];
}

/**
 * 单次规划允许上桌的最大组件数。
 *
 * 规划器原先"命中即上桌"，且把 5 个锚点无条件塞进清单，于是桌面常年同时出现
 * 11~13 个磁贴，其中大半只是弱相关或彼此重复（sources 与 analytics_trend 都在列信源，
 * takeaways 与 topic_digest 都在复述同一段摘要）。这里按相关度截断。
 */
const MAX_PLANNED_WIDGETS = 9;

/**
 * 纯能力匹配求解组件集与排版规格 (Dynamic Capability Widget Resolver)
 * 彻底消除 switch(intent)，输出含有优先级、尺寸和自适应属性的富结构
 */
function resolveWidgetsFromCapabilities(
  capabilities: string[],
  archetype: CustomCardArchetype,
  userGoal: string,
  query: string
): WidgetPlannedItem[] {
  const capSet = new Set(capabilities.map(c => c.toLowerCase()));
  const scoredWidgets: Array<{ item: WidgetPlannedItem; score: number }> = [];

  // 能力特异性（IDF）预计算：一项能力被越多组件声明，就越"通用"，越不足以证明语义对齐。
  // 这条约束专治"声明一大串能力就能霸榜"：旧实现按命中条数等权加分 (matchCount * 12)，
  // 而 custom_cards 声明了 45 项能力，仅凭数量就恒居榜首，把真正对口的组件压了下去。
  const declaredBy = new Map<string, number>();
  for (const def of Object.values(WIDGET_REGISTRY) as WidgetDefinition[]) {
    for (const cap of new Set(def.capabilities.map(c => c.toLowerCase()))) {
      declaredBy.set(cap, (declaredBy.get(cap) || 0) + 1);
    }
  }
  const widgetTotal = Object.keys(WIDGET_REGISTRY).length;
  /** 独家能力 ≈ 1.0；被多数组件共享的通用能力被压到 0.3 附近 */
  const capabilityWeight = (cap: string): number => {
    const owners = declaredBy.get(cap) || 1;
    const idf = Math.log2(widgetTotal / owners + 1) / Math.log2(widgetTotal + 1);
    return Math.max(0.3, Math.min(1, idf));
  };
  /** 一份"独家且对口"的能力折算多少分 */
  const CAPABILITY_UNIT = 26;

  // 对全量注册表中的组件进行能力交集与适配度打分
  for (const [key, def] of Object.entries(WIDGET_REGISTRY) as [ResultWidgetKey, WidgetDefinition][]) {
    const matchedCaps = def.capabilities.filter(c => capSet.has(c.toLowerCase()));
    const matchCount = matchedCaps.length;
    // 相关度 = 命中能力的特异性之和，而不是命中条数
    const specificity = matchCount > 0
      ? matchedCaps.reduce((sum, cap) => sum + capabilityWeight(cap.toLowerCase()), 0)
      : 0;

    // 基础分来源于组件固有权重
    let dynamicScore = def.basePriority;

    // 命中能力按特异性加权：通用能力几乎不加分，独家对口能力接近满分加权
    if (matchCount > 0) {
      dynamicScore += Math.round(specificity * CAPABILITY_UNIT);
    }

    // 特殊能力直接强关联
    if (key === "custom_cards") {
      dynamicScore += 20; // 专属定制卡片始终具备最高业务表达力
    }
    if (key === "actions_toolbox" && (capSet.has("install_command") || capSet.has("download") || capSet.has("fix_command"))) {
      dynamicScore += 25;
    }
    if (key === "official_portal" && (capSet.has("official_site") || capSet.has("official_url") || capSet.has("official_portal"))) {
      dynamicScore += 20;
    }
    if (key === "comparison" && (capSet.has("compare_table") || capSet.has("feature_matrix"))) {
      dynamicScore += 25;
    }
    if (key === "verification_checklist" && (capSet.has("install_step") || capSet.has("checklist") || capSet.has("troubleshooting_audit"))) {
      dynamicScore += 18;
    }

    // 仅收录具备能力交集或作为基础信息锚点 (如 takeaways, sources) 的组件
    const isAnchorWidget = ["takeaways", "sources", "custom_cards", "actions_toolbox"].includes(key);
    if (matchCount > 0 || isAnchorWidget) {
      // 尺寸随"对口程度"伸缩：用能力特异性而非命中条数决定面积，
      // 避免一个泛化组件仅靠堆命中数就吃掉首屏大块版面。
      let finalSize = scaleTileWidth(
        def.width,
        specificity >= 2.2 ? 1 : specificity > 0 && specificity <= 0.8 ? -1 : 0
      );

      // custom_cards 是复合蓝图宿主，需要足够面积承载多分区内容：
      // 矩阵/时间线类内容偏高 -> 100% 全宽；其余业务套件 -> 75% 焦点磁贴。
      if (key === "custom_cards") {
        finalSize = archetype === "timeline" || archetype === "parameter_matrix" ? 100 : 75;
      }

      // 优先级分层：下游排版引擎（tileLayoutEngine / bentoLayoutEngine / TileDesktopView）
      // 一律按 priority 降序重排，数组顺序会被丢弃。
      // 因此必须把"是否真正命中任务能力"编码进 priority 本身，
      // 否则 basePriority 较高的固定锚点组件会永久压住意图命中的组件，
      // 导致意图分析的输出无法体现在桌面优先级上。
      // 命中层: score + MATCH_TIER_BONUS (>=142) 恒高于未命中层最大可能值 (custom_cards 95+20=115)
      const MATCH_TIER_BONUS = 100;
      const priority = matchCount > 0 ? dynamicScore + MATCH_TIER_BONUS : dynamicScore;

      scoredWidgets.push({
        item: {
          type: key,
          priority,
          size: finalSize,
          flexible: def.flexible,
          capabilities: matchedCaps,
          reason: matchCount > 0
            ? `匹配所需能力: [${matchedCaps.join(", ")}] · 对口度 ${specificity.toFixed(2)}`
            : `作为任务基础信息支撑组件`
        },
        score: dynamicScore
      });
    }
  }

  // 按综合动态得分从高到低排列（同一层级内）
  scoredWidgets.sort((a, b) => b.score - a.score);

  // 按相关度截断后提取 WidgetPlannedItem：
  // "命中即上桌"会让桌面长期堆满弱相关磁贴，与"选择更精准"背道而驰。
  const resultList = scoredWidgets.slice(0, MAX_PLANNED_WIDGETS).map(s => s.item);

  // 保证必备核心来源链：若被截断则挤掉末位弱相关组件，而不是让清单超编
  if (!resultList.some(w => w.type === "sources")) {
    const sourceItem: WidgetPlannedItem = {
      type: "sources",
      priority: 60,
      size: 50,
      flexible: false,
      reason: "信源存证与文献追溯"
    };
    if (resultList.length >= MAX_PLANNED_WIDGETS) resultList.pop();
    resultList.push(sourceItem);
  }

  return resultList;
}

/**
 * 语义驱动的多功能组件蓝图构建器 (Server-Driven UI Blueprint Synthesizer)
 * 委托至 Widget Composer 将高层业务意图、主体实体和原子能力转化为结构化、可直接渲染的功能蓝图
 */
export function buildWidgetBlueprint(
  query: string,
  results: SearchResult[],
  intentAnalysis: WidgetIntentAnalysis,
  targetLanguage?: string
): WidgetBlueprint {
  return composeWidgetsForTask({
    query,
    results,
    intentAnalysis,
    targetLanguage
  });
}

/**
 * WidgetPlannerAgent (专属小组件规划 Agent)
 * 职责：
 * 1. 深度研判用户目标与语义意图 (Widget Intent Layer)
 * 2. 梳理完成任务所需的真实能力模型 (Required Capabilities)
 * 3. 构造 Server-Driven UI 复合组件蓝图 (Widget Blueprint)
 * 4. 依据能力库 (Capability Registry) 动态规划原型与交互动作
 * 5. 计算各小组件的展示优先级 (Priority)、尺寸需求 (Size) 与可压缩程度 (Flexible)
 */
export async function planWidgetStrategy(options: {
  query: string;
  results: SearchResult[];
  targetLanguage?: string;
  env?: Record<string, string | undefined>;
  apiKey?: string;
}): Promise<WidgetPlan> {
  const { query, results, env, apiKey } = options;

  // 1. 阶段一：Widget Intent Layer 深度语义意图解析
  const intentAnalysis: WidgetIntentAnalysis = await analyzeWidgetIntent({
    query,
    results,
    targetLanguage: options.targetLanguage,
    env
  });

  // 2. 阶段二：Server-Driven UI 功能蓝图生成 (Widget Blueprint)
  const blueprint: WidgetBlueprint = buildWidgetBlueprint(query, results, intentAnalysis, options.targetLanguage);

  // 3. 基础意图分类与目标研判
  const { intent, userGoal } = await classifyQueryIntent(query, results, { env, apiKey });

  // 4. 聚合语义分析所需能力与任务能力清单
  //    关键：所有来源（intentAgent 任务能力 + LLM 自由输出 + 意图分析器）都必须先归一化到
  //    能力分类法规范 ID，否则无法命中 WIDGET_REGISTRY，组件选择会退化为锚点兜底。
  const taskCaps = await planTaskCapabilities(intent, userGoal, query, results, { env, apiKey });

  // 4.1 两个意图分类器的一致性裁决
  //     intentAgent 只看 query 关键词，语义分析器同时看检索结果，二者判定可能冲突。
  //     冲突时若无条件并集能力，会把无关业务域的能力注入任务
  //     （实测: query="Photoshop" -> intentAgent 落 explain 兜底 -> 注入 concept_definition/
  //      mindmap_tree，导致下载任务里思维导图排到下载入口之前）。
  const analyzerIntent = intentAnalysis.intent;
  const analyzerConfidence = intentAnalysis.confidence ?? 0;
  const alignedIntents = INTENT_TAXONOMY_ALIGNMENT[intent] || [];
  const analyzerIsSpecific =
    !GENERIC_INTENTS.includes(analyzerIntent) &&
    analyzerConfidence >= INTENT_CONFIDENCE_OVERRIDE_THRESHOLD;
  const intentsDisagree = analyzerIsSpecific && !alignedIntents.includes(analyzerIntent);

  let rawCapabilities: string[];
  if (intentsDisagree) {
    // 语义分析器看到了检索结果，证据更强 -> 以其能力为准，阻断跨域任务能力注入
    rawCapabilities = [...(intentAnalysis.requiredCapabilities || [])];
    console.warn(
      `[WidgetPlanner] 意图分类冲突: intentAgent="${intent}" vs analyzer="${analyzerIntent}"` +
        `(confidence=${analyzerConfidence})，采用语义分析器结果，丢弃 intentAgent 的 ` +
        `${(taskCaps.required_capabilities || []).length} 项任务能力`
    );
  } else {
    rawCapabilities = [
      ...(taskCaps.required_capabilities || []),
      ...(intentAnalysis.requiredCapabilities || [])
    ];
  }

  const normalized = normalizeCapabilities(rawCapabilities);
  const capabilities: string[] = normalized.canonical;

  if (normalized.unmapped.length > 0) {
    console.warn(
      `[WidgetPlanner] 丢弃 ${normalized.unmapped.length} 个未登记能力 (词表漂移): ${normalized.unmapped.join(", ")}`
    );
  }
  if (normalized.remapped.length > 0) {
    console.info(
      `[WidgetPlanner] 能力别名归一化 ${normalized.remapped.length} 项: ` +
        normalized.remapped.map((r) => `${r.from}->${r.to}`).join(", ")
    );
  }

  // 归一化后为空说明意图与组件能力完全脱节，回落确定性意图能力表兜底
  if (capabilities.length === 0) {
    const fallback = INTENT_CAPABILITIES_MAP[intentAnalysis.intent];
    if (fallback) {
      capabilities.push(...fallback);
      console.warn(
        `[WidgetPlanner] 归一化后能力为空，回落 intent="${intentAnalysis.intent}" 确定性能力表 (${fallback.length} 项)`
      );
    }
  }

  // 冲突时 userGoal 文案同步采用语义分析器的目标，避免与能力集自相矛盾
  const resolvedUserGoal = intentsDisagree
    ? INTENT_GOAL_LABELS[analyzerIntent] || userGoal
    : userGoal;

  // 5. 纯能力驱动：匹配最适卡片原型 (Archetype)
  const { archetype: suggestedArchetype, themeColor, iconName } = resolveArchetypeFromCapabilities(capabilities, query);

  // 6. 生成可执行的真实 Tool Registry 动作
  const primaryActions: WidgetAction[] = synthesizeToolActions(query, results, intent as any);

  // 7. 纯能力驱动：匹配与加权排列小组件集 (Widget Planned Items with Priority & Size)
  const plannedWidgets = resolveWidgetsFromCapabilities(capabilities, suggestedArchetype, resolvedUserGoal, query);
  const widgetOrder = plannedWidgets.map(w => w.type);

  return {
    intent,
    userGoal: resolvedUserGoal,
    suggestedArchetype,
    capabilities,
    widgets: plannedWidgets,
    widgetOrder,
    primaryActions,
    intentAnalysis,
    blueprint,
    widgetCustomizations: {
      cardTitle: blueprint.title,
      cardSubtitle: blueprint.subtitle,
      suggestedArchetype,
      themeColor: blueprint.themeColor || themeColor,
      iconName
    }
  };
}
