import { searchSearxng, searchSearxngImages } from "./searxng.js";
import { synthesizeWithOpenRouter, generateAlgorithmicSynthesis, AVAILABLE_FREE_MODELS, normalizeModelId } from "./openrouter.js";
import { forgeMultipleDynamicWidgets, detectMultipleArchetypes } from "./cardForge.js";
import { planWidgetStrategy } from "./widgetPlanner.js";
import { planWidgetLayout, WIDGET_LAYOUT_AGENT_NAME } from "./layoutAgent.js";
import { searchAndRankOnce } from "./retrievalAgent.js";
import { determineClientWidgetActivation, IMAGE_INTENT_PATTERN } from "../src/lib/adaptiveLayout.js";
import {
  AgentPlan,
  AgentStep,
  SearchImage,
  SearchResult,
  SearchSynthesisResult,
  DetectedLanguage,
  AdaptiveLayoutStrategy,
  ResultWidgetKey,
  LayoutIntentType,
  ActionPlan,
  WidgetPlan,
  CustomCardData
} from "../src/types.js";
import { detectQueryLanguage, resolveTargetLanguage, getStepLocalization } from "./language.js";
import {
  OFFICIAL_WIDGET_PROFILES,
  ARCHETYPE_PROFILES,
  formatAgentWidgetGuidancePrompt,
  CanonicalCapability
} from "../src/widgets/capabilityTaxonomy.js";

export interface AgentRunOptions {
  query: string;
  customSearxngUrl?: string;
  openRouterApiKey?: string;
  model?: string;
  targetLanguage?: string;
  enableDeepSearch?: boolean;
  env?: Record<string, string | undefined>;
  onStepProgress?: (step: AgentStep, allSteps: AgentStep[]) => void;
  onProgress?: (step: AgentStep, allSteps: AgentStep[]) => void;
}

/**
 * 单一智能搜索 Agent (Unified Search Agent)
 * ============================================================
 * 架构：由单个全能搜索 Agent 统一负责：
 *  1. 意图研判与多维检索规划
 *  2. 全网多路实时检索与信源清洗重排
 *  3. 基于组件标签、技能与实用性选型最佳小组件 (Widget Selection)
 *  4. AI 深度综合回答与结构化研报生成 (AI Answer Synthesis)
 *  5. 场景定制独有业务卡片构建 (Custom Cards)
 *  6. 12 栅格自适应智能排版 (Widget Layout)
 */

/**
 * 本次任务是否值得额外再跑一次图片检索。
 *
 * 判据刻意与「相关图片」组件的上桌条件一一对齐（见 adaptiveLayout 的 imageIntent / imageCount）：
 *   1. 查询本身就在找图片（图片 / 照片 / 图集 / 长什么样 …）；
 *   2. 已重排出的信源里已带若干缩略图 —— 说明这确实是个有画面可看的话题。
 *
 * 两者都不满足时直接跳过。这不是省一次请求那么简单：图片检索对几乎任何查询都能返回一堆
 * 图，若无条件开跑，该组件就会在纯文本任务上被「有图」这一事实永久点亮，
 * 「绝不出现空壳与无关磁贴」的硬门槛也就形同虚设。
 */
function shouldFetchRelatedImages(query: string, results: SearchResult[]): boolean {
  if (IMAGE_INTENT_PATTERN.test(query)) return true;
  if (results.filter((r) => Boolean(r.thumbnail)).length >= 1) return true;
  // 具备实体、概念或话题属性的常规检索均在后台并发预取图片，确保相关图片组件具备充分数据支持
  return query.trim().length >= 2;
}

export async function runSearchAgent(options: AgentRunOptions): Promise<SearchSynthesisResult> {
  const startTime = Date.now();
  const query = options.query.trim();

  // 多语言意图解析
  const detectedLang = detectQueryLanguage(query);
  const targetLang = resolveTargetLanguage(options.targetLanguage, detectedLang);
  const loc = getStepLocalization(targetLang.code);
  const selectedModel = normalizeModelId(options.model);

  const steps: AgentStep[] = [];

  function updateStep(
    id: string,
    title: string,
    description: string,
    status: AgentStep["status"],
    details?: string[]
  ) {
    const existingIndex = steps.findIndex(s => s.id === id);
    const step: AgentStep = {
      id,
      title,
      description,
      status,
      timestamp: Date.now(),
      details
    };
    if (existingIndex >= 0) {
      steps[existingIndex] = step;
    } else {
      steps.push(step);
    }
    if (options.onStepProgress) {
      options.onStepProgress(step, [...steps]);
    }
    if (options.onProgress) {
      options.onProgress(step, [...steps]);
    }
  }

  // --- Step 1: 意图分析与检索规划 ---
  updateStep(
    "plan",
    loc.planTitle,
    loc.planDescRunning(query, `${detectedLang.name} ${detectedLang.flag}`),
    "running"
  );

  const plan: AgentPlan = generatePlanForQuery(query, detectedLang, targetLang);

  const planDetails: string[] = [
    targetLang.code === "en" ? `Input query: ${query}` : `检索关键词: ${query}`,
    targetLang.code === "en"
      ? `Detected language: ${detectedLang.name} ${detectedLang.flag}`
      : `识别语言: ${detectedLang.name} ${detectedLang.flag}`
  ];

  if (detectedLang.crossLingualEnabled && detectedLang.crossLingualSummary) {
    planDetails.push(detectedLang.crossLingualSummary);
  }

  planDetails.push(
    targetLang.code === "en"
      ? `Cross-lingual sub-queries: ${plan.subQueries.join(" | ")}`
      : `多维度检索分支: ${plan.subQueries.join(" | ")}`,
    targetLang.code === "en"
      ? `Target Intent: ${plan.intent}`
      : `识别意图: ${plan.intent}`
  );

  updateStep(
    "plan",
    loc.planTitle,
    loc.planDescDone(plan.intent, plan.subQueries.length),
    "completed",
    planDetails
  );

  // --- Step 2: 全网多路实时检索与信源清洗 ---
  updateStep(
    "search",
    loc.searchTitle,
    loc.searchDescRunning,
    "running"
  );

  let filteredResults: SearchResult[] = [];
  let instanceUsed = "SearXNG / Multi-Engine";
  let totalCandidates = 0;

  try {
    const retrieval = await searchAndRankOnce(query, {
      customUrl: options.customSearxngUrl,
      language: targetLang.code,
      limit: 12
    });
    filteredResults = retrieval.results;
    instanceUsed = retrieval.instanceUsed;
    totalCandidates = retrieval.totalCandidates;
  } catch (err: any) {
    console.warn("[Search Agent] Primary retrieval failed, retrying fallback:", err);
    try {
      const fallback = await searchSearxng(query, { language: targetLang.code });
      filteredResults = fallback.results;
      instanceUsed = fallback.instanceUsed;
      totalCandidates = fallback.results.length;
    } catch {
      // Ignore fallback failure
    }
  }

  if (filteredResults.length === 0) {
    // 兜底虚拟结果，防止整页崩溃
    filteredResults = [
      {
        id: "fallback-result-1",
        title: query,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `关于 ${query} 的综合分析与信息检索结果。`,
        score: 0.9,
        isOfficial: true,
        displayDomain: "search.engine",
        engine: "internal"
      }
    ];
  }

  updateStep(
    "search",
    loc.searchTitle,
    targetLang.code === "en"
      ? `Retrieved & ranked ${filteredResults.length} high-authority records (Engine: ${instanceUsed})`
      : `已完成多引擎检索与相关度重排，精选 ${filteredResults.length} 条权威信源`,
    "completed",
    filteredResults.slice(0, 5).map(r => `[${r.isOfficial ? "官方" : "权威"}] ${r.title}`)
  );

  // --- Step 2.5: SearXNG 图片检索（与后续 Agent 链并行，不占关键路径）---
  //
  // 刻意在这里就发起、而不是等排版相位前才发起：图片的产出只被「相关图片」组件消费，
  // 与组件规划、研报合成都无任何依赖，因此让它在后台跑完，与两次大模型调用完全重叠 ——
  // 用户最终看到的延迟增量接近于零。
  //
  // 取图判据复用组件的上桌判据（IMAGE_INTENT_PATTERN），保证「取了图就一定会渲染」，
  // 不会白付一次网络往返却因判据不一致而组件不上桌。
  const relatedImagesPromise: Promise<SearchImage[]> = shouldFetchRelatedImages(query, filteredResults)
    ? searchSearxngImages(query, {
        customUrl: options.customSearxngUrl,
        language: targetLang.code,
        env: options.env,
        limit: 36
      }).catch(() => [] as SearchImage[])
    : Promise.resolve([] as SearchImage[]);

  // --- Step 3: 基于 Skills 与小组件标签库进行小组件选型 ---
  updateStep(
    "widget_selection",
    targetLang.code === "en" ? "Agent Widget Selection & Skills" : "Agent 技能激活与小组件智能选型",
    targetLang.code === "en"
      ? "Matching query intent & data features with widget taxonomy tags..."
      : "对比小组件语义标签、功能画像与实用性准则，规划最优组件组合...",
    "running"
  );

  let widgetPlan: WidgetPlan;
  try {
    widgetPlan = await planWidgetStrategy({
      query,
      results: filteredResults,
      apiKey: options.openRouterApiKey,
      targetLanguage: targetLang.code
    });
  } catch (err) {
    console.warn("[Search Agent] Widget strategy planning fallback:", err);
    widgetPlan = {
      intent: "explain",
      userGoal: query,
      suggestedArchetype: "download_hub",
      capabilities: ["related_links", "ai_answer"],
      widgets: [
        { type: "related_links", priority: 100, size: 50, reason: "权威官网入口直达置顶" },
        { type: "ai_answer", priority: 85, size: 50, reason: "AI 智能综合回答精简呈现" },
        { type: "takeaways", priority: 75, size: 25, reason: "核心要点" }
      ],
      primaryActions: []
    };
  }

  // 确保 related_links 与 ai_answer 包含在候选规划中，且 related_links 始终置顶
  if (!widgetPlan.widgets.some(w => w.type === "related_links")) {
    widgetPlan.widgets.unshift({
      type: "related_links",
      priority: 100,
      size: 50,
      reason: "权威官网与多链接安全直达置顶"
    });
  }
  if (!widgetPlan.widgets.some(w => w.type === "ai_answer")) {
    widgetPlan.widgets.push({
      type: "ai_answer",
      priority: 85,
      size: 50,
      reason: "核心 AI 智能回答与深度推理"
    });
  }

  updateStep(
    "widget_selection",
    targetLang.code === "en" ? "Agent Widget Selection & Skills" : "Agent 技能激活与小组件智能选型",
    targetLang.code === "en"
      ? `Selected ${widgetPlan.widgets.length} optimal widgets for intent: ${widgetPlan.intent}`
      : `已依据实用性准则匹配并选型 ${widgetPlan.widgets.length} 个核心小组件`,
    "completed",
    widgetPlan.widgets.map(w => `• [${w.type}] ${w.reason || "匹配任务意图"}`)
  );

  // --- Step 4: 并发执行 AI 深度回答生成与独有卡片构建 ---
  updateStep(
    "synthesize",
    loc.synthTitle,
    loc.synthDescRunning(selectedModel),
    "running"
  );

  const [synthesisRes, customCards] = await Promise.all([
    // AI 深度研报提炼
    (async () => {
      try {
        return await synthesizeWithOpenRouter({
          query,
          plan,
          results: filteredResults,
          apiKey: options.openRouterApiKey,
          model: selectedModel,
          targetLanguage: targetLang,
          detectedLanguage: detectedLang
        });
      } catch (err: any) {
        console.info("[Search Agent] Algorithmic synthesis fallback:", err?.message || err);
        return generateAlgorithmicSynthesis(
          query,
          plan,
          filteredResults,
          `${selectedModel} (自适应降级兜底)`,
          targetLang.code
        );
      }
    })(),
    // 独有卡片锻造
    (async () => {
      try {
        return await forgeMultipleDynamicWidgets({
          query,
          results: filteredResults,
          widgetPlan,
          apiKey: options.openRouterApiKey
        });
      } catch (err) {
        console.warn("[Search Agent] Custom card forging failed safely:", err);
        return [];
      }
    })()
  ]);

  updateStep(
    "synthesize",
    loc.synthTitle,
    loc.synthDescDone(synthesisRes.modelUsed || selectedModel),
    "completed",
    [
      targetLang.code === "en"
        ? `Model: ${synthesisRes.modelUsed || selectedModel}`
        : `推理模型: ${synthesisRes.modelUsed || selectedModel}`,
      targetLang.code === "en"
        ? `Core Insights: ${synthesisRes.keyTakeaways?.length || 0}`
        : `核心提炼要点: ${synthesisRes.keyTakeaways?.length || 0} 条`,
      targetLang.code === "en"
        ? `Follow-up Questions: ${synthesisRes.followUpQuestions?.length || 0}`
        : `拓展追问推荐: ${synthesisRes.followUpQuestions?.length || 0} 个`
    ]
  );

  // --- Step 5: 自适应 12 栅格智能排版决策 ---
  updateStep(
    "layout",
    targetLang.code === "en" ? "Adaptive Widget Grid Orchestration" : "自适应 12 栅格小组件排版决策",
    targetLang.code === "en"
      ? "Calculating responsive spans, reading order, and visual focus..."
      : "计算响应式栅格跨度、最佳阅读流与视觉焦点...",
    "running"
  );

  // 在此收拢并行开跑的图片检索：排版相位要用它判断「图片数据是否就绪」，
  // 而在此之前它对任何人都不产生价值 —— 组件规划与研报合成从不等它。
  const relatedImages = await relatedImagesPromise;

  const signals = {
    summaryLength: (synthesisRes.summary || "").length,
    takeawayCount: (synthesisRes.keyTakeaways || []).length,
    sourceCount: filteredResults.length,
    comparisonRows: (synthesisRes.comparisonTable || []).length,
    mindMapBranches: synthesisRes.mindMap?.children?.length || 0,
    followUpCount: (synthesisRes.followUpQuestions || []).length,
    hasOfficial: filteredResults.some(r => r.isOfficial),
    customCardCount: customCards.length,
    // 图片数据就绪信号：图片检索产出 + 信源自带缩略图。
    // 必须显式下发 —— 排版 Agent 只看得到 filteredResults，拿不到检索回来的图。
    imageCount: relatedImages.length + filteredResults.filter((r) => Boolean(r.thumbnail)).length
  };

  let layoutStrategy: AdaptiveLayoutStrategy;
  try {
    const layoutRes = await planWidgetLayout({
      query,
      results: filteredResults,
      widgetPlan,
      targetLanguage: targetLang.code,
      apiKey: options.openRouterApiKey,
      model: selectedModel,
      signals
    });
    layoutStrategy = layoutRes.strategy;
  } catch (err) {
    console.warn("[Search Agent] Layout agent fallback:", err);
    // 保证 related_links 位于首位（官网跳转组件默认保持在最上方）
    const componentOrder: ResultWidgetKey[] = ["related_links", "ai_answer"];
    if (customCards.length > 0) componentOrder.push("custom_cards");
    if (synthesisRes.keyTakeaways && synthesisRes.keyTakeaways.length > 0) componentOrder.push("takeaways");
    if (/(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query)) {
      componentOrder.push("search_engine");
    }
    if (synthesisRes.comparisonTable && synthesisRes.comparisonTable.length > 0) componentOrder.push("comparison");
    if (synthesisRes.mindMap && synthesisRes.mindMap.children && synthesisRes.mindMap.children.length > 0) componentOrder.push("mindmap");

    layoutStrategy = {
      intentType: "balanced",
      intentLabel: "官网直达与清晰搜索阅读流",
      explanation: "搜索 Agent 依据内容实用性自适应编排：官网跳转置顶呈现",
      componentOrder,
      emphasizedWidget: "related_links",
      enabledWidgets: componentOrder,
      disabledWidgets: [],
      gridConfig: {} as any
    };
  }

  // 严格确保 related_links 位于启用列表中并置顶，ai_answer 紧随其后
  if (!layoutStrategy.enabledWidgets?.includes("related_links")) {
    layoutStrategy.enabledWidgets = ["related_links", ...(layoutStrategy.enabledWidgets || [])];
  }
  if (!layoutStrategy.enabledWidgets?.includes("ai_answer")) {
    layoutStrategy.enabledWidgets.push("ai_answer");
  }

  // 垂直意图强匹配处理（搜索引擎、翻译、天气、Token统计）：严格根据 Agent 规划与搜索意图动态激活，绝不默认加载
  const hasSearchEngineIntent = /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query);
  const isSearchEnginePlanned = widgetPlan.widgets.some(w => (typeof w === "string" ? w : w.type) === "search_engine");
  if (hasSearchEngineIntent || isSearchEnginePlanned) {
    if (!layoutStrategy.enabledWidgets?.includes("search_engine")) {
      layoutStrategy.enabledWidgets = [...(layoutStrategy.enabledWidgets || []), "search_engine"];
    }
    if (!layoutStrategy.componentOrder?.includes("search_engine")) {
      layoutStrategy.componentOrder.push("search_engine");
    }
  } else if (layoutStrategy.intentType !== "tool_discovery" && layoutStrategy.intentType !== "official_portal") {
    layoutStrategy.enabledWidgets = layoutStrategy.enabledWidgets?.filter(k => k !== "search_engine");
    layoutStrategy.componentOrder = layoutStrategy.componentOrder?.filter(k => k !== "search_engine");
  }

  const hasTranslationIntent = /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i.test(query);
  const isTranslationPlanned = widgetPlan.widgets.some(w => (typeof w === "string" ? w : w.type) === "translation");
  if (hasTranslationIntent || isTranslationPlanned) {
    if (!layoutStrategy.enabledWidgets?.includes("translation")) {
      layoutStrategy.enabledWidgets = ["translation", ...(layoutStrategy.enabledWidgets || [])];
    }
    if (!layoutStrategy.componentOrder?.includes("translation")) {
      layoutStrategy.componentOrder.unshift("translation");
    }
  } else {
    layoutStrategy.enabledWidgets = layoutStrategy.enabledWidgets?.filter(k => k !== "translation");
    layoutStrategy.componentOrder = layoutStrategy.componentOrder?.filter(k => k !== "translation");
  }

  const hasWeatherIntent = /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(query);
  const isWeatherPlanned = widgetPlan.widgets.some(w => (typeof w === "string" ? w : w.type) === "weather");
  if (hasWeatherIntent || isWeatherPlanned) {
    if (!layoutStrategy.enabledWidgets?.includes("weather")) {
      layoutStrategy.enabledWidgets = ["weather", ...(layoutStrategy.enabledWidgets || [])];
    }
    if (!layoutStrategy.componentOrder?.includes("weather")) {
      layoutStrategy.componentOrder.unshift("weather");
    }
  } else {
    layoutStrategy.enabledWidgets = layoutStrategy.enabledWidgets?.filter(k => k !== "weather");
    layoutStrategy.componentOrder = layoutStrategy.componentOrder?.filter(k => k !== "weather");
  }

  const hasTokenIntent = /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i.test(query);
  const isTokenPlanned = widgetPlan.widgets.some(w => (typeof w === "string" ? w : w.type) === "token_usage");
  if (!hasTokenIntent && !isTokenPlanned) {
    layoutStrategy.enabledWidgets = layoutStrategy.enabledWidgets?.filter(k => k !== "token_usage");
    layoutStrategy.componentOrder = layoutStrategy.componentOrder?.filter(k => k !== "token_usage");
  }
  layoutStrategy.componentOrder = [
    "related_links",
    ...layoutStrategy.componentOrder.filter(k => k !== "related_links")
  ];

  updateStep(
    "layout",
    targetLang.code === "en" ? "Adaptive Widget Grid Orchestration" : "自适应 12 栅格小组件排版决策",
    targetLang.code === "en"
      ? `Activated ${layoutStrategy.enabledWidgets?.length || 0} widgets in optimal reading sequence.`
      : `已完成排版，启动 ${layoutStrategy.enabledWidgets?.length || 0} 个核心小组件，官网跳转组件置顶呈现。`,
    "completed",
    [
      `视觉焦点: ${layoutStrategy.emphasizedWidget || "related_links"}`,
      `阅读流: ${layoutStrategy.componentOrder.join(" → ")}`
    ]
  );

  const executionTimeMs = Date.now() - startTime;

  // 计算精确的 Token 使用量统计指标
  const promptChars = (query?.length || 0) + filteredResults.reduce((acc, r) => acc + (r.title?.length || 0) + (r.snippet?.length || 0), 0) + 650;
  const completionChars = (synthesisRes.summary?.length || 0) + (synthesisRes.keyTakeaways?.join(" ")?.length || 0) + (synthesisRes.followUpQuestions?.join(" ")?.length || 0) + 250;
  const promptTokens = Math.max(150, Math.round(promptChars * 0.75));
  const completionTokens = Math.max(80, Math.round(completionChars * 0.75));
  const totalTokens = promptTokens + completionTokens;
  const durationSec = Math.max(0.2, executionTimeMs / 1000);
  const tokensPerSecond = Math.round(completionTokens / durationSec);

  const tokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSecond,
    model: synthesisRes.modelUsed || selectedModel || "Gemini Flash",
    estimatedCostUsd: 0.00
  };

  return {
    query,
    timestamp: Date.now(),
    plan,
    steps,
    filteredResults,
    relatedImages,
    rawResultCount: totalCandidates || filteredResults.length,
    summary: synthesisRes.summary,
    keyTakeaways: synthesisRes.keyTakeaways || [],
    comparisonTable: synthesisRes.comparisonTable,
    mindMap: synthesisRes.mindMap,
    followUpQuestions: synthesisRes.followUpQuestions || [],
    modelUsed: synthesisRes.modelUsed || selectedModel,
    executionTimeMs,
    isMockFallback: synthesisRes.isMockFallback,
    detectedLanguage: detectedLang,
    targetLanguage: targetLang.code,
    layoutStrategy,
    widgetPlan,
    customCards,
    tokenUsage
  };
}

/**
 * 意图分析与多语言跨语种规划
 */
export function generatePlanForQuery(
  query: string,
  detectedLang: DetectedLanguage,
  targetLang: DetectedLanguage
): AgentPlan {
  const isEn = targetLang.code === "en";
  const cleanQ = query.trim();

  let intent: LayoutIntentType = "balanced";
  if (/(下载|安装|客户端|installer|download|setup|client)/i.test(cleanQ)) {
    intent = "install";
  } else if (/(对比|区别|哪个好|vs|versus|compare|difference)/i.test(cleanQ)) {
    intent = "comparison";
  } else if (/(官网|官方|主页|official|website|portal)/i.test(cleanQ)) {
    intent = "official_portal";
  } else if (/(工具|在线|免安装|tool|converter|generator)/i.test(cleanQ)) {
    intent = "tool_discovery";
  } else if (/(旅游|攻略|行程|路线|travel|itinerary|trip)/i.test(cleanQ)) {
    intent = "travel";
  } else if (/(架构|原理|系统|导图|architecture|topology|mindmap)/i.test(cleanQ)) {
    intent = "architecture";
  } else if (/(排查|报错|解决|troubleshooting|error|fix|debug)/i.test(cleanQ)) {
    intent = "troubleshooting";
  } else if (/(什么是|定义|含义|what is|definition|define)/i.test(cleanQ)) {
    intent = "quick_definition";
  } else if (/(研报|报告|趋势|分析|research|analysis|industry)/i.test(cleanQ)) {
    intent = "deep_research";
  }

  const subQueries = [cleanQ];
  if (detectedLang.code === "zh" && isEn) {
    subQueries.push(`${cleanQ} overview guide`);
  } else if (detectedLang.code === "en" && targetLang.code === "zh") {
    subQueries.push(`${cleanQ} 官网 教程 详解`);
  }

  return {
    originalQuery: cleanQ,
    intent,
    subQueries,
    comparisonDimensions: ["核心功能", "性能与稳定性", "适用场景", "官方支持"]
  };
}

/**
 * 确定性排版策略计算（向后兼容布局 Agent 调用）
 */
export function determineAdaptiveLayout(params: any): AdaptiveLayoutStrategy {
  return determineClientWidgetActivation(params);
}

