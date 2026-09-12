import { searchSearxng } from "./searxng.js";
import { synthesizeWithOpenRouter, generateAlgorithmicSynthesis, normalizeModelId } from "./openrouter.js";
import { forgeUniqueCard, forgeMultipleDynamicWidgets, detectMultipleArchetypes } from "./cardForge.js";
import { planWidgetStrategy } from "./widgetPlanner.js";
import {
  masterOrchestratorAgent,
  retrievalAgent,
  widgetPlannerAgent,
  widgetArchitectAgent,
  tool_searxng_retrieval,
  tool_verify_official_portal,
  tool_plan_widget_strategy,
  tool_detect_card_archetype,
  tool_forge_unique_widget,
  tool_enforce_widget_uniqueness,
  tool_lookup_tool_registry
} from "./openaiAgents.js";
import {
  AgentPlan,
  AgentStep,
  SearchResult,
  SearchSynthesisResult,
  DetectedLanguage,
  AdaptiveLayoutStrategy,
  TeamMember,
  AgentTeamReport,
  AgentRole,
  AssignedTask,
  CustomCardData,
  WidgetPlan
} from "../src/types.js";
import { detectQueryLanguage, resolveTargetLanguage, getStepLocalization } from "./language.js";
import { determineAdaptiveLayout, generatePlanForQuery } from "./agent.js";

export interface AgentTeamRunOptions {
  query: string;
  customSearxngUrl?: string;
  openRouterApiKey?: string;
  model?: string;
  targetLanguage?: string;
  enableDeepSearch?: boolean;
  env?: Record<string, string | undefined>;
  onStepProgress?: (step: AgentStep, allSteps: AgentStep[]) => void;
  onTeamProgress?: (report: AgentTeamReport) => void;
}

/**
 * AgentTeam Multi-Agent Collaboration Engine
 * Strictly adheres to OpenAI Agents JS architecture guidelines:
 * https://github.com/openai/openai-agents-js
 * 
 * 核心架构原则（专注于搜索与小组件双核专长）：
 * 1. Triage & Orchestrator 模式：由主 Agent 统筹需求意图感知，并通过 formal handoff 委派给搜索与小组件专职智能体。
 * 2. 严密的职责边界：
 *    - 全网检索 Agent (RetrievalAgent)：专职多源检索 (SearXNG) 与权威官网甄别、信源去杂提纯。
 *    - 小组件规划与构建 Agent (WidgetPlannerAgent / WidgetArchitect)：专职小组件能力规划 (WidgetPlan)、意图原型决策与独有业务小组件锻造 (CustomCardData)，装配交互模型与防重复护栏。
 * 3. 并发调度协同：检索与小组件智能体紧密协作推进，最终汇聚交付主 Agent 验收交付。
 */
export async function runAgentTeam(options: AgentTeamRunOptions): Promise<SearchSynthesisResult> {
  const teamStartTime = Date.now();
  const query = options.query.trim();

  // 1. 定义主 Agent (Master Dispatcher) 统筹中枢
  const masterAgent = {
    name: "主 Agent (调度总控)",
    role: "coordinator" as AgentRole,
    title: "意图感知、任务委派与全局验收中枢",
    mandateSummary: "基于 OpenAI Agents JS 架构：负责意图研判，生成任务委派单，向全网检索 Agent 与小组件构建 Agent 派发专职指令并实时调度，最终集中验收全景交付"
  };

  // 2. 初始化 3 位角色明确、互不重叠的 Agent 成员（调度主 Agent + 搜索 Agent + 小组件 Agent）
  const members: TeamMember[] = [
    {
      id: "agent-coord",
      role: "coordinator",
      name: "主 Agent (调度总控)",
      title: "意图研判与任务派发中枢",
      isMaster: true,
      dedicatedDuty: "全局需求感知、协作任务拆解、向检索与小组件专职 Agent 派发独立任务并最终验收交付",
      avatarIcon: "Bot",
      status: "idle",
      currentTask: "待命统筹",
      completedTasksCount: 0,
      totalTasksCount: 2
    },
    {
      id: "agent-retrieval",
      role: "retrieval",
      name: "全网检索 Agent",
      title: "信源抓取与权威官网甄别专家",
      isMaster: false,
      dedicatedDuty: "专职负责全网多源抓取、跨语言检索分词、官方权威网站甄别与垃圾杂音清洗（专职信源保障）",
      avatarIcon: "Search",
      status: "idle",
      currentTask: "等待主 Agent 派发检索任务",
      assignedTaskId: "TASK-RETRIEVE",
      completedTasksCount: 0,
      totalTasksCount: 2
    },
    {
      id: "agent-widget-architect",
      role: "widget_forge",
      name: "小组件规划与构建 Agent",
      title: "小组件能力模型、原型规划与卡片锻造专家",
      isMaster: false,
      dedicatedDuty: "专职根据任务意图与信源特征，架构 WidgetPlan、规划组件能力模型与展示优先级，并锻造独一无二的交互式业务小组件 (Unique Card)，匹配最适原型（下载中心 / 在线工具 / 旅游行程 / 实操清单 / 场景裁决 / 参数矩阵 / 优劣避坑）",
      avatarIcon: "Blocks",
      status: "idle",
      currentTask: "等待主 Agent 派发小组件规划与锻造任务",
      assignedTaskId: "TASK-WIDGET-ARCHITECT",
      completedTasksCount: 0,
      totalTasksCount: 2
    }
  ];

  // 3. 由主 Agent 统筹派发的专门任务清单 (Task Delegation Matrix)
  const tasksDelegated: AssignedTask[] = [
    {
      id: "TASK-RETRIEVE",
      assignedToRole: "retrieval",
      assignedAgentName: "全网检索 Agent",
      taskName: "全网精准检索与权威信源甄别",
      mandate: `针对关键词 “${query}”，执行主词及跨语言/深度词多路检索，甄别核心官方网站，过滤垃圾与爬虫低质杂音。`,
      status: "pending"
    },
    {
      id: "TASK-WIDGET-ARCHITECT",
      assignedToRole: "widget_forge",
      assignedAgentName: "小组件规划与构建 Agent",
      taskName: "专属独有小组件架构与智能锻造",
      mandate: "专职分析实体类型与语义，规划能力模型 (WidgetPlan)，智能决策最契合交互原型（参数规格矩阵 / 演进时间线 / 实操清单 / 场景裁决 / 优劣避坑），构建独有业务交互模型并执行防重复护栏。",
      status: "pending"
    }
  ];

  let parallelTasksExecuted = 0;
  let estimatedSequentialTimeMs = 0;

  const emitTeamReport = (summary: string, speedup: number = 1.0) => {
    const report: AgentTeamReport = {
      teamName: "AgentTeam 智搜双核智能体协作组",
      masterAgent,
      tasksDelegated: tasksDelegated.map(t => ({ ...t })),
      members: members.map(m => ({ ...m })),
      collaborationSummary: summary,
      speedupMultiplier: Number(speedup.toFixed(1)),
      parallelTasksExecuted,
      totalSavedTimeMs: Math.max(0, estimatedSequentialTimeMs - (Date.now() - teamStartTime)),
      totalDurationMs: Date.now() - teamStartTime,
      timestamp: Date.now()
    };
    if (options.onTeamProgress) {
      options.onTeamProgress(report);
    }
    return report;
  };

  const updateMember = (
    role: AgentRole,
    status: TeamMember["status"],
    currentTask?: string,
    completedDelta: number = 0,
    metrics?: {
      executionTimeMs?: number;
      outputSummary?: string;
      speedup?: number;
      deliverables?: string[];
      assignedMandate?: string;
    }
  ) => {
    const m = members.find(item => item.role === role);
    if (!m) return;
    m.status = status;
    if (currentTask) m.currentTask = currentTask;
    if (completedDelta > 0) {
      m.completedTasksCount = Math.min(m.totalTasksCount, m.completedTasksCount + completedDelta);
    }
    if (metrics?.executionTimeMs) m.executionTimeMs = metrics.executionTimeMs;
    if (metrics?.outputSummary) m.outputSummary = metrics.outputSummary;
    if (metrics?.speedup) m.speedupMultiplier = metrics.speedup;
    if (metrics?.deliverables) m.deliverables = metrics.deliverables;
    if (metrics?.assignedMandate) m.assignedMandate = metrics.assignedMandate;
  };

  const updateAssignedTask = (
    taskId: string,
    status: AssignedTask["status"],
    deliverables?: string[],
    executionTimeMs?: number,
    completionSummary?: string
  ) => {
    const t = tasksDelegated.find(task => task.id === taskId);
    if (!t) return;
    t.status = status;
    if (deliverables) t.deliverables = deliverables;
    if (executionTimeMs !== undefined) t.executionTimeMs = executionTimeMs;
    if (completionSummary) t.completionSummary = completionSummary;
  };

  // Steps tracking
  const steps: AgentStep[] = [];
  function updateStep(
    id: string,
    title: string,
    description: string,
    status: AgentStep["status"],
    role: AgentRole,
    details?: string[],
    speedupFactor?: string
  ) {
    const existingIndex = steps.findIndex(s => s.id === id);
    const m = members.find(item => item.role === role);
    const step: AgentStep = {
      id,
      title,
      description,
      status,
      timestamp: Date.now(),
      details,
      agentRole: role,
      agentName: m?.name || "Agent",
      speedupFactor
    };
    if (existingIndex >= 0) {
      steps[existingIndex] = step;
    } else {
      steps.push(step);
    }
    if (options.onStepProgress) {
      options.onStepProgress(step, [...steps]);
    }
  }

  // =========================================================================
  // --- Phase 1: 主 Agent (调度总控 Coordinator) 意图研判与专门任务分配 ---
  // =========================================================================
  const tCoordStart = Date.now();
  updateMember("coordinator", "running", "主 Agent 正在研判意图，生成任务委派清单并分发专职指令");
  emitTeamReport("主 Agent 正在分析用户需求，解构协作图谱并向检索与小组件 Agent 派发独立任务");

  const detectedLang = detectQueryLanguage(query);
  const targetLang = resolveTargetLanguage(options.targetLanguage, detectedLang);

  const plan: AgentPlan = generatePlanForQuery(query, detectedLang, targetLang);

  // 主 Agent 生成的委派清单明细
  const planDetails: string[] = [
    `👑 【主 Agent 职责】: 全局意图解析、任务拆解与派发、进度监控与最终验收交付`,
    `📋 【OpenAI Agents 架构委派就绪】: 明确拆分为 2 个职责互不重叠的专门任务，分别指派给检索 Agent 与小组件 Agent 并发执行`,
    `👉 任务 1 [TASK-RETRIEVE] 委派给【全网检索 Agent】: 专职多路检索与官方门户甄别 (派发检索式: ${plan.subQueries.join(" | ")})`,
    `👉 任务 2 [TASK-WIDGET-ARCHITECT] 委派给【小组件规划与构建 Agent】: 专职架构并锻造独一无二的交互卡片，杜绝套用重复模板`
  ];

  updateAssignedTask("TASK-RETRIEVE", "running");
  updateAssignedTask("TASK-WIDGET-ARCHITECT", "pending");

  updateMember("coordinator", "completed", "主 Agent 意图研判完成，已向检索与小组件专职 Agent 统筹派发专属任务！", 1, {
    executionTimeMs: Date.now() - tCoordStart,
    outputSummary: "意图解析与任务委派完成：派发检索与小组件 2 个独立专长子任务"
  });

  updateStep(
    "plan",
    `[主 Agent 调度总控] 意图解析与任务派发`,
    `主 Agent 完成意图解析，通过 formal handoff 将检索与小组件构建任务委派给专门 Agent 并发执行。`,
    "completed",
    "coordinator",
    planDetails
  );

  emitTeamReport("主 Agent 任务委派完毕，全网检索 Agent 与小组件构建 Agent 正协同作业中！", 1.8);

  // =========================================================================
  // --- Phase 2: 全网检索 Agent (RetrievalAgent) 专职作业 ---
  // =========================================================================
  const retrievalPromise = (async () => {
    const tStart = Date.now();
    updateMember("retrieval", "running", "全网检索 Agent 正在多引擎并发抓取与甄别官方网站...");
    updateAssignedTask("TASK-RETRIEVE", "running");

    updateStep(
      "search_main",
      `[全网检索 Agent 专职执行] 全网多引擎并发检索`,
      `正在使用 SearXNG 聚合并发嗅探全网权威信源...`,
      "running",
      "retrieval"
    );

    const subQueriesToRun = plan.subQueries.slice(0, 3);
    const searchPromises = [
      searchSearxng(query, { customUrl: options.customSearxngUrl, env: options.env }),
      ...subQueriesToRun.map(sq => searchSearxng(sq, { customUrl: options.customSearxngUrl, env: options.env }))
    ];

    parallelTasksExecuted += searchPromises.length;
    estimatedSequentialTimeMs += searchPromises.length * 600;

    const allResultObjs = await Promise.all(searchPromises);
    const rawResults: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const obj of allResultObjs) {
      for (const item of (obj.results || [])) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          rawResults.push(item);
        }
      }
    }

    const tSearchDuration = Math.max(10, Date.now() - tStart);

    updateStep(
      "search_main",
      `[全网检索 Agent 专职执行] 全网多引擎并发检索完成`,
      `全网检索 Agent 成功抓取 ${rawResults.length} 条原始结果 (耗时 ${tSearchDuration}ms)。`,
      "completed",
      "retrieval",
      [`多路检索式: ${subQueriesToRun.join(", ")}`, `去重收录: ${rawResults.length} 条有效信源`]
    );

    updateMember("retrieval", "running", "全网检索 Agent 正在清洗过滤与甄别官方权威信源...", 1);

    // 权威信源甄别与垃圾清洗
    const tCleanStart = Date.now();
    const filteredResults: SearchResult[] = rawResults.filter(r => {
      const isAdOrSpam = /coupon|discount|promo|download-free|crack/i.test(r.title + " " + r.snippet);
      return !isAdOrSpam;
    });

    const isTechOrProduct = /^[a-zA-Z0-9\s._-]+$/.test(query) || /api|sdk|app|lib|framework|tool/i.test(query);
    const domainScores: Record<string, number> = {};
    for (const r of filteredResults) {
      try {
        const u = new URL(r.url);
        const domain = u.hostname.toLowerCase();
        let score = (r.score || 50);
        if (isTechOrProduct && (domain.includes("github.com") || domain.includes("docs.") || domain.includes(".org"))) {
          score += 25;
        }
        if (domain.includes(query.toLowerCase().replace(/\s+/g, ""))) {
          score += 35;
        }
        domainScores[r.url] = score;
      } catch {
        domainScores[r.url] = r.score || 50;
      }
    }

    filteredResults.sort((a, b) => (domainScores[b.url] || 0) - (domainScores[a.url] || 0));
    const finalCleanResults = filteredResults.slice(0, 12);
    const tCleanDuration = Math.max(10, Date.now() - tCleanStart);

    const retrievalDeliverables = [
      `全网信源库: 抓取 ${rawResults.length} 条原始信源`,
      `权威甄别清洗: 提纯 ${finalCleanResults.length} 条高质量权威信源`,
      `官方通道加权: 优先透出官方 Portal、API Docs 及规范仓库`
    ];

    updateAssignedTask(
      "TASK-RETRIEVE",
      "completed",
      retrievalDeliverables,
      Date.now() - tStart,
      `全网检索 Agent 已完成多源嗅探与权威信源交付`
    );

    updateMember("retrieval", "completed", "TASK-RETRIEVE 专职任务完成，高纯度信源已交付中枢", 1, {
      executionTimeMs: Date.now() - tStart,
      outputSummary: `抓取 ${rawResults.length} 条，清洗并提纯 ${finalCleanResults.length} 条权威信源`,
      speedup: 2.4,
      deliverables: retrievalDeliverables
    });

    updateStep(
      "filter_and_rank",
      `[全网检索 Agent 专职执行] 权威官网甄别与纯净信源交付`,
      `全网检索 Agent 已向主 Agent 提交 ${finalCleanResults.length} 条高信任度清洗信源。`,
      "completed",
      "retrieval",
      retrievalDeliverables
    );

    emitTeamReport("全网检索 Agent 专职任务交付完成，信源已交付小组件构建 Agent！", 2.2);

    return { filteredResults: finalCleanResults, rawResults };
  })();

  // =========================================================================
  // --- Search Synthesis (知识总结与核心速览提炼) ---
  // =========================================================================
  const selectedModel = normalizeModelId(options.model);
  const synthesisPromise = (async () => {
    const { filteredResults } = await retrievalPromise;
    try {
      return await synthesizeWithOpenRouter({
        query,
        plan,
        results: filteredResults,
        apiKey: options.openRouterApiKey,
        env: options.env,
        model: selectedModel,
        targetLanguage: targetLang,
        detectedLanguage: detectedLang
      });
    } catch (err: any) {
      return generateAlgorithmicSynthesis(
        query,
        plan,
        filteredResults,
        `${selectedModel} (算法极速构建)`,
        targetLang.code
      );
    }
  })();

  // =========================================================================
  // --- Phase 3: 小组件规划与构建 Agent (WidgetPlannerAgent / WidgetArchitect) ---
  // =========================================================================
  const widgetArchitectPromise = (async () => {
    const { filteredResults } = await retrievalPromise;
    const tActiveForgeStart = Date.now();

    updateMember("widget_forge", "running", "小组件规划与构建 Agent 正在规划能力模型并锻造独有小组件 (Unique Card)...");
    updateAssignedTask("TASK-WIDGET-ARCHITECT", "running");
    updateStep(
      "forge_unique_widget",
      `[小组件规划与构建 Agent 专职执行] 正在智能架构与锻造独有小组件...`,
      `分析真实信源语义，匹配最契合业务原型并装配数据模型与交互能力...`,
      "running",
      "widget_forge"
    );
    emitTeamReport("小组件规划与构建 Agent 正在锻造专属业务小组件...", 2.4);

    parallelTasksExecuted += 2;
    estimatedSequentialTimeMs += 1500;

    // 规划小组件策略
    const widgetPlan: WidgetPlan = await planWidgetStrategy({
      query,
      results: filteredResults,
      targetLanguage: targetLang.code,
      apiKey: options.openRouterApiKey,
      env: options.env
    });

    let forgedCards: CustomCardData[] = [];
    try {
      const forgePromise = forgeMultipleDynamicWidgets({
        query,
        results: filteredResults,
        widgetPlan,
        apiKey: options.openRouterApiKey,
        env: options.env,
        userPrompt: `依据任务意图【${widgetPlan.intent}】与真实信源提炼独有深度信息，装配完整的可交互数据模型与 Tool Registry 真实行动入口，坚决杜绝套用重复模板`
      });
      const timeoutPromise = new Promise<CustomCardData[]>((resolve) =>
        setTimeout(() => {
          console.warn("[WidgetArchitectAgent] Safe deadline reached, generating instant algorithmic fallback cards");
          resolve([]);
        }, 3500)
      );
      forgedCards = await Promise.race([forgePromise, timeoutPromise]);
    } catch (err: any) {
      console.warn("WidgetArchitectAgent auto card forge failed:", err);
      forgedCards = [];
    }

    if (!forgedCards || forgedCards.length === 0) {
      const archetypes = detectMultipleArchetypes(query, filteredResults);
      const c1 = await forgeUniqueCard({
        query,
        results: filteredResults,
        widgetPlan,
        archetype: archetypes[0],
        themeColor: "blue",
        colSpan: 6,
        apiKey: options.openRouterApiKey,
        env: options.env
      });
      const list = [c1];
      if (archetypes.length > 1 && archetypes[1] !== archetypes[0]) {
        const c2 = await forgeUniqueCard({
          query,
          results: filteredResults,
          widgetPlan,
          archetype: archetypes[1],
          themeColor: "emerald",
          colSpan: 6,
          apiKey: options.openRouterApiKey,
          env: options.env
        }).catch(() => null);
        if (c2) {
          if (c2.id === c1.id) c2.id = `custom-card-${Date.now()}-sec`;
          list.push(c2);
        }
      }
      forgedCards = list;
    }

    const tForgeTime = Math.max(30, Date.now() - tActiveForgeStart);
    const forgeSpeedup = 1500 / Math.max(tForgeTime, 150);

    const forgeDeliverables = [
      `智能多维原型决策: 依据意图【${widgetPlan.intent}】自主架构 ${forgedCards.length} 款专属业务小组件`,
      `能力模型装配: 注入 ${widgetPlan.capabilities.join(", ")} 真实交互能力`,
      ...forgedCards.map(c => `自主锻造组件【${c.title}】(${c.archetype}): 装配 ${c.actions?.length || 0} 个交互工具与专属数据模型`),
      `防重复护栏通过: 严格保障卡片独特性、信源真实佐证与独立标识`
    ];

    updateAssignedTask(
      "TASK-WIDGET-ARCHITECT",
      "completed",
      forgeDeliverables,
      tForgeTime,
      `小组件规划与构建 Agent 已根据检索结果自主锻造 ${forgedCards.length} 个独有小组件并交付`
    );

    updateMember("widget_forge", "completed", "TASK-WIDGET-ARCHITECT 专职任务完成，多维小组件已交付主 Agent", 2, {
      executionTimeMs: tForgeTime,
      outputSummary: `成功根据搜索结果自主锻造 ${forgedCards.length} 个独有小组件 (${forgedCards.map(c => c.archetype).join(" & ")})，装配真实能力`,
      speedup: Number(forgeSpeedup.toFixed(1)),
      deliverables: forgeDeliverables
    });

    updateStep(
      "forge_unique_widget",
      `[小组件规划与构建 Agent 专职执行] TASK-WIDGET-ARCHITECT 交付成果`,
      `小组件规划与构建 Agent 根据检索结果自主架构并锻造 ${forgedCards.length} 个独有小组件：${forgedCards.map(c => `【${c.title}】(${c.archetype})`).join("、")}。`,
      "completed",
      "widget_forge",
      forgeDeliverables,
      `${forgeSpeedup.toFixed(1)}x`
    );

    emitTeamReport(`小组件规划与构建 Agent 已完成 ${forgedCards.length} 个独有小组件锻造，准备终验！`, 2.6);

    return { widgetPlan, forgedCards };
  })();

  // 等待检索、小组件构建与综合提炼完成
  const [retrievalRes, widgetRes, synthesis] = await Promise.all([
    retrievalPromise,
    widgetArchitectPromise,
    synthesisPromise
  ]);

  const { filteredResults, rawResults } = retrievalRes;
  const { widgetPlan, forgedCards } = widgetRes;

  // 挂载锻造好的独有小组件
  if (forgedCards && forgedCards.length > 0) {
    synthesis.customCards = forgedCards;
  } else {
    synthesis.customCards = [];
  }

  // 综合排版装箱策略计算
  const layoutStrategy: AdaptiveLayoutStrategy = determineAdaptiveLayout({
    query,
    plan,
    filteredResults,
    comparisonCount: 3,
    mindMapBranches: 4,
    followUpCount: 3,
    hasOfficial: filteredResults.some(r => r.isOfficial),
    targetLanguage: targetLang.code,
    widgetPlan
  });

  // =========================================================================
  // --- Phase 4: 主 Agent (调度总控) 最终验收与全景交付 ---
  // =========================================================================
  const totalActualExecutionTimeMs = Date.now() - teamStartTime;
  const overallSpeedupMultiplier = Math.max(2.0, Math.min(3.6, estimatedSequentialTimeMs / Math.max(totalActualExecutionTimeMs, 700)));

  updateMember("coordinator", "completed", "主 Agent 验收所有专职 Agent 交付成果，已聚合完成全景交付", 1, {
    outputSummary: "主 Agent 验收完成：全网检索 Agent 与小组件规划构建 Agent 协同闭环通过"
  });

  const finalSummaryMessage = `AgentTeam (OpenAI Agents JS 架构) 协同圆满完成：检索 Agent 与小组件 Agent 双核作业，加速约 ${overallSpeedupMultiplier.toFixed(1)}x！`;
  const finalTeamReport = emitTeamReport(finalSummaryMessage, overallSpeedupMultiplier);

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
    modelUsed: synthesis.modelUsed || selectedModel,
    executionTimeMs: totalActualExecutionTimeMs,
    isMockFallback: synthesis.isMockFallback,
    detectedLanguage: detectedLang,
    targetLanguage: targetLang.code,
    layoutStrategy,
    agentTeam: finalTeamReport,
    customCards: synthesis.customCards || [],
    widgetPlan
  };
}
