import { 
  QueryIntent, 
  CustomCardArchetype, 
  ResultWidgetKey, 
  WidgetPlan, 
  SearchResult, 
  WidgetAction,
  WidgetPlannedItem,
  WidgetIntentAnalysis
} from "../src/types.js";
import type { TileWidth } from "../src/lib/tileLayoutEngine.js";
import { classifyQueryIntent, planTaskCapabilities } from "./intentAgent.js";
import { synthesizeToolActions } from "./toolRegistry.js";
import { analyzeWidgetIntent, INTENT_CAPABILITIES_MAP } from "./widgetIntentAnalyzer.js";
import { normalizeCapabilities, INTENT_TAXONOMY_ALIGNMENT, GENERIC_INTENTS, INTENT_CONFIDENCE_OVERRIDE_THRESHOLD, INTENT_GOAL_LABELS, ARCHETYPE_PROFILES, OFFICIAL_WIDGET_PROFILES, type CanonicalCapability } from "../src/widgets/capabilityTaxonomy.js";
import { retrieveWidgets, getAllUnifiedCatalogItems, getUnifiedCatalogItem } from "../src/widgets/widgetRetriever.js";
import { selectAndReRankWidgets } from "./widgetSelector.js";
import { getRouteForIntent, isWidgetForbidden, normalizeIntent } from "./agentRouter.js";

/**
 * 彻底禁用的原型名单 (Hard Disabled Archetypes)
 * 即使历史提示词、缓存或 LLM 生成了这些原型，也会在进入规划/选择阶段前被强制拦截并丢弃。
 */
export const DISABLED_ARCHETYPES = new Set<string>([
  "action_checklist",
  "timeline",
]);

export function isArchetypeAllowed(archetype: string): boolean {
  return !DISABLED_ARCHETYPES.has(archetype);
}

const ARCHETYPE_METADATA: Record<string, { themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc"; iconName: string; pattern?: RegExp }> = {
  download_hub: { themeColor: "blue", iconName: "Download", pattern: /(下载|安装包|release|installer|client|客户端|安装教程)/i },
  tool_discovery: { themeColor: "emerald", iconName: "Wrench", pattern: /(工具|在线|推荐|转换器|免安装|体验|网站推荐)/i },
  travel_itinerary: { themeColor: "amber", iconName: "Compass", pattern: /(旅游|攻略|行程|路线|景点|门票|自驾|几日游)/i },
  pros_cons: { themeColor: "violet", iconName: "Scale", pattern: /(优缺点|利弊|权衡|避坑|优势与不足)/i },
  verdict_summary: { themeColor: "violet", iconName: "Scale", pattern: /(谁更好|推荐|买哪个|选型|裁决|选哪个|pk)/i },
  parameter_matrix: { themeColor: "zinc", iconName: "Layers", pattern: /(参数|指标|规格|基准|配置对比|矩阵|概念|原理|什么是)/i },
  quote_dossier: { themeColor: "blue", iconName: "Quote", pattern: /(言论|评价|争议|观点|评语)/i },
  schema: { themeColor: "blue", iconName: "Box", pattern: /(schema|组件|蓝图|动态组件)/i }
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
  let bestArchetype: CustomCardArchetype = /(言论|评价|争议|观点)/i.test(query)
    ? "quote_dossier"
    : "parameter_matrix";
  let maxScore = 0;

  for (const [archKey, meta] of Object.entries(ARCHETYPE_METADATA) as [CustomCardArchetype, { themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc"; iconName: string; pattern?: RegExp }][]) {
    if (!isArchetypeAllowed(archKey)) continue;
    let score = 0;
    const profile = ARCHETYPE_PROFILES[archKey];
    if (profile?.tags) {
      for (const tag of profile.tags) {
        if (capSet.has(tag.toLowerCase())) score += 10;
      }
    }
    if (meta.pattern && meta.pattern.test(query)) {
      score += 15;
    }
    if (score > maxScore) {
      maxScore = score;
      bestArchetype = archKey;
    }
  }

  const resolvedDef = ARCHETYPE_METADATA[bestArchetype] || ARCHETYPE_METADATA.parameter_matrix;
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
 * 彻底消除 switch(intent)，基于统一 Extension Catalog 输出含有优先级、尺寸和自适应属性的富结构
 */
function resolveWidgetsFromCapabilities(
  capabilities: string[],
  archetype: CustomCardArchetype,
  userGoal: string,
  query: string
): WidgetPlannedItem[] {
  const capSet = new Set(capabilities.map(c => c.toLowerCase()));
  const scoredWidgets: Array<{ item: WidgetPlannedItem; score: number }> = [];

  const catalogItems = getAllUnifiedCatalogItems();
  const declaredBy = new Map<string, number>();
  for (const def of catalogItems) {
    for (const cap of new Set(def.capabilities.map(c => c.toLowerCase()))) {
      declaredBy.set(cap, (declaredBy.get(cap) || 0) + 1);
    }
  }
  const widgetTotal = catalogItems.length;
  /** 独家能力 ≈ 1.0；被多数组件共享的通用能力被压到 0.3 附近 */
  const capabilityWeight = (cap: string): number => {
    const owners = declaredBy.get(cap) || 1;
    const idf = Math.log2(widgetTotal / owners + 1) / Math.log2(widgetTotal + 1);
    return Math.max(0.3, Math.min(1, idf));
  };
  /** 一份"独家且对口"的能力折算多少分 */
  const CAPABILITY_UNIT = 26;

  // 对全量统一注册表中的组件进行能力交集与适配度打分
  for (const def of catalogItems) {
    const key = def.id;
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
    if (key === "actions_toolbox" && (capSet.has("install_command") || capSet.has("download") || capSet.has("fix_command"))) {
      dynamicScore += 25;
    }
    if (key === "related_links" && (capSet.has("official_site") || capSet.has("official_url") || capSet.has("official_portal"))) {
      dynamicScore += 20;
    }
    if (key === "comparison" && (capSet.has("compare_table") || capSet.has("feature_matrix"))) {
      dynamicScore += 25;
    }
    if (key === "verification_checklist" && (capSet.has("install_step") || capSet.has("checklist") || capSet.has("troubleshooting_audit"))) {
      dynamicScore += 18;
    }
    if (key === "search_engine" && (capSet.has("search_engine_redirect") || capSet.has("external_search_query") || /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query))) {
      dynamicScore += 35;
    }
    if (key === "translation" && (capSet.has("language_translation") || capSet.has("text_translation") || /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i.test(query))) {
      dynamicScore += 45;
    }
    if (key === "weather" && (capSet.has("weather_current") || capSet.has("weather_forecast") || /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(query))) {
      dynamicScore += 45;
    }
    if (key === "troubleshooting" && (capSet.has("error_diagnosis") || capSet.has("fix_command") || capSet.has("troubleshooting_audit") || /(报错|错误|失败|failed|error|bug|crash|崩溃|无法启动|解决办法|code \d+)/i.test(query))) {
      dynamicScore += 48;
    }

    // 垂直专属组件（天气、翻译、排错流程、搜索引擎直达、Token监控）：必须满足能力交集或强领域正则命中，严禁无脑默认收录
    const isDomainQueryMatch =
      (key === "weather" && (capSet.has("weather_current") || capSet.has("weather_forecast") || /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(query))) ||
      (key === "translation" && (capSet.has("language_translation") || capSet.has("text_translation") || /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i.test(query))) ||
      (key === "troubleshooting" && (capSet.has("error_diagnosis") || capSet.has("fix_command") || capSet.has("troubleshooting_audit") || /(报错|错误|失败|failed|error|bug|crash|崩溃|无法启动|解决办法|code \d+)/i.test(query))) ||
      (key === "search_engine" && (capSet.has("search_engine_redirect") || capSet.has("external_search_query") || /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query))) ||
      (key === "token_usage" && (capSet.has("token_metrics") || capSet.has("cost_analysis") || /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i.test(query)));

    const isSpecializedWidget = ["weather", "translation", "search_engine", "token_usage"].includes(key);

    if (isSpecializedWidget) {
      if (matchCount === 0 && !isDomainQueryMatch) {
        continue;
      }
    } else {
      const isBaseSupport = ["ai_answer", "related_links", "sources"].includes(key);
      if (matchCount === 0 && !isBaseSupport) {
        continue;
      }
    }
      // 尺寸随"对口程度"伸缩：用能力特异性而非命中条数决定面积，
      // 避免一个泛化组件仅靠堆命中数就吃掉首屏大块版面。
      let finalSize = def.flexible
        ? scaleTileWidth(
            def.defaultSpan,
            specificity >= 2.2 ? 1 : specificity > 0 && specificity <= 0.8 ? -1 : 0
          )
        : def.defaultSpan;

      if (key === "image_gallery") {
        finalSize = 75;
      }

      // 优先级分层：下游排版引擎（tileLayoutEngine / bentoLayoutEngine / TileDesktopView）
      // 一律按 priority 降序重排，数组顺序会被丢弃。
      // 因此必须把"是否真正命中任务能力"编码进 priority 本身，
      // 否则 basePriority 较高的固定锚点组件会永久压住意图命中的组件，
      // 导致意图分析的输出无法体现在桌面优先级上。
      // 命中层: score + MATCH_TIER_BONUS (>=142) 恒高于未命中层最大可能值
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

  // 按综合动态得分从高到低排列（同一层级内）
  scoredWidgets.sort((a, b) => b.score - a.score);

  // 按相关度截断后提取 WidgetPlannedItem：
  const resultList = scoredWidgets.slice(0, MAX_PLANNED_WIDGETS).map(s => s.item);

  // 保证三大核心基底锚点稳定上桌 (ai_answer, related_links, sources)
  if (!resultList.some(w => w.type === "ai_answer")) {
    resultList.unshift({
      type: "ai_answer",
      priority: 95,
      size: 50,
      flexible: true,
      reason: "全网检索核心速答基底"
    });
  }
  if (!resultList.some(w => w.type === "related_links")) {
    resultList.push({
      type: "related_links",
      priority: 90,
      size: 50,
      flexible: true,
      reason: "官方认证入口与导航直达"
    });
  }
  if (!resultList.some(w => w.type === "sources")) {
    const sourceItem: WidgetPlannedItem = {
      type: "sources",
      priority: 85,
      size: 50,
      flexible: false,
      reason: "信源存证与文献追溯"
    };
    resultList.push(sourceItem);
  }

  // 仅在明确命中图片图集能力或视觉素材搜索时才纳入 image_gallery
  const hasImageNeed = capSet.has("image_gallery") || capSet.has("resource_preview") || /(素材|图片|照片|图集|图库|壁纸|外观图)/i.test(query);
  if (hasImageNeed && !resultList.some(w => w.type === "image_gallery")) {
    const imageGalleryItem: WidgetPlannedItem = {
      type: "image_gallery",
      priority: 74,
      size: 75,
      flexible: false,
      reason: "全网检索图片素材与视觉图集"
    };
    resultList.push(imageGalleryItem);
  }

  return resultList;
}

/**
 * WidgetPlannerAgent (专属小组件规划 Agent)
 * 职责：
 * 1. 深度研判用户目标与语义意图 (Widget Intent Layer)
 * 2. 梳理完成任务所需的真实能力模型 (Required Capabilities)
 * 3. 依据能力库 (Capability Registry) 动态规划原型与交互动作
 * 4. 计算各小组件的展示优先级 (Priority)、尺寸需求 (Size) 与可压缩程度 (Flexible)
 */
export async function planWidgetStrategy(options: {
  query: string;
  results: SearchResult[];
  targetLanguage?: string;
  env?: Record<string, string | undefined>;
  apiKey?: string;
  model?: string;
}): Promise<WidgetPlan> {
  const { query, results, env, apiKey } = options;

  // 1. 阶段一：Widget Intent Layer 深度语义意图解析
  const intentAnalysis: WidgetIntentAnalysis = await analyzeWidgetIntent({
    query,
    results,
    targetLanguage: options.targetLanguage,
    env
  });

  // 2. 基础意图分类与目标研判
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

  // 7. Widget Registry → 语义召回 (Orama) → Agent 重排 (WidgetSelector) → 规则校验 (Zod)
  let plannedWidgets: WidgetPlannedItem[] = [];
  let widgetOrder: ResultWidgetKey[] = [];

  try {
    const candidates = await retrieveWidgets(query, {
      intent,
      capabilities,
      signals: {
        sourceCount: results.length,
        hasOfficial: results.some(r => r.isOfficial),
        hasMultipleEntities: /(与|和|vs|对比|区别|选型|相比)/i.test(query),
        hasCodeSnippet: /(代码|code|python|js|ts|rust|golang|npm|pip|docker)/i.test(query),
        hasInstallCommand: /(install|下载|安装|部署|docker|brew)/i.test(query)
      }
    });

    const selectorResult = await selectAndReRankWidgets({
      query,
      intent,
      userGoal: resolvedUserGoal,
      candidates,
      apiKey: options.apiKey,
      model: options.model
    });

    plannedWidgets = selectorResult.plannedWidgets;
    widgetOrder = selectorResult.widgetOrder;
  } catch (err) {
    console.warn("[WidgetPlanner] Error in semantic retrieval / re-ranking, falling back to capability baseline:", err);
    plannedWidgets = resolveWidgetsFromCapabilities(capabilities, suggestedArchetype, resolvedUserGoal, query);
    widgetOrder = plannedWidgets.map(w => w.type);
  }

  // 严格依据 Agent Router 过滤黑名单组件
  const canonicalIntent = normalizeIntent(intent);
  plannedWidgets = plannedWidgets.filter(w => !isWidgetForbidden(w.type, canonicalIntent));
  widgetOrder = widgetOrder.filter(k => !isWidgetForbidden(k, canonicalIntent));

  // 仅在明确符合意图与能力时补充 image_gallery
  const route = getRouteForIntent(canonicalIntent);
  const shouldHaveImages = route.requiresImages || capabilities.includes("image_gallery") || capabilities.includes("resource_preview");
  if (shouldHaveImages && !isWidgetForbidden("image_gallery", canonicalIntent) && !plannedWidgets.some(w => w.type === "image_gallery")) {
    plannedWidgets.push({
      type: "image_gallery",
      priority: 74,
      size: 75,
      flexible: false,
      reason: "全网检索图片素材与视觉图集"
    });
    if (!widgetOrder.includes("image_gallery")) {
      widgetOrder.push("image_gallery");
    }
  }

  return {
    intent: canonicalIntent,
    userGoal: resolvedUserGoal,
    suggestedArchetype,
    allowCustomCard: false,
    capabilities,
    widgets: plannedWidgets,
    widgetOrder,
    primaryActions,
    intentAnalysis,
    widgetCustomizations: {
      suggestedArchetype,
      themeColor,
      iconName
    }
  };
}
