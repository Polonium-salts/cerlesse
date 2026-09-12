import { 
  QueryIntent, 
  CustomCardArchetype, 
  ResultWidgetKey, 
  WidgetPlan, 
  SearchResult, 
  WidgetAction,
  WidgetPlannedItem,
  WidgetPlannedSize,
  WidgetIntentAnalysis,
  WidgetBlueprint,
  BlueprintComponent
} from "../src/types.js";
import { classifyQueryIntent, planTaskCapabilities } from "./intentAgent.js";
import { synthesizeToolActions } from "./toolRegistry.js";
import { analyzeWidgetIntent, INTENT_CAPABILITIES_MAP } from "./widgetIntentAnalyzer.js";
import { normalizeCapabilities, INTENT_TAXONOMY_ALIGNMENT, GENERIC_INTENTS, INTENT_CONFIDENCE_OVERRIDE_THRESHOLD, INTENT_GOAL_LABELS, type CanonicalCapability } from "../src/widgets/capabilityTaxonomy.js";
import { composeWidgetsForTask } from "./widgetComposer.js";

// ==========================================
// 1. Archetype Capability Registry (原型能力库)
// 业务原型声明所能提供的能力集合
// ==========================================
interface ArchetypeDefinition {
  archetype: CustomCardArchetype;
  capabilities: string[];
  themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
  iconName: string;
  defaultSize: WidgetPlannedSize;
  matchPatterns?: RegExp;
}

const ARCHETYPE_REGISTRY: Record<CustomCardArchetype, ArchetypeDefinition> = {
  download_hub: {
    archetype: "download_hub",
    capabilities: ["download", "releases", "binary", "system_requirements", "package_manager", "installer", "install_command"],
    themeColor: "blue",
    iconName: "Download",
    defaultSize: "large",
    matchPatterns: /(下载|安装包|release|installer|client|客户端|安装教程)/i
  },
  action_checklist: {
    archetype: "action_checklist",
    capabilities: ["install_step", "checklist", "step_by_step", "environment_checklist", "troubleshooting_audit", "prerequisites_check", "fix_command", "verification"],
    themeColor: "emerald",
    iconName: "CheckCircle",
    defaultSize: "large",
    matchPatterns: /(步骤|排查|checklist|清单|指南|排错|配置步骤)/i
  },
  tool_discovery: {
    archetype: "tool_discovery",
    capabilities: ["tool_cards", "demo_button", "try_online", "software_directory", "online_tool", "free_tool", "pricing_comparison"],
    themeColor: "emerald",
    iconName: "Wrench",
    defaultSize: "large",
    matchPatterns: /(工具|在线|推荐|转换器|免安装|体验|网站推荐)/i
  },
  travel_itinerary: {
    archetype: "travel_itinerary",
    capabilities: ["itinerary_timeline", "travel_budget", "booking_resources", "attractions_map", "sightseeing", "route_plan"],
    themeColor: "amber",
    iconName: "Compass",
    defaultSize: "full",
    matchPatterns: /(旅游|攻略|行程|路线|景点|门票|自驾|几日游)/i
  },
  pros_cons: {
    archetype: "pros_cons",
    capabilities: ["pros_cons", "tradeoffs", "risk_mitigation", "advantages_disadvantages"],
    themeColor: "violet",
    iconName: "Scale",
    defaultSize: "large",
    matchPatterns: /(优缺点|利弊|权衡|避坑|优势与不足)/i
  },
  verdict_summary: {
    archetype: "verdict_summary",
    capabilities: ["verdict_recommendation", "scenario_selection", "best_choice", "decision_matrix", "final_advice"],
    themeColor: "violet",
    iconName: "Scale",
    defaultSize: "large",
    matchPatterns: /(谁更好|推荐|买哪个|选型|裁决|选哪个|pk)/i
  },
  parameter_matrix: {
    archetype: "parameter_matrix",
    capabilities: ["parameter_matrix", "spec_matrix", "spec_comparison", "benchmark_table", "feature_matrix", "concept_definition", "deep_report", "industry_matrix"],
    themeColor: "zinc",
    iconName: "Layers",
    defaultSize: "full",
    matchPatterns: /(参数|指标|规格|基准|配置对比|矩阵|概念|原理|什么是)/i
  },
  timeline: {
    archetype: "timeline",
    capabilities: ["timeline_evolution", "milestones", "history", "version_history", "roadmap"],
    themeColor: "zinc",
    iconName: "Calendar",
    defaultSize: "full",
    matchPatterns: /(演进|历程|版本历史|发展史|里程碑|时间线)/i
  },
  quote_dossier: {
    archetype: "quote_dossier",
    capabilities: ["quote_dossier", "expert_opinion", "literature_archive", "viewpoints"],
    themeColor: "blue",
    iconName: "Quote",
    defaultSize: "large",
    matchPatterns: /(言论|评价|争议|观点|评语)/i
  },
  schema: {
    archetype: "schema",
    capabilities: ["custom_schema", "declarative_ui", "dynamic_components"],
    themeColor: "blue",
    iconName: "Box",
    defaultSize: "large",
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
  basePriority: number; // 1 - 100
  defaultSize: WidgetPlannedSize;
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
    basePriority: 95,
    defaultSize: "large",
    flexible: true,
    isActionOriented: true
  },
  actions_toolbox: {
    type: "actions_toolbox",
    capabilities: ["install_command", "copy_text", "quick_action", "cli_execution", "quick_links", "code_snippet", "fix_command", "download", "git_clone"],
    basePriority: 88,
    defaultSize: "wide",
    flexible: true,
    isActionOriented: true
  },
  official_portal: {
    type: "official_portal",
    capabilities: ["official_site", "official_url", "verified_docs", "authoritative_entry", "official_portal", "booking_resources", "service_status", "contact_entry"],
    basePriority: 85,
    defaultSize: "medium",
    flexible: true,
    isActionOriented: true
  },
  verification_checklist: {
    type: "verification_checklist",
    capabilities: ["troubleshooting_audit", "fact_check", "prerequisites_check", "security_audit", "environment_checklist", "error_diagnosis", "verification_checklist"],
    basePriority: 80,
    defaultSize: "large",
    flexible: true,
    isActionOriented: true
  },
  comparison: {
    type: "comparison",
    capabilities: ["compare_table", "feature_matrix", "cross_compare", "dimension_pk", "spec_comparison", "benchmark_table"],
    basePriority: 86,
    defaultSize: "full",
    flexible: false,
    isActionOriented: false
  },
  mindmap: {
    type: "mindmap",
    capabilities: ["knowledge_topology", "architecture_tree", "subsystem_mapping", "mindmap_tree", "concept_definition", "roadmap_step", "core_principles", "typical_scenarios"],
    basePriority: 82,
    defaultSize: "large",
    flexible: true,
    isActionOriented: false
  },
  quick_answer: {
    type: "quick_answer",
    capabilities: ["instant_verdict", "definition_snippet", "concept_definition", "direct_answer"],
    basePriority: 90,
    defaultSize: "wide",
    flexible: true,
    isActionOriented: false
  },
  takeaways: {
    type: "takeaways",
    capabilities: ["bullet_conclusions", "high_density_takeaways", "summary_points"],
    basePriority: 84,
    defaultSize: "medium",
    flexible: true,
    isActionOriented: false
  },
  sources: {
    type: "sources",
    capabilities: ["evidence_chain", "citation_retrieval", "literature_archive", "literature_sources"],
    basePriority: 72,
    defaultSize: "wide",
    flexible: false,
    isActionOriented: false
  },
  topic_digest: {
    type: "topic_digest",
    capabilities: ["faceted_deep_dive", "multi_aspect_summary", "code_explanation", "related_topics"],
    basePriority: 65,
    defaultSize: "large",
    flexible: true,
    isActionOriented: false
  },
  analytics_trend: {
    type: "analytics_trend",
    capabilities: ["trend_signals", "sentiment_distribution", "temporal_evolution", "temporal_analysis", "weather_forecast", "weather_indices"],
    basePriority: 60,
    defaultSize: "wide",
    flexible: true,
    isActionOriented: false
  },
  fast_chat: {
    type: "fast_chat",
    capabilities: ["interactive_followup_chat", "question_answering"],
    basePriority: 55,
    defaultSize: "medium",
    flexible: true,
    isActionOriented: true
  },
  followup: {
    type: "followup",
    capabilities: ["smart_followup_prompts"],
    basePriority: 50,
    defaultSize: "small",
    flexible: true,
    isActionOriented: false
  },
  metrics_telemetry: {
    type: "metrics_telemetry",
    capabilities: ["source_telemetry", "confidence_meter"],
    basePriority: 45,
    defaultSize: "small",
    flexible: true,
    isActionOriented: false
  },
  mobile_qr: {
    type: "mobile_qr",
    capabilities: ["mobile_handoff", "qr_scan_action"],
    basePriority: 40,
    defaultSize: "small",
    flexible: true,
    isActionOriented: true
  },
  agent_workflow: {
    type: "agent_workflow",
    capabilities: ["agent_telemetry", "dag_trace"],
    basePriority: 35,
    defaultSize: "wide",
    flexible: true,
    isActionOriented: false
  },
  ai_overview: {
    type: "ai_overview",
    capabilities: ["overview_synthesis"],
    basePriority: 30,
    defaultSize: "full",
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
 * 磁贴尺寸阶梯（按占用面积从小到大）
 *   small 2x2  <  medium 4x2  <  wide 6x2  <  large 4x4  <  full 12x4
 */
const TILE_SIZE_LADDER: WidgetPlannedSize[] = ["small", "medium", "wide", "large", "full"];

/** 在尺寸阶梯上上下移动若干级（越界则钳制到端点） */
function scaleTileSize(base: WidgetPlannedSize, steps: number): WidgetPlannedSize {
  const idx = TILE_SIZE_LADDER.indexOf(base);
  if (idx < 0) return base;
  const next = Math.max(0, Math.min(TILE_SIZE_LADDER.length - 1, idx + steps));
  return TILE_SIZE_LADDER[next];
}

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

  // 对全量注册表中的组件进行能力交集与适配度打分
  for (const [key, def] of Object.entries(WIDGET_REGISTRY) as [ResultWidgetKey, WidgetDefinition][]) {
    const matchedCaps = def.capabilities.filter(c => capSet.has(c.toLowerCase()));
    const matchCount = matchedCaps.length;

    // 基础分来源于组件固有权重
    let dynamicScore = def.basePriority;

    // 若命中规划能力，获得高额相关度加权 (每项能力 +12 分)
    if (matchCount > 0) {
      dynamicScore += matchCount * 12;
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

    // 仅收录具备能力交集或作为基础信息锚点 (如 quick_answer, takeaways, sources) 的组件
    const isAnchorWidget = ["quick_answer", "takeaways", "sources", "custom_cards", "actions_toolbox"].includes(key);
    if (matchCount > 0 || isAnchorWidget) {
      // 尺寸随"命中多少任务能力"伸缩：命中越多面积越大（最多升一级），
      // 只命中 1 项则降一级。这让磁贴比例真正跟随任务，而不是所有组件共用固定比例。
      let finalSize = scaleTileSize(
        def.defaultSize,
        matchCount >= 3 ? 1 : matchCount === 1 ? -1 : 0
      );

      // custom_cards 是复合蓝图宿主，需要足够面积承载多分区内容：
      // 矩阵/时间线类内容偏高 -> full 全宽；其余业务套件 -> large 4x4 正方形焦点磁贴。
      if (key === "custom_cards") {
        finalSize = archetype === "timeline" || archetype === "parameter_matrix" ? "full" : "large";
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
            ? `匹配所需能力: [${matchedCaps.join(", ")}]` 
            : `作为任务基础信息支撑组件`
        },
        score: dynamicScore
      });
    }
  }

  // 按综合动态得分从高到低排列（同一层级内）
  scoredWidgets.sort((a, b) => b.score - a.score);

  // 提取排序后的 WidgetPlannedItem
  const resultList = scoredWidgets.map(s => s.item);

  // 保证必备核心来源链
  if (!resultList.some(w => w.type === "sources")) {
    resultList.push({
      type: "sources",
      priority: 60,
      size: "medium",
      flexible: false,
      reason: "信源存证与文献追溯"
    });
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
