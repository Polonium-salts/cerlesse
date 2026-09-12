import { 
  QueryIntent, 
  CustomCardArchetype, 
  ResultWidgetKey, 
  WidgetPlan, 
  SearchResult, 
  WidgetAction,
  WidgetPlannedItem,
  WidgetPlannedSize
} from "../src/types.js";
import { classifyQueryIntent, planTaskCapabilities } from "./intentAgent.js";
import { synthesizeToolActions } from "./toolRegistry.js";

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
    capabilities: [
      "download", "releases", "tool_cards", "demo_button", "try_online",
      "itinerary_timeline", "travel_budget", "pros_cons", "checklist",
      "install_step", "verdict_recommendation", "parameter_matrix",
      "timeline_evolution", "quote_dossier"
    ],
    basePriority: 95,
    defaultSize: "large",
    flexible: true,
    isActionOriented: true
  },
  actions_toolbox: {
    type: "actions_toolbox",
    capabilities: ["install_command", "copy_text", "quick_action", "cli_execution", "quick_links", "code_snippet", "fix_command"],
    basePriority: 88,
    defaultSize: "medium",
    flexible: true,
    isActionOriented: true
  },
  official_portal: {
    type: "official_portal",
    capabilities: ["official_site", "official_url", "verified_docs", "authoritative_entry", "official_portal", "booking_resources"],
    basePriority: 85,
    defaultSize: "medium",
    flexible: true,
    isActionOriented: true
  },
  verification_checklist: {
    type: "verification_checklist",
    capabilities: ["troubleshooting_audit", "fact_check", "prerequisites_check", "security_audit", "environment_checklist", "error_diagnosis"],
    basePriority: 80,
    defaultSize: "medium",
    flexible: true,
    isActionOriented: true
  },
  comparison: {
    type: "comparison",
    capabilities: ["compare_table", "feature_matrix", "cross_compare", "dimension_pk", "spec_comparison"],
    basePriority: 86,
    defaultSize: "large",
    flexible: false,
    isActionOriented: false
  },
  mindmap: {
    type: "mindmap",
    capabilities: ["knowledge_topology", "architecture_tree", "subsystem_mapping", "mindmap_tree", "concept_definition"],
    basePriority: 82,
    defaultSize: "large",
    flexible: true,
    isActionOriented: false
  },
  quick_answer: {
    type: "quick_answer",
    capabilities: ["instant_verdict", "definition_snippet", "concept_definition", "direct_answer"],
    basePriority: 90,
    defaultSize: "medium",
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
    defaultSize: "medium",
    flexible: false,
    isActionOriented: false
  },
  topic_digest: {
    type: "topic_digest",
    capabilities: ["faceted_deep_dive", "multi_aspect_summary", "code_explanation"],
    basePriority: 65,
    defaultSize: "medium",
    flexible: true,
    isActionOriented: false
  },
  analytics_trend: {
    type: "analytics_trend",
    capabilities: ["trend_signals", "sentiment_distribution", "temporal_evolution", "temporal_analysis"],
    basePriority: 60,
    defaultSize: "medium",
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
    defaultSize: "medium",
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
      let finalSize = def.defaultSize;

      // 在 iOS / Android 模组桌面中，custom_cards 默认采用黄金比例 4x4 (large) 或 4x2 (medium)，与相邻卡片并排拼合
      if (key === "custom_cards") {
        finalSize = archetype === "timeline" || archetype === "parameter_matrix" ? "large" : "medium";
      }

      scoredWidgets.push({
        item: {
          type: key,
          priority: dynamicScore,
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

  // 按综合动态得分从高到低排列
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
 * WidgetPlannerAgent (专属小组件规划 Agent)
 * 职责：
 * 1. 深度研判用户目标与意图 (Intent)
 * 2. 梳理完成任务所需的真实能力模型 (Capabilities)
 * 3. 依据能力库 (Capability Registry) 动态规划原型与交互动作
 * 4. 计算各小组件的展示优先级 (Priority)、尺寸需求 (Size) 与可压缩程度 (Flexible)
 */
export async function planWidgetStrategy(options: {
  query: string;
  results: SearchResult[];
  targetLanguage?: string;
}): Promise<WidgetPlan> {
  const { query, results } = options;

  // 1. 意图分类与目标研判
  const { intent, userGoal } = await classifyQueryIntent(query, results);

  // 2. 规划完成该任务所需的能力清单 (从能力库获取 required_capabilities)
  const taskCaps = await planTaskCapabilities(intent, userGoal, query, results);
  const capabilities = taskCaps.required_capabilities || [];

  // 3. 纯能力驱动：匹配最适卡片原型 (Archetype)，绝无 switch(intent) 规则硬编码
  const { archetype: suggestedArchetype, themeColor, iconName } = resolveArchetypeFromCapabilities(capabilities, query);

  // 4. 生成可执行的真实 Tool Registry 动作
  const primaryActions: WidgetAction[] = synthesizeToolActions(query, results, intent as any);

  // 5. 纯能力驱动：匹配与加权排列小组件集 (Widget Planned Items with Priority & Size)
  const plannedWidgets = resolveWidgetsFromCapabilities(capabilities, suggestedArchetype, userGoal, query);
  const widgetOrder = plannedWidgets.map(w => w.type);

  return {
    intent,
    userGoal,
    suggestedArchetype,
    capabilities,
    widgets: plannedWidgets,
    widgetOrder,
    primaryActions,
    widgetCustomizations: {
      suggestedArchetype,
      themeColor,
      iconName
    }
  };
}
