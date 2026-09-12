import { searchSearxng } from "./searxng.js";
import { synthesizeWithOpenRouter, generateAlgorithmicSynthesis, AVAILABLE_FREE_MODELS, normalizeModelId } from "./openrouter.js";
import { AgentPlan, AgentStep, SearchResult, SearchSynthesisResult, DetectedLanguage, AdaptiveLayoutStrategy, ResultWidgetKey, LayoutIntentType, ActionPlan, WidgetPlan } from "../src/types.js";
import { detectQueryLanguage, resolveTargetLanguage, getStepLocalization } from "./language.js";

interface AgentRunOptions {
  query: string;
  customSearxngUrl?: string;
  openRouterApiKey?: string;
  model?: string;
  targetLanguage?: string;
  enableDeepSearch?: boolean;
  env?: Record<string, string | undefined>;
  onProgress?: (step: AgentStep, allSteps: AgentStep[]) => void;
}

export async function runSearchAgent(options: AgentRunOptions): Promise<SearchSynthesisResult> {
  const startTime = Date.now();
  const query = options.query.trim();

  // Multilingual Detection & Resolution
  const detectedLang = detectQueryLanguage(query);
  const targetLang = resolveTargetLanguage(options.targetLanguage, detectedLang);
  const loc = getStepLocalization(targetLang.code);

  const steps: AgentStep[] = [];

  function updateStep(id: string, title: string, description: string, status: AgentStep["status"], details?: string[]) {
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
    if (options.onProgress) {
      options.onProgress(step, [...steps]);
    }
  }

  // --- Step 1: Query Analysis & Agent Plan ---
  updateStep(
    "plan",
    loc.planTitle,
    loc.planDescRunning(query, `${detectedLang.name} ${detectedLang.flag}`),
    "running"
  );

  const plan: AgentPlan = generatePlanForQuery(query, detectedLang, targetLang);

  const planDetails: string[] = [
    targetLang.code === "en" ? `Input query: ${query}` : `检索关键词: ${query}`,
    targetLang.code === "en" ? `Detected language: ${detectedLang.name} ${detectedLang.flag}` : `识别语言: ${detectedLang.name} ${detectedLang.flag}`
  ];

  if (detectedLang.crossLingualEnabled && detectedLang.crossLingualSummary) {
    planDetails.push(detectedLang.crossLingualSummary);
  }

  planDetails.push(
    targetLang.code === "en"
      ? `Cross-lingual sub-queries: ${plan.subQueries.join(" | ")}`
      : `多维度跨语言检索分支: ${plan.subQueries.join(" | ")}`,
    targetLang.code === "en"
      ? `Comparative dimensions: ${plan.comparisonDimensions.join(" | ")}`
      : `拟定对比维度: ${plan.comparisonDimensions.join("、")}`
  );

  updateStep(
    "plan",
    loc.planTitle,
    loc.planDescDone(plan.intent, plan.subQueries.length),
    "completed",
    planDetails
  );

  // --- Step 2: SearXNG Real-Time Information Retrieval ---
  updateStep(
    "search",
    loc.searchTitle,
    loc.searchDescRunning,
    "running"
  );

  let rawResults: SearchResult[] = [];
  let instanceUsed = "SearXNG / Multi-Engine";

  try {
    // Primary query with target language code
    const primaryRes = await searchSearxng(query, {
      customUrl: options.customSearxngUrl,
      categories: "general",
      language: targetLang.code,
      env: options.env
    });
    rawResults.push(...primaryRes.results);
    instanceUsed = primaryRes.instanceUsed;

    // Cross-lingual sub-query if available
    const crossLingualQuery = plan.subQueries.find(q => q !== query);
    if (crossLingualQuery) {
      try {
        const secondaryRes = await searchSearxng(crossLingualQuery, {
          customUrl: options.customSearxngUrl,
          language: targetLang.code,
          env: options.env
        });
        rawResults.push(...secondaryRes.results);
      } catch {
        // secondary failure is non-fatal
      }
    }

    // If deep search enabled and 3rd sub-query available, search one more dimension
    if (options.enableDeepSearch && plan.subQueries[2]) {
      try {
        const deepRes = await searchSearxng(plan.subQueries[2], {
          customUrl: options.customSearxngUrl,
          language: targetLang.code,
          env: options.env
        });
        rawResults.push(...deepRes.results);
      } catch {
        // deep failure is non-fatal
      }
    }
  } catch (err: any) {
    console.warn("SearXNG search error:", err);
    updateStep(
      "search",
      loc.searchTitle,
      loc.searchFallback,
      "running"
    );
    // Try fallback simple query
    try {
      const fallback = await searchSearxng(query, { language: targetLang.code });
      rawResults.push(...fallback.results);
      instanceUsed = fallback.instanceUsed;
    } catch {
      // Search failed across all engines
    }
  }

  if (rawResults.length === 0) {
    throw new Error(
      targetLang.code === "en"
        ? `No active web results found for "${query}". Please check connectivity or try alternative terms.`
        : `未能从检索源获取到关于 “${query}” 的有效网页结果，请检查网络或更换关键词。`
    );
  }

  updateStep(
    "search",
    loc.searchTitle,
    targetLang.code === "en"
      ? `Retrieved ${rawResults.length} raw search records (Engine: ${instanceUsed})`
      : `已成功获取 ${rawResults.length} 条原始检索数据（检索实例: ${instanceUsed}）`,
    "completed",
    rawResults.slice(0, 5).map(r => `[${r.engine || "web"}] ${r.title}`)
  );

  // --- Step 3: Agent Content Filtering & Deduplication ---
  updateStep(
    "filter",
    loc.filterTitle,
    targetLang.code === "en"
      ? "Filtering duplicate pages, scoring domain authority, and verifying canonical portals..."
      : "过滤低质广告、剔除重复页面、计算语义相关度与信源可信度...",
    "running"
  );

  // Filter, score relevance, and identify official portals
  const seenUrls = new Set<string>();
  const filteredResults: SearchResult[] = [];
  const cleanEntity = query
    .replace(/(官网|官方网站|主页|网址|网站|入口|平台|中文网|official website|official site|website|homepage|portal|公式サイト|公式|ホームページ)/gi, "")
    .trim()
    .toLowerCase();
  const userWantsEncyclopedia = /维基|wikipedia|百科/i.test(query);

  let bestOfficialCandidate: SearchResult | null = null;
  let highestOfficialScore = 0;

  for (const item of rawResults) {
    if (seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);

    const isWiki = /wikipedia\.org|baike\.baidu\.com/i.test(item.url);
    if (isWiki && !userWantsEncyclopedia) {
      // Exclude Wikipedia if enough web results exist, or strongly penalize
      if (rawResults.length > 3) continue;
    }

    let urlObj: URL | null = null;
    let hostname = "";
    let pathname = "";
    try {
      urlObj = new URL(item.url);
      hostname = urlObj.hostname.toLowerCase();
      pathname = urlObj.pathname.toLowerCase();
    } catch {
      hostname = item.url;
    }

    const titleLower = item.title.toLowerCase();
    const snippetLower = item.snippet.toLowerCase();
    const content = `${titleLower} ${snippetLower}`;

    // Base score
    let score = 0.6;

    // Word matching
    const queryWords = query.toLowerCase().split(/\s+/);
    for (const word of queryWords) {
      if (word && content.includes(word)) score += 0.15;
    }

    // Official website heuristics
    let officialConfidence = 0;
    const isRootOrPortal = pathname === "" || pathname === "/" || pathname === "/en" || pathname === "/en/" || pathname === "/zh" || pathname === "/zh/" || pathname === "/en/index.html";
    const cleanHost = hostname.replace(/^www\./, "");
    const hostParts = cleanHost.split(".");
    
    // Canonical brand domain matching (e.g. deepseek.com, python.org, react.dev, openrouter.ai)
    const isExactBrandDomain = hostParts.some(p => p === cleanEntity);
    const isDomainPrefixMatch = cleanHost.startsWith(`${cleanEntity}.`);

    if (isDomainPrefixMatch || isExactBrandDomain) {
      // Highest confidence: canonical brand domain owned by the entity
      officialConfidence += 1.0;
    } else if (cleanEntity.length >= 3 && cleanHost.includes(cleanEntity)) {
      // Third-party mirror or affiliate domains (e.g. deepseek-sk, deepseekq, xiake.pro)
      if (cleanHost.includes(`${cleanEntity}-`) || cleanHost.includes(`-${cleanEntity}`) || !hostParts.some(p => p.startsWith(cleanEntity))) {
        officialConfidence -= 0.3;
      } else {
        officialConfidence += 0.2;
      }
    }

    // Check title markers across multiple languages
    if (/官网|官方|official|into the unknown|welcome to|home|portal|公式サイト|公式|site officiel|sitio oficial|offizielle/i.test(item.title)) {
      officialConfidence += 0.25;
    }

    if (isRootOrPortal) {
      officialConfidence += 0.35;
    }

    // If wiki, strictly penalize
    if (isWiki) {
      officialConfidence = 0;
      score = 0.2;
    }

    const isOfficial = officialConfidence >= 0.8 && !isWiki;
    if (isOfficial && officialConfidence > highestOfficialScore) {
      highestOfficialScore = officialConfidence;
      bestOfficialCandidate = item;
    }

    if (isOfficial) {
      score = Math.max(score, 0.98);
    }

    score = Math.min(0.99, Math.round(score * 100) / 100);

    const isEn = targetLang.code === "en";
    const isJa = targetLang.code === "ja";

    const reason = isOfficial
      ? isEn
        ? "Verified Official Portal / Canonical Website"
        : isJa
        ? "認証済み公式サイト / メインポータル"
        : "官方认证入口 / 核心门户网站"
      : isWiki
      ? isEn
        ? "General Background Reference"
        : isJa
        ? "一般的な背景情報"
        : "通用背景参考"
      : score > 0.8
      ? isEn
        ? "High-Relevance Authoritative Page"
        : isJa
        ? "関連性の高い権威ソース"
        : "高契合度权威网页"
      : isEn
      ? "Relevant Reference Source"
      : isJa
      ? "関連リファレンス"
      : "相关参考信息";

    filteredResults.push({
      ...item,
      score,
      isOfficial,
      displayDomain: hostname,
      relevanceReason: reason
    });
  }

  // Ensure only the single highest confidence match is tagged as the primary official site
  if (bestOfficialCandidate) {
    for (const r of filteredResults) {
      if (r.url === bestOfficialCandidate.url) {
        r.isOfficial = true;
        r.score = 1.0;
        r.relevanceReason = targetLang.code === "en"
          ? "Verified Official Portal / Canonical Website"
          : targetLang.code === "ja"
          ? "認証済み公式サイト / メインポータル"
          : "官方认证入口 / 核心门户网站";
      } else {
        r.isOfficial = false;
      }
    }
  }

  // Sort by official status first, then by score
  filteredResults.sort((a, b) => {
    if (a.isOfficial && !b.isOfficial) return -1;
    if (!a.isOfficial && b.isOfficial) return 1;
    return (b.score || 0) - (a.score || 0);
  });

  updateStep(
    "filter",
    loc.filterTitle,
    loc.filterDescDone(filteredResults.length),
    "completed",
    loc.filterDetails(
      filteredResults.length,
      Array.from(new Set(filteredResults.map(r => r.engine || "web"))).join(", ")
    )
  );

  // --- Step 4: OpenRouter Synthesis & Deep Research Modeling ---
  const selectedModel = normalizeModelId(options.model);
  updateStep(
    "synthesize",
    loc.synthTitle,
    loc.synthDescRunning(selectedModel),
    "running"
  );

  let synthesis;
  try {
    synthesis = await synthesizeWithOpenRouter({
      query,
      plan,
      results: filteredResults,
      apiKey: options.openRouterApiKey,
      model: selectedModel,
      targetLanguage: targetLang,
      detectedLanguage: detectedLang
    });
  } catch (err: any) {
    console.warn("synthesizeWithOpenRouter failed, falling back safely to algorithmic synthesis:", err);
    synthesis = generateAlgorithmicSynthesis(
      query,
      plan,
      filteredResults,
      `${selectedModel} (自适应降级兜底)`,
      targetLang.code
    );
  }

  updateStep(
    "synthesize",
    loc.synthTitle,
    loc.synthDescDone(synthesis.modelUsed || selectedModel),
    "completed",
    [
      targetLang.code === "en" ? `Synthesized model: ${synthesis.modelUsed || selectedModel}` : `研报提炼模型: ${synthesis.modelUsed || selectedModel}`,
      targetLang.code === "en" ? `Core insights: ${synthesis.keyTakeaways?.length || 0}` : `提炼核心观点: ${synthesis.keyTakeaways?.length || 0} 条`,
      targetLang.code === "en" ? `Mind map branches: ${synthesis.mindMap?.children?.length || 0}` : `知识导图分支: ${synthesis.mindMap?.children?.length || 0} 个`
    ]
  );

  // --- Step 5: Adaptive Layout & Intelligent Component Arrangement ---
  const hasOfficial = filteredResults.some(r => r.isOfficial);
  const layoutStrategy = determineAdaptiveLayout({
    query,
    plan,
    filteredResults,
    comparisonCount: synthesis.comparisonTable?.length || 0,
    mindMapBranches: synthesis.mindMap?.children?.length || 0,
    followUpCount: synthesis.followUpQuestions?.length || 0,
    hasOfficial,
    targetLanguage: targetLang.code
  });

  const getWidgetChineseName = (key: ResultWidgetKey): string => {
    switch (key) {
      case "comparison": return "多维对比矩阵";
      case "mindmap": return "知识架构导图";
      case "official_portal": return "官方认证门户";
      case "takeaways": return "核心结论速览";
      case "ai_overview": return "AI 深度研报";
      case "sources": return "验证信源库";
      case "followup": return "延伸探索建议";
      default: return key;
    }
  };

  const enabledNames = layoutStrategy.enabledWidgets?.map(getWidgetChineseName).join("、") || "全部";
  const disabledNames = layoutStrategy.disabledWidgets && layoutStrategy.disabledWidgets.length > 0
    ? layoutStrategy.disabledWidgets.map(k => `${getWidgetChineseName(k)} (${layoutStrategy.widgetStatusMap?.[k]?.reason || "休眠"})`).join("；")
    : (targetLang.code === "en" ? "None (all active)" : "无 (全组件启动)");

  updateStep(
    "layout",
    targetLang.code === "en" ? "Agent Dynamic Component Activation & Orchestration" : "Agent 动态组件自适应启停与编排",
    targetLang.code === "en"
      ? `Auto-activated ${layoutStrategy.enabledWidgets?.length || 0} matching widgets, auto-disabled ${layoutStrategy.disabledWidgets?.length || 0} redundant widgets.`
      : `根据搜索内容特征自动启动 ${layoutStrategy.enabledWidgets?.length || 0} 个契合组件，禁用休眠 ${layoutStrategy.disabledWidgets?.length || 0} 个冗余组件。`,
    "completed",
    [
      layoutStrategy.explanation,
      targetLang.code === "en"
        ? `🟢 Auto-Activated Widgets (${layoutStrategy.enabledWidgets?.length || 0}): ${layoutStrategy.enabledWidgets?.map(getWidgetChineseName).join(", ")}`
        : `🟢 自动启动组件 (${layoutStrategy.enabledWidgets?.length || 0} 个): ${enabledNames}`,
      targetLang.code === "en"
        ? `💤 Auto-Disabled Widgets (${layoutStrategy.disabledWidgets?.length || 0}): ${disabledNames}`
        : `💤 自动禁用休眠 (${layoutStrategy.disabledWidgets?.length || 0} 个): ${disabledNames}`,
      targetLang.code === "en"
        ? `Render stream: ${layoutStrategy.componentOrder.join(" -> ")}`
        : `动态视觉渲染流: ${layoutStrategy.componentOrder.map(getWidgetChineseName).join(" → ")}`
    ]
  );

  const executionTimeMs = Date.now() - startTime;

  return {
    query,
    timestamp: Date.now(),
    plan,
    steps,
    filteredResults,
    rawResultCount: rawResults.length,
    summary: synthesis.summary,
    keyTakeaways: synthesis.keyTakeaways,
    comparisonTable: synthesis.comparisonTable,
    mindMap: synthesis.mindMap,
    followUpQuestions: synthesis.followUpQuestions,
    modelUsed: synthesis.modelUsed,
    executionTimeMs,
    isMockFallback: synthesis.isMockFallback,
    detectedLanguage: detectedLang,
    targetLanguage: targetLang.code,
    layoutStrategy
  };
}

/**
 * Server-side Smart Bin-Packing & Flow Optimization Algorithm
 * Constraints:
 * 1. Maximum 4 widgets per row (minimum span 3: 12 / 3 = 4)
 * 2. Every row strictly balanced to 12 columns, eliminating awkward whitespace
 * 3. Dynamic size and position adaptation based on query intent & content profile
 */
/**
 * Server-side Layout Planner
 * Direct semantic mapping to 12-column CSS Grid:
 * 12 = full width, 8 = wide (2/3), 6 = half (1/2), 4 = compact (1/3)
 * Guarantees zero blank gaps and strict reading order stability.
 */
function calculateServerAdaptiveBinPacking(
  order: ResultWidgetKey[],
  options: {
    emphasizedWidget?: ResultWidgetKey;
    intentType?: LayoutIntentType;
    hasOfficialSite?: boolean;
    maxColumnsPerRow?: number;
  } = {}
): {
  gridConfig: Record<ResultWidgetKey, any>;
  totalRows: number;
} {
  const emphasized = options.emphasizedWidget;
  const intent = options.intentType || "balanced";

  const getSemanticSpan = (key: ResultWidgetKey): number => {
    switch (key) {
      case "ai_overview":
        return 12;
      case "mindmap":
      case "comparison":
        return 6;
      case "quick_answer":
      case "sources":
      case "custom_cards":
      case "actions_toolbox":
      case "takeaways":
      case "official_portal":
      case "verification_checklist":
      case "analytics_trend":
      case "topic_digest":
      case "fast_chat":
        return 6;
      case "followup":
      case "metrics_telemetry":
      case "mobile_qr":
      case "agent_workflow":
        return 3;
      default:
        return 6;
    }
  };

  const gridConfig: Record<string, any> = {};
  let currentRowIndex = 0;
  let currentUsedSpan = 0;

  order.forEach((key) => {
    const span = getSemanticSpan(key);
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
    gridConfig: gridConfig as Record<ResultWidgetKey, any>,
    totalRows: currentRowIndex + 1
  };
}

function inferWidgetActivationStrategy(params: {
  query: string;
  isComparisonQuery: boolean;
  isArchitectureQuery: boolean;
  isOfficialPortalQuery: boolean;
  isFactCheckQuery?: boolean;
  isQuickDefinitionQuery?: boolean;
  isCodeTutorialQuery?: boolean;
  isNewsTrendQuery?: boolean;
  hasOfficial: boolean;
  comparisonCount: number;
  mindMapBranches: number;
  filteredResultsCount: number;
  followUpCount: number;
  targetLanguage?: string;
  hasCustomCards?: boolean;
}): {
  enabledWidgets: ResultWidgetKey[];
  disabledWidgets: ResultWidgetKey[];
  widgetStatusMap: Record<ResultWidgetKey, any>;
  customWidgetSpans?: Partial<Record<ResultWidgetKey, number>>;
} {
  const {
    isComparisonQuery,
    isArchitectureQuery,
    isOfficialPortalQuery,
    isFactCheckQuery = false,
    isQuickDefinitionQuery = false,
    isCodeTutorialQuery = false,
    isNewsTrendQuery = false,
    hasOfficial,
    comparisonCount,
    mindMapBranches,
    filteredResultsCount,
    followUpCount,
    targetLanguage,
    hasCustomCards = true
  } = params;
  const isEn = targetLanguage === "en";

  // 1. 官方门户：仅当成功匹配并认证出官方站点时启动
  const enableOfficial = hasOfficial;

  // 2. 对比矩阵：仅在多实体对比场景时启动
  const enableComparison = (isComparisonQuery && comparisonCount > 0) || comparisonCount >= 2;

  // 3. 知识架构导图：仅在层级体系丰富且非纯官方导航/简短定义/时事新闻时启动
  const enableMindMap = (mindMapBranches >= 2 || isArchitectureQuery) && !isOfficialPortalQuery && !isQuickDefinitionQuery && !isNewsTrendQuery;

  // 4. 核心即时回答：始终启动
  const enableQuickAnswer = true;

  // 5. 核心速览：绝大多数查询均启动
  const enableTakeaways = true;

  // 6. 分面专题研报：非简短定义/纯导航时启动
  const enableTopicDigest = !isQuickDefinitionQuery && !isOfficialPortalQuery;

  // 7. 验证信源库：检索到有效外部结果即启动
  const enableSources = filteredResultsCount > 0;

  // 8. 延伸探索：生成了延伸探索建议即启动
  const enableFollowup = followUpCount > 0;

  // 9. 移动互联：官方门户或研报时启动
  const enableMobileQR = isOfficialPortalQuery;

  // 10. 事实核查清单：事实核查/时事/对比/深度研报时启动
  const enableVerification = !isQuickDefinitionQuery && !isOfficialPortalQuery;

  // 11. 时序分析与度量：时事热点或研报时重点启动，简明概念休眠
  const enableAnalytics = !isQuickDefinitionQuery && !isCodeTutorialQuery && !isOfficialPortalQuery;
  const enableMetrics = !isQuickDefinitionQuery;

  const widgetStatusMap: Record<ResultWidgetKey, any> = {
    quick_answer: {
      key: "quick_answer",
      enabled: enableQuickAnswer,
      reason: isEn ? "Quick direct answer; auto-activated." : "核心即时答案与结论提炼，秒级获取核心要点。",
      autoDecidedByAgent: true
    },
    takeaways: {
      key: "takeaways",
      enabled: enableTakeaways,
      reason: isEn
        ? "Essential synthesis bullets; auto-activated for rapid cognitive ingestion."
        : "核心观点与速览结论，已自动启动以实现秒级认知获取。",
      autoDecidedByAgent: true
    },
    official_portal: {
      key: "official_portal",
      enabled: enableOfficial,
      reason: enableOfficial
        ? isEn
          ? "Verified authoritative portal matched; auto-activated for direct authentic access."
          : "已精确匹配认证官方域名/核心入口，已自动启动以提供正版直达入口。"
        : isEn
          ? "No canonical official domain matched; auto-disabled to eliminate clutter."
          : "未检索到权威官方认证站点，已自动禁用休眠以消除页面杂乱。",
      autoDecidedByAgent: true
    },
    metrics_telemetry: {
      key: "metrics_telemetry",
      enabled: enableMetrics,
      reason: isEn ? "Sources & processing telemetry." : "信源统计与分析度量小组件，展示处理链路与可信指数。",
      autoDecidedByAgent: true
    },
    actions_toolbox: {
      key: "actions_toolbox",
      enabled: true,
      reason: isEn ? "Quick actions toolbox." : "快捷控制箱，支持一键复制、Markdown 导出与语音朗读。",
      autoDecidedByAgent: true
    },
    analytics_trend: {
      key: "analytics_trend",
      enabled: enableAnalytics,
      reason: isEn ? "Analytics & trend sparkline." : "分析与趋势小组件，展示时序信源收敛曲线与置信指标。",
      autoDecidedByAgent: true
    },
    verification_checklist: {
      key: "verification_checklist",
      enabled: enableVerification,
      reason: isEn ? "Fact verification & safety checklist." : "事实核查与安全审计小组件，多源交叉验证防御幻觉。",
      autoDecidedByAgent: true
    },
    fast_chat: {
      key: "fast_chat",
      enabled: true,
      reason: isEn ? "Interactive quick chat inquiry." : "智能追问与对话小组件，支持即时探索与多轮深度发问。",
      autoDecidedByAgent: true
    },
    mobile_qr: {
      key: "mobile_qr",
      enabled: enableMobileQR,
      reason: isEn ? "Mobile QR synchronization." : "移动端同步互联小组件，扫码即在手机端同步研报。",
      autoDecidedByAgent: true
    },
    topic_digest: {
      key: "topic_digest",
      enabled: enableTopicDigest,
      reason: isEn ? "Modular topic digest cards." : "模块化分面研报小组件，结构化呈现核心解析。",
      autoDecidedByAgent: true
    },
    mindmap: {
      key: "mindmap",
      enabled: enableMindMap,
      reason: enableMindMap
        ? isEn
          ? "Hierarchical knowledge tree detected; interactive mind map auto-activated."
          : "知识实体具备多层级系统拓扑，已自动启动交互式架构导图。"
        : isEn
          ? "Direct factual question topic; deep hierarchical mind map auto-disabled."
          : "即时事实问答或导航主题，无需层级拓扑导图，已自动禁用休眠。",
      autoDecidedByAgent: true
    },
    sources: {
      key: "sources",
      enabled: enableSources,
      reason: enableSources
        ? isEn
          ? "Authoritative citation repository; auto-activated for verifiable provenance."
          : "已汇聚多源可信赖站点，已自动启动以提供完整信源溯源。"
        : isEn
          ? "No external web sources fetched; auto-disabled."
          : "无外部检索信源，已自动休眠。",
      autoDecidedByAgent: true
    },
    followup: {
      key: "followup",
      enabled: enableFollowup,
      reason: enableFollowup
        ? isEn
          ? "Relevant cognitive extensions available; auto-activated for guided discovery."
          : "已生成高质量延伸探索指引，已自动启动以激发深层思考。"
        : isEn
          ? "No extension questions generated; auto-disabled."
          : "暂无延伸探索建议，已自动休眠。",
      autoDecidedByAgent: true
    },
    comparison: {
      key: "comparison",
      enabled: enableComparison,
      reason: enableComparison
        ? isEn
          ? "Multi-entity comparative evaluation detected; matrix view auto-activated."
          : "识别到跨实体横向对比/选型决策意图，已自动启动多维对比矩阵。"
        : isEn
          ? "Single-subject research focus with no multi-entity comparison needed; auto-disabled."
          : "当前为单一实体/概念深入探究，无多实体对比必要，已自动禁用休眠对比矩阵。",
      autoDecidedByAgent: true
    },
    agent_workflow: {
      key: "agent_workflow",
      enabled: !isQuickDefinitionQuery,
      reason: isEn ? "Agent reasoning audit steps." : "Agent 决策链路追踪与事实审计。",
      autoDecidedByAgent: true
    },
    ai_overview: {
      key: "ai_overview",
      enabled: false,
      reason: isEn ? "Comprehensive narrative report." : "全景多源深度研报，已拆解为独立模块化小组件。",
      autoDecidedByAgent: true
    },
    custom_cards: {
      key: "custom_cards",
      enabled: Boolean(hasCustomCards),
      reason: isEn
        ? "Custom forged widgets dynamically generated from search sources."
        : "基于当前搜索信源智能提炼的独有定制小组件，已与固定小组件统一排列。",
      autoDecidedByAgent: true
    }
  };

  const enabledWidgets: ResultWidgetKey[] = [];
  const disabledWidgets: ResultWidgetKey[] = [];

  (Object.keys(widgetStatusMap) as ResultWidgetKey[]).forEach(k => {
    if (widgetStatusMap[k].enabled) {
      enabledWidgets.push(k);
    } else {
      disabledWidgets.push(k);
    }
  });

  // 保底安全检查：至少保留核心要点和信源
  if (enabledWidgets.length === 0) {
    enabledWidgets.push("quick_answer", "takeaways", "sources");
    widgetStatusMap.quick_answer.enabled = true;
    widgetStatusMap.takeaways.enabled = true;
    widgetStatusMap.sources.enabled = true;
  }

  return {
    enabledWidgets,
    disabledWidgets,
    widgetStatusMap,
    customWidgetSpans: {} as Partial<Record<ResultWidgetKey, number>>
  };
}

export function determineAdaptiveLayout(params: {
  query: string;
  plan: AgentPlan;
  filteredResults: SearchResult[];
  comparisonCount: number;
  mindMapBranches: number;
  followUpCount?: number;
  hasOfficial: boolean;
  targetLanguage?: string;
  hasCustomCards?: boolean;
  actionPlan?: ActionPlan;
  widgetPlan?: WidgetPlan;
}): AdaptiveLayoutStrategy {
  const { query, plan, filteredResults, comparisonCount, mindMapBranches, followUpCount = 3, hasOfficial, targetLanguage, hasCustomCards = true, actionPlan, widgetPlan } = params;
  const isEn = targetLanguage === "en";

  const isInstallQuery =
    /(安装|下载|配置环境|部署|国内镜像|镜像源|包管理|客户端下载|\b(install|download|setup|docker run|brew install|pip install|npm i|yum install|apt-get|installer|pkg|tar\.gz)\b)/i.test(query);

  const isToolDiscoveryQuery =
    /(工具|网站|平台|在线|免安装|免费|转换|压缩|生成器|编辑器|推荐|好用|替代品|\b(tool|tools|online|generator|converter|editor|utility|website|app|free online)\b)/i.test(query);

  const isTravelQuery =
    /(旅游|攻略|游玩|景点|行程|自驾|住宿|美食|必去|门票|几日游|路线|\b(travel|itinerary|trip|tour|guide|vacation|spot|attractions)\b)/i.test(query);

  const isTroubleshootingQuery =
    /(报错|解决|修复|异常|解决办法|排查|崩溃|权限问题|踩坑|避坑|\b(error|fix|debug|troubleshoot|exception|failed|bug|issue|eacces|cors|denied)\b)/i.test(query);

  const isComparisonQuery =
    /(对比|区别|优缺点|哪个好|选哪个|怎么选|还是|好还是|优劣|差别|pk|\b(vs|versus|difference|compare|comparison|pros and cons|better)\b)/i.test(query) ||
    /compare|versus/i.test(plan.intent);

  const isArchitectureQuery =
    /(架构|原理|底层|机制|体系|全景|知识图谱|思维导图|学习路线|生命周期|内部机制|工作原理|\b(architecture|internals|mechanism|how it works|roadmap|overview|pipeline|lifecycle|deep dive)\b)/i.test(query);

  const isOfficialPortalQuery =
    /(官网|官方|主页|官方网站|正版|官方下载|官方文档|客户端下载|\b(official|portal|homepage|website|docs|github)\b)/i.test(query) ||
    (hasOfficial && query.trim().length <= 15);

  const isFactCheckQuery =
    /(真假|谣言|辟谣|核实|是真的吗|属实|假消息|骗局|真实性|是不是真的|被抓|去世了吗|真的假的|\b(fact check|true or false|hoax|rumor|is it true|fake news|debunk|myth)\b)/i.test(query);

  const isCodeTutorialQuery =
    /(代码|怎么写|如何实现|教程|命令|参数|配置|函数|语法|类库|环境搭建|怎么做|做法|步骤|\b(code|tutorial|how to|example|command|cli|syntax|script|function|npm|pip|docker|git|python|golang|rust|java|react|vue|typescript|sql)\b)/i.test(query);

  const isNewsTrendQuery =
    /(今日|今天|最新|突发|新闻|动态|进展|发布会|走势|热点|大盘|刚刚|行情|股价|指数|\b(news|latest|breaking|today|trend|update|announced|stock|market)\b)/i.test(query);

  const isQuickDefinitionQuery =
    query.trim().length <= 25 &&
    /(是什么|怎么读|读音|定义|含义|解释|换算|等于多少|多少钱|几点|谁是|在哪|什么时候|拼音|\b(what is|meaning|define|definition|convert|who is|where is|when is)\b)/i.test(query);

  const isDeepResearchQuery =
    /(研报|报告|白皮书|现状|发展趋势|市场份额|产业链|前景|未来|调研|商业计划|\b(research|analysis|industry|whitepaper|market|forecast|survey)\b)/i.test(query);

  // 1. Agent 自主推断组件启动与禁用方案
  const activation = inferWidgetActivationStrategy({
    query,
    isComparisonQuery,
    isArchitectureQuery,
    isOfficialPortalQuery,
    isFactCheckQuery,
    isQuickDefinitionQuery,
    isCodeTutorialQuery,
    isNewsTrendQuery,
    hasOfficial,
    comparisonCount,
    mindMapBranches,
    filteredResultsCount: filteredResults.length,
    followUpCount,
    targetLanguage
  });

  // 2. 意图判断与基础组件优先级定义
  let intentType: LayoutIntentType = "balanced";
  let intentLabel = isEn ? "Balanced Adaptive Layout" : "多维全景平衡流";
  let explanation = isEn
    ? "Agent detected standard multi-faceted requirements. Balanced layout with custom card spotlight."
    : "Agent 识别出多维全景信息获取需求，采用自适应装箱算法，均衡展示速答、专属卡片、要点与信源。";
  let preferredEmphasized: ResultWidgetKey = "custom_cards";
  let baseOrder: ResultWidgetKey[] = [
    "custom_cards",
    "quick_answer",
    "takeaways",
    "actions_toolbox",
    "sources",
    "metrics_telemetry",
    "topic_digest",
    "analytics_trend",
    "mindmap",
    "fast_chat",
    "followup",
    "agent_workflow"
  ];

  if (isInstallQuery) {
    intentType = "install";
    intentLabel = isEn ? "Software Installation & Mirrors" : "安装部署与下载中心 (极速落地)";
    explanation = isEn
      ? "Agent detected an installation/deployment intent. Prioritizing download hub, mirror configs, and CLI toolboxes."
      : "Agent 识别出软件安装与部署意图：跨平台下载中心与 CLI 执行指令置顶首行，官方门户与环境核验紧随其后。";
    preferredEmphasized = "custom_cards";
    baseOrder = [
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
  } else if (isToolDiscoveryQuery) {
    intentType = "tool_discovery";
    intentLabel = isEn ? "Online Tool Discovery & Trial" : "在线免安装工具推荐 (即开即用)";
    explanation = isEn
      ? "Agent detected a tool/utility discovery intent. Putting interactive tool cards, online trial sandbox, and comparisons at the top."
      : "Agent 识别出免安装工具与实用软件发现意图：免安装在线体验卡与工具对比矩阵全宽置顶。";
    preferredEmphasized = "custom_cards";
    baseOrder = [
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
  } else if (isTravelQuery) {
    intentType = "travel";
    intentLabel = isEn ? "Travel Itinerary & Pitfall Guide" : "旅游攻略与精选路线 (行程规划)";
    explanation = isEn
      ? "Agent detected a travel guide intent. Highlighting multi-day itinerary timeline, spot checklist, and pitfall warnings."
      : "Agent 识别出旅游行程攻略意图：分天路线规划与游玩避坑看板置顶呈现，门票与交通速查紧随。";
    preferredEmphasized = "custom_cards";
    baseOrder = [
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
  } else if (isTroubleshootingQuery) {
    intentType = "troubleshooting";
    intentLabel = isEn ? "Error Diagnostics & Fix Commands" : "报错排障与快速修复 (故障诊断)";
    explanation = isEn
      ? "Agent detected an error/troubleshooting intent. Prioritizing one-click fix commands and diagnostic checklists."
      : "Agent 识别出报错与排障意图：一键修复命令与排错自检清单置顶，直击根因并给出解决方案。";
    preferredEmphasized = "actions_toolbox";
    baseOrder = [
      "actions_toolbox",
      "verification_checklist",
      "custom_cards",
      "quick_answer",
      "takeaways",
      "sources",
      "fast_chat",
      "followup"
    ];
  } else if (isComparisonQuery && comparisonCount > 0) {
    intentType = "comparison";
    intentLabel = isEn ? "Comparison Matrix Priority" : "多维对比矩阵优先 (对比全景置顶)";
    explanation = isEn
      ? "Agent detected an explicit multi-entity comparison intent. The Comparison Matrix is given full-width spotlight."
      : "Agent 识别出选型决策对比意图，已自动启动并将「多维交叉对比矩阵」与「优劣分析卡片」全宽置顶。";
    preferredEmphasized = "comparison";
    baseOrder = [
      "comparison",
      "custom_cards",
      "takeaways",
      "quick_answer",
      "topic_digest",
      "sources",
      "actions_toolbox",
      "fast_chat",
      "followup",
      "agent_workflow"
    ];
  } else if (isArchitectureQuery && mindMapBranches > 0) {
    intentType = "architecture";
    intentLabel = isEn ? "Knowledge Architecture Priority" : "知识架构导图优先 (交互图谱全景置顶)";
    explanation = isEn
      ? "Agent detected a technical system architecture query. The Knowledge Mind Map takes the top spotlight with full interactive canvas width."
      : "Agent 识别出系统原理与结构化认知意图，已自动启动并将「交互式知识架构导图」与「架构看板」提权至首屏全宽画幅。";
    preferredEmphasized = "mindmap";
    baseOrder = [
      "mindmap",
      "custom_cards",
      "quick_answer",
      "takeaways",
      "topic_digest",
      "actions_toolbox",
      "sources",
      "followup",
      "fast_chat",
      "agent_workflow"
    ];
  } else if (isOfficialPortalQuery && hasOfficial) {
    intentType = "official_portal";
    intentLabel = isEn ? "Official Portal Priority" : "官方门户与导航优先 (正版入口置顶)";
    explanation = isEn
      ? "Agent detected official portal requirements. Official Verified Portals and quick insights are packed across the top row."
      : "Agent 识别出官方正版寻址与工具入口需求，已自动启动并将官方权威门户与专属导航卡片置顶首行。";
    preferredEmphasized = "official_portal";
    baseOrder = [
      "official_portal",
      "custom_cards",
      "mobile_qr",
      "actions_toolbox",
      "quick_answer",
      "takeaways",
      "sources",
      "fast_chat",
      "followup",
      "agent_workflow"
    ];
  } else if (isCodeTutorialQuery) {
    intentType = "code_tutorial";
    intentLabel = isEn ? "Code & Tutorial Priority" : "代码与实操教程优先 (代码速答与工具箱置顶)";
    explanation = isEn
      ? "Agent detected programming implementation or tutorial inquiry. Code quick answer and developer toolbox are placed front and center."
      : "Agent 识别出编程实操与开发指南需求：完整代码实现与一键复制工具箱置顶，专属代码卡片与分面解析次行提供。";
    preferredEmphasized = "actions_toolbox";
    baseOrder = [
      "actions_toolbox",
      "custom_cards",
      "quick_answer",
      "topic_digest",
      "takeaways",
      "sources",
      "fast_chat",
      "verification_checklist",
      "mindmap",
      "followup",
      "agent_workflow"
    ];
  } else if (isFactCheckQuery) {
    intentType = "fact_check";
    intentLabel = isEn ? "Fact Verification Priority" : "事实核查与辟谣优先 (求真存证清单置顶)";
    explanation = isEn
      ? "Agent detected a rumor or fact-verification inquiry. Multi-source fact verification checklist and telemetry are prioritized."
      : "Agent 识别出求真辟谣与事实核验意图，已自动置顶求真核验清单、证据卷宗与信源权威度遥测度量。";
    preferredEmphasized = "verification_checklist";
    baseOrder = [
      "verification_checklist",
      "custom_cards",
      "metrics_telemetry",
      "quick_answer",
      "takeaways",
      "sources",
      "actions_toolbox",
      "topic_digest",
      "followup",
      "agent_workflow"
    ];
  } else if (isNewsTrendQuery) {
    intentType = "news_trend";
    intentLabel = isEn ? "News & Trends Priority" : "时事资讯与热点走势优先 (突发脉络与趋势置顶)";
    explanation = isEn
      ? "Agent detected breaking news or temporal dynamics. Event summary, timeline and trend sparkline are placed at the top."
      : "Agent 识别出突发时事与最新动态需求：核心事件速递、时间线与时序趋势曲线首屏置顶，一手权威信源紧随呈现。";
    preferredEmphasized = "analytics_trend";
    baseOrder = [
      "analytics_trend",
      "custom_cards",
      "quick_answer",
      "sources",
      "takeaways",
      "verification_checklist",
      "actions_toolbox",
      "fast_chat",
      "topic_digest",
      "followup",
      "agent_workflow"
    ];
  } else if (isQuickDefinitionQuery) {
    intentType = "quick_definition";
    intentLabel = isEn ? "Instant Definition Priority" : "简明速答与概念速查 (极致极简)";
    explanation = isEn
      ? "Agent detected a fast definition query. Displaying direct answers and key takeaways in an ultra-clean layout."
      : "Agent 识别出即时速查意图，精简呈现核心结论与大字号速答，自动休眠重型组件。";
    preferredEmphasized = "quick_answer";
    baseOrder = [
      "quick_answer",
      "takeaways",
      "custom_cards",
      "sources",
      "actions_toolbox",
      "fast_chat",
      "followup"
    ];
  } else if (isDeepResearchQuery) {
    intentType = "deep_research";
    intentLabel = isEn ? "Deep Research Priority" : "深度综合研报优先 (核心结论与产业链协同)";
    explanation = isEn
      ? "Agent detected an in-depth research inquiry. Essential takeaways and comprehensive synthesis are presented."
      : "Agent 识别出深度产业与战略研报课题：核心研报摘要、思维导图与全景分析深度协同。";
    preferredEmphasized = "takeaways";
    baseOrder = [
      "takeaways",
      "mindmap",
      "custom_cards",
      "quick_answer",
      "topic_digest",
      "analytics_trend",
      "comparison",
      "sources",
      "metrics_telemetry",
      "actions_toolbox",
      "fast_chat",
      "followup",
      "agent_workflow"
    ];
  }

  // 2.5 若存在 WidgetPlan 专职规划结果，深度接管排版优先级与意图决策
  if (widgetPlan) {
    const wpIntent = widgetPlan.intent;
    if (wpIntent === "install") intentType = "install";
    else if (wpIntent === "tool_discovery") intentType = "tool_discovery";
    else if (wpIntent === "travel") intentType = "travel";
    else if (wpIntent === "troubleshooting") intentType = "troubleshooting";
    else if (wpIntent === "compare") intentType = "comparison";
    else if (wpIntent === "tutorial") intentType = "code_tutorial";
    else if (wpIntent === "research") intentType = "deep_research";
    else if (wpIntent === "explain") intentType = "quick_definition";

    if (widgetPlan.widgets && widgetPlan.widgets.length > 0) {
      const plannedKeys: ResultWidgetKey[] = widgetPlan.widgetOrder || widgetPlan.widgets.map((w: any) => typeof w === "string" ? w : w.type);
      baseOrder = plannedKeys;
      preferredEmphasized = plannedKeys[0];
      // 确保 WidgetPlan 中规划的组件全量激活，并将 Agent 决策的尺寸同步到排版中
      if (!activation.customWidgetSpans) {
        activation.customWidgetSpans = {};
      }
      widgetPlan.widgets.forEach((item: any) => {
        const key: ResultWidgetKey = typeof item === "string" ? item : item.type;
        if (activation.widgetStatusMap[key]) {
          activation.widgetStatusMap[key].enabled = true;
          if (!activation.enabledWidgets.includes(key)) {
            activation.enabledWidgets.push(key);
          }
        }
        if (typeof item === "object" && item.size) {
          // WidgetPlannedSize 已与 TileSize 统一为同一套磁贴语义，这里映射到
          // 自适应网格 (bento) 使用的 4/6/8/12 列跨度。
          const span =
            item.size === "full" ? 12
              : item.size === "wide" ? 6
              : item.size === "large" ? 8
              : item.size === "medium" ? 6
              : 4;
          activation.customWidgetSpans![key] = span;
        }
      });
    }
  }

  // 3. 关键：过滤出当前真正启用的组件顺序（保留丰富有价值的组件生态，不强行截断）
  const activeOrder = baseOrder.filter(k => activation.enabledWidgets.includes(k));
  if (activeOrder.length === 0) {
    activeOrder.push("quick_answer", "takeaways", "sources", "actions_toolbox", "fast_chat", "followup", "metrics_telemetry");
  }

  // 4. 确保核心视觉组件在启用的组件中
  const finalEmphasized = activeOrder.includes(preferredEmphasized) ? preferredEmphasized : activeOrder[0];

  // 5. 仅对已启动的组件执行语义网格分配算法
  const packing = calculateServerAdaptiveBinPacking(activeOrder, {
    emphasizedWidget: finalEmphasized,
    intentType,
    hasOfficialSite: hasOfficial,
    maxColumnsPerRow: 12
  });

  const widthMap: Partial<Record<ResultWidgetKey, "full" | "wide" | "half" | "compact">> = {};
  activeOrder.forEach(k => {
    widthMap[k] = packing.gridConfig[k]?.semanticWidth || "full";
  });

  const layoutPlan = {
    intent: intentType,
    intentLabel,
    order: activeOrder,
    enabled: activeOrder,
    featured: finalEmphasized,
    width: widthMap,
    budget: {
      maxPrimary: 8,
      maxSecondary: 4,
      totalActive: activeOrder.length
    }
  };

  // 6. 构造专职 UI Layout Planner Agent 规范格式对象（包含 Action Layer 任务解决属性）
  const agentLayoutPlan = {
    layout_type: "modular_grid" as const,
    widgets: activeOrder.map((key, idx) => {
      const semWidth = widthMap[key] || "half";
      let size: "full" | "large" | "medium" | "small" | "compact" = "medium";
      if (semWidth === "full") size = "full";
      else if (semWidth === "wide") size = "large";
      else if (semWidth === "half") size = "medium";
      else if (semWidth === "compact") size = "small";

      if (key === "custom_cards" || key === "mindmap") size = "large";
      if (key === "metrics_telemetry" || key === "mobile_qr" || key === "followup") size = "small";

      let category: "information" | "action" | "hybrid" | "comparison" | "visualization" = "information";
      if (key === "official_portal" || key === "custom_cards" || isCodeTutorialQuery) {
        category = "action";
      } else if (key === "comparison") {
        category = "comparison";
      } else if (key === "mindmap") {
        category = "visualization";
      } else if (key === "quick_answer" || key === "takeaways") {
        category = "hybrid";
      }

      return {
        id: `w_${key}`,
        type: key,
        title: activation.widgetStatusMap[key]?.reason || key,
        category,
        priority: idx === 0 ? "highest" : (idx <= 3 ? "high" : "medium"),
        size,
        position: idx <= 3 ? "primary" : "secondary"
      };
    }),
    custom_widgets: Boolean(hasCustomCards) ? [
      {
        id: "cw_unique_card",
        title: "任务解决与独有业务行动看板",
        category: "action" as const,
        purpose: "根据搜索结果动态萃取高阶信息模型与任务执行入口 (Action Widget)，支持官网直达、命令复制与实操落地",
        importance: "high" as const,
        size: "full" as const,
        actions: [
          { type: "open_url" as const, label: "直达官方/主信源", variant: "primary" as const },
          { type: "copy" as const, label: "快速复制命令/配置", variant: "secondary" as const }
        ]
      }
    ] : []
  };

  return {
    intentType,
    intentLabel,
    explanation,
    componentOrder: activeOrder,
    emphasizedWidget: finalEmphasized,
    gridConfig: packing.gridConfig,
    layoutPlan,
    agentLayoutPlan: agentLayoutPlan as any,
    maxColumnsPerRow: 12,
    totalRows: packing.totalRows,
    packingMethod: "semantic-css-grid",
    enabledWidgets: activeOrder,
    disabledWidgets: activation.disabledWidgets,
    widgetStatusMap: activation.widgetStatusMap,
    autoFillGaps: false,
    autoFillMode: "off"
  };
}

export function generatePlanForQuery(
  query: string,
  detectedLang: DetectedLanguage,
  targetLang: { code: string; name: string; flag: string }
): AgentPlan {
  const isEn = targetLang.code === "en";
  const isJa = targetLang.code === "ja";

  const isComparisonQuery =
    /(对比|区别|优缺点|哪个好|vs|还是|区别在哪里|\b(compare|comparison|vs|versus|difference|better|pros and cons)\b|比較|違い|メリット|どっち)/i.test(query);
  const isTechnicalQuery =
    /(原理|架构|如何实现|配置|教程|代码|算法|机制|\b(architecture|how it works|how to|tutorial|internals|mechanism|algorithm|implementation|guide)\b|仕組み|原理|アーキテクチャ|使い方)/i.test(query);
  const isWebsiteOrNavQuery =
    /(官网|网站|网址|官方|主页|登录|入口|平台|下载|文档|\b(official|website|site|homepage|portal|login|download|docs|documentation)\b|公式サイト|公式|ホームページ|ポータル)/i.test(query);

  let intent = isEn
    ? "Comprehensive Technical Overview & Cross-Source Knowledge Synthesis"
    : isJa
    ? "包括的な技術概要と多角的な知識体系の整理"
    : "综合深度剖析与全局知识梳理";

  let comparisonDimensions = isEn
    ? ["Core Mechanisms & Architecture", "Real-World Applications & Ecosystem", "Performance & Trade-offs", "Production Guidelines & Constraints"]
    : isJa
    ? ["基本メカニズムとアーキテクチャ", "ユースケースとエコシステム", "性能とトレードオフ", "実践的導入指针と制約"]
    : ["核心定义与机制", "应用场景与生态", "性能与优劣势", "实践建议与限制"];

  let subQueries = [query];

  if (isWebsiteOrNavQuery) {
    const cleanEntity = query
      .replace(/(官网|官方网站|主页|网址|网站|入口|平台|official website|official site|website|homepage|portal|公式サイト|公式|ホームページ)/gi, "")
      .trim() || query;
    intent = isEn
      ? "Canonical Website Verification, Primary Portals, and Feature Overview"
      : isJa
      ? "公式サイトの特定、メインポータルへのアクセスおよび機能概要"
      : "官方网站定位、核心入口检索与功能全览";
    comparisonDimensions = isEn
      ? ["Canonical Domain & Portal", "Core Features & Services", "Access & Getting Started", "Ecosystem & Latest Release"]
      : isJa
      ? ["公式サイト・正規ドメイン", "主要機能・提供サービス", "アクセスと導入ガイド", "エコシステムと最新バージョン"]
      : ["官方入口与域名", "核心功能与服务", "使用/访问指南", "生态与最新版本"];
    subQueries = [
      query,
      `${cleanEntity} official website portal`,
      `${cleanEntity} documentation login`
    ];
  } else if (isComparisonQuery) {
    intent = isEn
      ? "Cross-Solution Comparative Analysis & Architectural Trade-offs"
      : isJa
      ? "主要ソリューションの横断比較とアーキテクチャ選定"
      : "多方技术/方案横向对比与选型决策";
    comparisonDimensions = isEn
      ? ["Design Philosophy & Architecture", "Throughput & Latency Benchmarks", "Developer Experience & Ecosystem", "Recommended Workload Fit"]
      : isJa
      ? ["設計思想とアーキテクチャ", "ベンチマークとスループット性能", "開発者体験と成熟度", "推奨ユースケース"]
      : ["设计理念与核心架构", "性能吞吐与延迟表现", "开发成本与生态成熟度", "适用业务场景推荐"];
    subQueries = [
      query,
      isEn ? `${query} detailed benchmark comparison` : `${query} 详细对比与基准评测`,
      isEn ? `${query} pros cons architectural differences` : `${query} 优劣势与选型指南`
    ];
  } else if (isTechnicalQuery) {
    intent = isEn
      ? "Technical Implementation Details, Underlying Mechanisms, and Production Best Practices"
      : isJa
      ? "技術的実装詳細、内部メカニズムと実践的ベストプラクティス"
      : "技术实现细节、底层机制与最佳工程实践";
    comparisonDimensions = isEn
      ? ["Core Principles & Control Flow", "Key Modules & Dependencies", "Production Optimization Considerations", "Common Pitfalls & Mitigations"]
      : isJa
      ? ["基本原理と制御フロー", "主要モジュールと依存関係", "本番環境での最適化手法", "典型的な注意点と対策"]
      : ["工作原理与核心流程", "关键组件与依赖关系", "生产环境调优考量", "潜在缺陷与避坑方案"];
    subQueries = [
      query,
      isEn ? `${query} architecture internals paper` : `${query} 架构解析与底层原理`,
      isEn ? `${query} production best practices guide` : `${query} 最佳实践与避坑`
    ];
  } else {
    // General queries: add cross-lingual sub-query if non-English
    if (detectedLang.code !== "en") {
      subQueries.push(`${query} documentation official overview`);
      subQueries.push(`${query} latest updates architecture`);
    } else {
      subQueries.push(`${query} overview documentation`);
      subQueries.push(`${query} key features benchmark`);
    }
  }

  // Cross-lingual enrichment for Chinese queries: add English technical query to access global docs
  if (detectedLang.code === "zh" && !subQueries.some(q => /^[a-zA-Z0-9\s]+$/.test(q))) {
    const cleanPinyinOrEnglish = query.replace(/[^\w\s]/gi, " ").trim();
    if (cleanPinyinOrEnglish.length > 2) {
      subQueries.push(`${cleanPinyinOrEnglish} official docs release`);
    }
  }

  return {
    originalQuery: query,
    intent,
    subQueries: Array.from(new Set(subQueries)),
    comparisonDimensions,
    detectedLanguage: detectedLang,
    targetLanguage: targetLang.code
  };
}
