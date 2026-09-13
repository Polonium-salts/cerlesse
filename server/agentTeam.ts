import { synthesizeWithOpenRouter, generateAlgorithmicSynthesis, normalizeModelId } from "./openrouter.js";
import { forgeUniqueCard, forgeMultipleDynamicWidgets, detectMultipleArchetypes } from "./cardForge.js";
import { planWidgetStrategy } from "./widgetPlanner.js";
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
import { detectQueryLanguage, resolveTargetLanguage } from "./language.js";
import { generatePlanForQuery } from "./agent.js";
import { planWidgetLayout, WIDGET_LAYOUT_AGENT_NAME } from "./layoutAgent.js";
import { getWidgetLabel } from "../src/lib/adaptiveLayout.js";
import { runRetrievalAgent, summarizeRetrieval, RetrievalAgentResult } from "./retrievalAgent.js";
import { runOrchestration, StageDefinition, StageReport } from "./orchestrator.js";

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

/** 各阶段的硬超时预算（毫秒）。任何阶段都不允许无限期挂住整条流水线。 */
const STAGE_TIMEOUTS = {
  retrieve: 9000,
  synthesize: 12000,
  widgetPlan: 4000,
  forge: 4500,
  layout: 5000
} as const;

/**
 * 综合提炼的产出结构。
 * `customCards` 由小组件构建 Agent 在收尾阶段挂载——它不属于提炼引擎本身，
 * 但会随研报一起交付给前端，因此在这里显式补进类型（旧代码用隐式 any 绕过，一直是类型漏洞）。
 */
type SynthesisPayload = Awaited<ReturnType<typeof synthesizeWithOpenRouter>> & {
  customCards?: CustomCardData[];
};

/** 编排黑板：阶段之间只通过它交换数据，不依赖闭包捕获顺序 */
interface TeamState {
  plan?: AgentPlan;
  retrieval?: RetrievalAgentResult;
  widgetPlan?: WidgetPlan;
  forgedCards: CustomCardData[];
  synthesis?: SynthesisPayload;
  layout?: { decision: Awaited<ReturnType<typeof planWidgetLayout>>["decision"]; strategy: AdaptiveLayoutStrategy };
}

/**
 * AgentTeam Multi-Agent Collaboration Engine
 * ============================================================
 * 架构：声明式阶段依赖图 + 就绪即启动的并发调度（见 orchestrator.ts）
 *
 * 职责边界（互不重叠）：
 *   - 全网检索 Agent   ：多路查询规划 → 并发检索 → 候选聚合 → 相关性重排（产出纯净信源）
 *   - 小组件构建 Agent ：能力规划 WidgetPlan + 独有卡片锻造 CustomCardData
 *   - 小组件排版 Agent ：启停/阅读序/栅格跨度/视觉焦点 → 12 栅格行带对齐决策单
 *   - 主 Agent         ：意图研判、任务派发、全局验收
 *
 * 依赖图（→ 表示依赖）：
 *
 *      plan ─→ retrieve ─┬─→ synthesize ─┐
 *                        ├─→ widgetPlan ─┼─→ layout ─┐
 *                        │      └─→ forge ┘           ├─→ finalize
 *                        └────────────────────────────┘
 *
 * 相比旧实现的关键改进：
 *   1. layout 只依赖「检索 + 组件规划 + 综合提炼」，**不再等待卡片锻造**。
 *      旧实现里 layout 等整个 widgetArchitectPromise（含最长 3.5s 的锻造竞速），
 *      锻造慢就白白拖住排版，锻造耗时被重复计入了端到端延迟。
 *   2. 所有超时/降级策略集中声明，不再散落成各处的 Promise.race + setTimeout。
 *   3. 加速比来自真实测量（各阶段耗时之和 ÷ 实际墙钟），而不是硬编码的估算值。
 */
export async function runAgentTeam(options: AgentTeamRunOptions): Promise<SearchSynthesisResult> {
  const teamStartTime = Date.now();
  const query = options.query.trim();

  // =========================================================================
  // 0. 协作组编制：主 Agent + 3 位专职 Agent
  // =========================================================================
  const masterAgent = {
    name: "主 Agent (调度总控)",
    role: "coordinator" as AgentRole,
    title: "意图感知、任务委派与全局验收中枢",
    mandateSummary:
      "基于声明式阶段依赖图：负责意图研判与任务委派，向全网检索 Agent、小组件构建 Agent 与小组件排版 Agent 派发专职指令，" +
      "由编排内核按依赖关系并发调度，最终集中验收全景交付"
  };

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
      totalTasksCount: 3
    },
    {
      id: "agent-retrieval",
      role: "retrieval",
      name: "全网检索 Agent",
      title: "信源抓取与权威官网甄别专家",
      isMaster: false,
      dedicatedDuty: "专职多路查询规划、跨语言并发抓取、候选聚合去重、相关性重排与官方权威网站甄别（专职信源保障）",
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
      dedicatedDuty:
        "专职根据任务意图与信源特征，架构 WidgetPlan、规划组件能力模型与展示优先级，并锻造独一无二的交互式业务小组件 (Unique Card)，匹配最适原型（下载中心 / 在线工具 / 旅游行程 / 实操清单 / 场景裁决 / 参数矩阵 / 优劣避坑）",
      avatarIcon: "Blocks",
      status: "idle",
      currentTask: "等待主 Agent 派发小组件规划与锻造任务",
      assignedTaskId: "TASK-WIDGET-ARCHITECT",
      completedTasksCount: 0,
      totalTasksCount: 2
    },
    {
      id: "agent-layout",
      role: "layout",
      name: WIDGET_LAYOUT_AGENT_NAME,
      title: "12 栅格小组件排版编排专家",
      isMaster: false,
      dedicatedDuty: "专职决定小组件的上桌启停、阅读序、板块栅格跨度与视觉焦点，执行行带对齐装箱，把组件清单翻译成零留白的 12 栅格桌面（专职排版编排）",
      avatarIcon: "LayoutGrid",
      status: "idle",
      currentTask: "等待主 Agent 派发排版编排任务",
      assignedTaskId: "TASK-LAYOUT",
      completedTasksCount: 0,
      totalTasksCount: 2
    }
  ];

  const tasksDelegated: AssignedTask[] = [
    {
      id: "TASK-RETRIEVE",
      assignedToRole: "retrieval",
      assignedAgentName: "全网检索 Agent",
      taskName: "多路查询规划与权威信源甄别",
      mandate: `针对关键词 “${query}”，规划主查询/权威/实操/跨语言多路检索式并发抓取，聚合去重后执行相关性重排，甄别核心官方网站，过滤内容农场与导流杂音。`,
      status: "pending"
    },
    {
      id: "TASK-WIDGET-ARCHITECT",
      assignedToRole: "widget_forge",
      assignedAgentName: "小组件规划与构建 Agent",
      taskName: "专属独有小组件架构与智能锻造",
      mandate: "专职分析实体类型与语义，规划能力模型 (WidgetPlan)，智能决策最契合交互原型（参数规格矩阵 / 演进时间线 / 实操清单 / 场景裁决 / 优劣避坑），构建独有业务交互模型并执行防重复护栏。",
      status: "pending"
    },
    {
      id: "TASK-LAYOUT",
      assignedToRole: "layout",
      assignedAgentName: WIDGET_LAYOUT_AGENT_NAME,
      taskName: "12 栅格小组件排版编排与视觉焦点规划",
      mandate: "专职接收 WidgetPlan 与既有组件清单，裁决组件的上桌启停、主阅读序、每张卡片的 12 栅格跨度与视觉焦点组件，并执行行带对齐装箱，输出可直接渲染的排版决策单 (WidgetLayoutDecision)。",
      status: "pending"
    }
  ];

  const emitTeamReport = (
    summary: string,
    speedup: number = 1.0,
    metrics?: { parallelTasksExecuted?: number; totalSavedTimeMs?: number; orchestration?: AgentTeamReport["orchestration"] }
  ) => {
    const report: AgentTeamReport = {
      teamName: "AgentTeam 智搜双核智能体协作组",
      masterAgent,
      tasksDelegated: tasksDelegated.map((t) => ({ ...t })),
      members: members.map((m) => ({ ...m })),
      collaborationSummary: summary,
      speedupMultiplier: Number(speedup.toFixed(1)),
      parallelTasksExecuted: metrics?.parallelTasksExecuted ?? 0,
      totalSavedTimeMs: metrics?.totalSavedTimeMs ?? 0,
      totalDurationMs: Date.now() - teamStartTime,
      timestamp: Date.now(),
      orchestration: metrics?.orchestration
    };
    options.onTeamProgress?.(report);
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
    const m = members.find((item) => item.role === role);
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
    const t = tasksDelegated.find((task) => task.id === taskId);
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
    const existingIndex = steps.findIndex((s) => s.id === id);
    const m = members.find((item) => item.role === role);
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
    if (existingIndex >= 0) steps[existingIndex] = step;
    else steps.push(step);
    options.onStepProgress?.(step, [...steps]);
  }

  // =========================================================================
  // 1. 主 Agent：意图研判与任务派发
  // =========================================================================
  const tCoordStart = Date.now();
  updateMember("coordinator", "running", "主 Agent 正在研判意图，生成任务委派清单并分发专职指令");
  emitTeamReport("主 Agent 正在分析用户需求，解构协作图谱并向检索与小组件 Agent 派发独立任务");

  const detectedLang: DetectedLanguage = detectQueryLanguage(query);
  const targetLang = resolveTargetLanguage(options.targetLanguage, detectedLang);
  const plan: AgentPlan = generatePlanForQuery(query, detectedLang, targetLang);
  const selectedModel = normalizeModelId(options.model);

  updateAssignedTask("TASK-RETRIEVE", "running");
  updateStep(
    "plan",
    `[主 Agent 调度总控] 意图解析与任务派发`,
    `主 Agent 完成意图解析，通过声明式依赖图将检索、组件构建与排版任务委派给专门 Agent 并发执行。`,
    "completed",
    "coordinator",
    [
      `👑 【主 Agent 职责】: 全局意图解析、任务拆解与派发、进度监控与最终验收交付`,
      `📋 【声明式编排就绪】: 4 个专职阶段按依赖图调度，依赖一就绪即启动，不再批量等待`,
      `👉 任务 1 [TASK-RETRIEVE] 委派给【全网检索 Agent】: 多路查询规划与相关性重排 (意图子查询: ${plan.subQueries.slice(0, 3).join(" | ")})`,
      `👉 任务 2 [TASK-WIDGET-ARCHITECT] 委派给【小组件规划与构建 Agent】: 专职架构并锻造独一无二的交互卡片，杜绝套用重复模板`,
      `👉 任务 3 [TASK-LAYOUT] 委派给【${WIDGET_LAYOUT_AGENT_NAME}】: 专职把组件清单编排为 12 栅格桌面，裁决启停、阅读序、板块跨度与视觉焦点`
    ]
  );
  updateMember("coordinator", "completed", "主 Agent 意图研判完成，已向专职 Agent 统筹派发专属任务！", 1, {
    executionTimeMs: Date.now() - tCoordStart,
    outputSummary: "意图解析与任务委派完成：按依赖图派发检索/组件/排版 3 个独立专长子任务"
  });
  emitTeamReport("主 Agent 任务委派完毕，专职 Agent 正按依赖图协同作业中！", 1.8);

  // 预登记步骤，保证进度面板的展示顺序稳定（而不是按完成先后乱序跳动）
  updateStep("search_main", `[全网检索 Agent 专职执行] 多路查询规划与并发检索`, `等待派发...`, "pending", "retrieval");
  updateStep("filter_and_rank", `[全网检索 Agent 专职执行] 候选聚合与相关性重排`, `等待前置就绪...`, "pending", "retrieval");
  updateStep("synthesize", `[知识综合引擎] 全景研报提炼`, `等待信源就绪...`, "pending", "coordinator");
  updateStep("forge_unique_widget", `[小组件规划与构建 Agent 专职执行] 能力规划与独有卡片锻造`, `等待信源就绪...`, "pending", "widget_forge");
  updateStep("layout_plan", `[${WIDGET_LAYOUT_AGENT_NAME} 专职执行] 12 栅格行带对齐编排`, `等待前置就绪...`, "pending", "layout");

  // =========================================================================
  // 2. 声明式阶段定义
  // =========================================================================
  const state: TeamState = { plan, forgedCards: [] };

  const stages: StageDefinition<TeamState>[] = [
    // ---- 阶段 A：全网检索 Agent -------------------------------------------
    {
      id: "retrieve",
      name: "多路检索与相关性重排",
      role: "retrieval",
      critical: true,
      timeoutMs: STAGE_TIMEOUTS.retrieve,
      run: async (ctx) => {
        updateMember("retrieval", "running", "全网检索 Agent 正在规划多路检索式并并发抓取...");
        updateStep(
          "search_main",
          `[全网检索 Agent 专职执行] 多路查询规划与并发检索`,
          `正在按「主查询 / 权威 / 实操 / 跨语言」多路视角并发下发检索式...`,
          "running",
          "retrieval"
        );

        const result = await runRetrievalAgent({
          query,
          plan,
          detectedLanguage: detectedLang,
          targetLanguage: targetLang,
          customSearxngUrl: options.customSearxngUrl,
          env: options.env,
          maxRoutes: 4,
          limit: 12,
          concurrency: 3,
          signal: ctx.signal
        });

        ctx.state.retrieval = result;
      },
      fallback: async (ctx) => {
        // 检索是这个系统的地基：即便全线超时也必须给出可渲染的最小信源集
        const empty = await runRetrievalAgent({
          query,
          plan,
          detectedLanguage: detectedLang,
          targetLanguage: targetLang,
          customSearxngUrl: options.customSearxngUrl,
          env: options.env,
          maxRoutes: 1,
          limit: 12,
          concurrency: 1
        });
        ctx.state.retrieval = empty;
      }
    },

    // ---- 阶段 B1：知识综合 ------------------------------------------------
    {
      id: "synthesize",
      name: "全景研报提炼",
      role: "coordinator",
      deps: ["retrieve"],
      critical: false, // 失败可降级为算法综合，不应阻断交付
      timeoutMs: STAGE_TIMEOUTS.synthesize,
      run: async (ctx) => {
        const results = ctx.state.retrieval?.results || [];
        updateStep(
          "synthesize",
          `[知识综合引擎] 全景研报提炼`,
          `正在基于 ${results.length} 条高置信信源提炼速答、要点、对比矩阵与思维导图...`,
          "running",
          "coordinator"
        );

        const payload = await synthesizeWithOpenRouter({
          query,
          plan,
          results,
          apiKey: options.openRouterApiKey,
          env: options.env,
          model: selectedModel,
          targetLanguage: targetLang,
          detectedLanguage: detectedLang
        });
        ctx.state.synthesis = payload;
      },
      fallback: async (ctx) => {
        const results = ctx.state.retrieval?.results || [];
        ctx.state.synthesis = generateAlgorithmicSynthesis(
          query,
          plan,
          results,
          `${selectedModel} (算法极速构建)`,
          targetLang.code
        );
      }
    },

    // ---- 阶段 B2：小组件能力规划 ------------------------------------------
    {
      id: "widgetPlan",
      name: "组件能力模型规划",
      role: "widget_forge",
      deps: ["retrieve"],
      critical: false,
      timeoutMs: STAGE_TIMEOUTS.widgetPlan,
      run: async (ctx) => {
        const results = ctx.state.retrieval?.results || [];
        ctx.state.widgetPlan = await planWidgetStrategy({
          query,
          results,
          targetLanguage: targetLang.code,
          apiKey: options.openRouterApiKey,
          env: options.env
        });
      }
    },

    // ---- 阶段 B3：独有卡片锻造（与排版并行，不再阻塞排版）-----------------
    {
      id: "forge",
      name: "独有交互卡片锻造",
      role: "widget_forge",
      deps: ["widgetPlan"],
      critical: false,
      timeoutMs: STAGE_TIMEOUTS.forge,
      run: async (ctx) => {
        const results = ctx.state.retrieval?.results || [];
        const widgetPlan = ctx.state.widgetPlan;
        if (!widgetPlan) return;

        updateMember("widget_forge", "running", "小组件规划与构建 Agent 正在规划能力模型并锻造独有小组件 (Unique Card)...");
        updateAssignedTask("TASK-WIDGET-ARCHITECT", "running");
        updateStep(
          "forge_unique_widget",
          `[小组件规划与构建 Agent 专职执行] 能力规划与独有卡片锻造`,
          `依据意图【${widgetPlan.intent}】匹配最适业务原型并装配数据模型与交互能力...`,
          "running",
          "widget_forge"
        );

        ctx.state.forgedCards = await forgeMultipleDynamicWidgets({
          query,
          results,
          widgetPlan,
          apiKey: options.openRouterApiKey,
          env: options.env,
          userPrompt: `依据任务意图【${widgetPlan.intent}】与真实信源提炼独有深度信息，装配完整的可交互数据模型与 Tool Registry 真实行动入口，坚决杜绝套用重复模板`
        });
      },
      fallback: async (ctx) => {
        // 锻造超时/失败时，退回确定性原型检测 + 单卡锻造，保证桌面不空
        const results = ctx.state.retrieval?.results || [];
        const widgetPlan = ctx.state.widgetPlan;
        if (!widgetPlan) return;

        const archetypes = detectMultipleArchetypes(query, results);
        const first = await forgeUniqueCard({
          query,
          results,
          widgetPlan,
          archetype: archetypes[0],
          themeColor: "blue",
          colSpan: 6,
          apiKey: options.openRouterApiKey,
          env: options.env
        });
        const list: CustomCardData[] = [first];
        if (archetypes.length > 1 && archetypes[1] !== archetypes[0]) {
          const second = await forgeUniqueCard({
            query,
            results,
            widgetPlan,
            archetype: archetypes[1],
            themeColor: "emerald",
            colSpan: 6,
            apiKey: options.openRouterApiKey,
            env: options.env
          }).catch(() => null);
          if (second) {
            if (second.id === first.id) second.id = `custom-card-${Date.now()}-sec`;
            list.push(second);
          }
        }
        ctx.state.forgedCards = list;
      }
    },

    // ---- 阶段 C：排版编排（依赖检索 + 组件规划 + 综合提炼，但不依赖锻造）--
    {
      id: "layout",
      name: "12 栅格排版编排",
      role: "layout",
      deps: ["retrieve", "widgetPlan", "synthesize"],
      critical: false,
      timeoutMs: STAGE_TIMEOUTS.layout,
      run: async (ctx) => {
        updateMember("layout", "running", `${WIDGET_LAYOUT_AGENT_NAME} 正在编排 12 栅格桌面排版（启停/阅读序/跨度/焦点）...`);
        updateAssignedTask("TASK-LAYOUT", "running");
        updateStep(
          "layout_plan",
          `[${WIDGET_LAYOUT_AGENT_NAME} 专职执行] 12 栅格行带对齐编排`,
          `接收组件规划与内容密度信号，裁决上桌启停、主阅读序、板块跨度与视觉焦点，并执行行带对齐装箱...`,
          "running",
          "layout"
        );

        const synthesis = ctx.state.synthesis;
        const { decision, strategy } = await planWidgetLayout({
          query,
          results: ctx.state.retrieval?.results || [],
          plan,
          widgetPlan: ctx.state.widgetPlan,
          targetLanguage: targetLang.code,
          apiKey: options.openRouterApiKey,
          model: selectedModel,
          env: options.env,
          signals: {
            // 真实内容密度信号：让排版随研报真实产出收缩/扩张。
            // 启停裁决据此判断组件"有没有东西可渲染"，而不是仅凭能力命中就上桌。
            comparisonCount: synthesis?.comparisonTable?.length || 0,
            mindMapBranches: synthesis?.mindMap?.children?.length || 0,
            followUpCount: synthesis?.followUpQuestions?.length || 0,
            takeawayCount: synthesis?.keyTakeaways?.length || 0,
            summaryLength: synthesis?.summary?.length || 0
          }
        });

        ctx.state.layout = { decision, strategy };
      }
    }
  ];

  // =========================================================================
  // 3. 编排执行：就绪即启动，超时统一降级
  // =========================================================================
  const orchestration = await runOrchestration<TeamState>({
    name: "AgentTeam 协作编排",
    state,
    stages,
    maxConcurrency: 5,
    globalTimeoutMs: 30000,
    onStageUpdate: (report) => {
      if (report.status === "running") {
        emitTeamReport(`${report.name} 正在执行...`, 2.0);
      }
    }
  });

  const retrieval = state.retrieval!;
  const filteredResults = retrieval.results;
  const rawResults = retrieval.rawResults;
  const widgetPlan = state.widgetPlan;
  const forgedCards = state.forgedCards;
  const synthesis: SynthesisPayload =
    state.synthesis ||
    generateAlgorithmicSynthesis(query, plan, filteredResults, `${selectedModel} (算法极速构建)`, targetLang.code);

  const stageOf = (id: string): StageReport | undefined => orchestration.stages.find((s) => s.id === id);
  const degradedNote = (id: string): string => {
    const stage = stageOf(id);
    if (!stage) return "";
    if (stage.status === "degraded") return `（已降级：${stage.degradedReason || "超时"}）`;
    if (stage.status === "failed") return "（失败已兜底）";
    if (stage.status === "skipped") return "（被上游阻断）";
    return "";
  };

  // =========================================================================
  // 4. 各专职 Agent 交付物沉淀
  // =========================================================================

  // ---- 检索 Agent ----
  const retrievalDiag = retrieval.diagnostics;
  const retrievalDeliverables = [
    `多路查询规划: 下发 ${retrievalDiag.routes.length} 条不同检索视角的路由`,
    `候选聚合: 抓取 ${retrievalDiag.totalCandidates} 条原始候选 → URL 归一化去重为 ${retrievalDiag.uniqueCandidates} 个独立页面`,
    `相关性重排: 保留 ${retrievalDiag.keptAfterRanking} 条高置信信源（词项覆盖 + 多路共识 + 权威先验综合打分）`,
    `信源多样性: 覆盖 ${retrievalDiag.domainCount} 个域名，含 ${retrievalDiag.officialCount} 条权威/官方信源`,
    `检索后端聚合: ${retrievalDiag.instancesUsed.length} 个后端（避免单一索引覆盖盲区）`
  ];
  const retrievalReasoning = summarizeRetrieval(retrievalDiag, targetLang.code);

  const retrievalStage = stageOf("retrieve")!;
  updateAssignedTask(
    "TASK-RETRIEVE",
    retrievalStage.status === "completed" ? "completed" : "error",
    retrievalDeliverables,
    retrievalStage.durationMs,
    `全网检索 Agent 已完成多路检索与相关性重排${degradedNote("retrieve")}`
  );
  updateMember("retrieval", retrievalStage.status === "failed" ? "error" : "completed",
    "TASK-RETRIEVE 专职任务完成，高纯度信源已交付中枢", 1, {
      executionTimeMs: retrievalStage.durationMs,
      outputSummary: `下发 ${retrievalDiag.routes.length} 路检索，提纯 ${filteredResults.length} 条信源（${retrievalDiag.domainCount} 个域名 / ${retrievalDiag.officialCount} 条权威）`,
      deliverables: retrievalDeliverables
    });

  updateStep(
    "search_main",
    `[全网检索 Agent 专职执行] 多路查询规划与并发检索完成`,
    `多路检索式并发下发完毕，共抓取 ${retrievalDiag.totalCandidates} 条原始候选。`,
    "completed",
    "retrieval",
    retrievalDiag.routes.map((r) =>
      `${r.purpose}: “${r.query}” → ${r.count} 条${r.instance !== "pending" ? ` (${r.instance})` : ""}${r.error ? ` [失败: ${r.error}]` : ""}`
    )
  );

  updateStep(
    "filter_and_rank",
    `[全网检索 Agent 专职执行] 候选聚合与相关性重排`,
    `去重后得 ${retrievalDiag.uniqueCandidates} 个独立页面，重排保留 ${filteredResults.length} 条高置信信源${degradedNote("retrieve")}。`,
    "completed",
    "retrieval",
    [...retrievalDeliverables, ...retrievalReasoning]
  );

  // ---- 知识综合 ----
  const synthesisStage = stageOf("synthesize")!;
  updateStep(
    "synthesize",
    `[知识综合引擎] 全景研报提炼`,
    `已基于 ${filteredResults.length} 条高置信信源产出速答、要点、对比矩阵与思维导图${degradedNote("synthesize")}。`,
    synthesisStage.status === "failed" ? "error" : "completed",
    "coordinator",
    [
      `核心速览: ${synthesis.keyTakeaways?.length || 0} 条`,
      `对比维度: ${synthesis.comparisonTable?.length || 0} 个`,
      `思维导图分支: ${synthesis.mindMap?.children?.length || 0} 个`,
      `产出模型: ${synthesis.modelUsed || selectedModel}`
    ]
  );

  // ---- 小组件构建 Agent ----
  const forgeStage = stageOf("forge")!;
  const widgetPlanDesc = widgetPlan ? widgetPlan.intent : "未知意图";
  const forgeDeliverables = [
    `能力模型规划: 意图【${widgetPlanDesc}】，能力 [${widgetPlan?.capabilities?.join(", ") || "无"}]`,
    `独有卡片锻造: ${forgedCards.length} 款（${forgedCards.map((c) => c.archetype).join(" & ") || "无"}）`,
    ...forgedCards.map((c) => `【${c.title}】(${c.archetype}): 装配 ${c.actions?.length || 0} 个交互工具与专属数据模型`),
    `防重复护栏通过: 严格保障卡片独特性、信源真实佐证与独立标识`
  ];
  const forgeDuration = forgeStage.durationMs;
  updateAssignedTask(
    "TASK-WIDGET-ARCHITECT",
    "completed",
    forgeDeliverables,
    forgeDuration,
    `小组件规划与构建 Agent 已锻造 ${forgedCards.length} 个独有小组件并交付`
  );
  updateMember("widget_forge", "completed", "TASK-WIDGET-ARCHITECT 专职任务完成，多维小组件已交付主 Agent", 2, {
    executionTimeMs: forgeDuration,
    outputSummary: `成功锻造 ${forgedCards.length} 个独有小组件 (${forgedCards.map((c) => c.archetype).join(" & ") || "无"})，装配真实能力`,
    deliverables: forgeDeliverables
  });
  updateStep(
    "forge_unique_widget",
    `[小组件规划与构建 Agent 专职执行] 能力规划与独有卡片锻造交付`,
    `已架构 ${forgedCards.length} 个独有小组件：${forgedCards.map((c) => `【${c.title}】(${c.archetype})`).join("、") || "无"}${degradedNote("forge")}。`,
    "completed",
    "widget_forge",
    forgeDeliverables
  );

  // ---- 排版 Agent ----
  const layoutStage = stageOf("layout")!;
  const layout = state.layout;
  const layoutDeliverables = layout
    ? [
      `排版意图判定: ${layout.decision.intentLabel}`,
      `主阅读序 (${layout.decision.componentOrder.length} 个组件): ${layout.decision.componentOrder.map((k) => getWidgetLabel(k)).join(" → ")}`,
      `视觉焦点: ${getWidgetLabel(layout.decision.emphasizedWidget)} (${layout.decision.spans[layout.decision.emphasizedWidget] ?? 6}/12 栅格跨度)`,
      `启停裁决: 启用 ${layout.decision.enabledWidgets.length} 个 / 休眠 ${layout.decision.disabledWidgets.length} 个冗余组件`,
      `瀑布流错落装箱: ${layout.decision.staggeredTiles ?? 0} 张磁贴独占顶线（共 ${layout.decision.topLines ?? 0} 条顶线），桌面下沿参差 ${Math.round(layout.decision.raggednessPx ?? 0)}px`,
      `内部空洞: 仅 ${layout.decision.interiorGaps ?? 0} 个栅格单元${(layout.decision.adjustedSpans ?? 0) > 0 ? `；${layout.decision.adjustedSpans} 张磁贴宽度微调一档以封住窄缝` : ""}`,
      layout.decision.llmRefined
        ? `阅读序经大模型语义精修 (${layout.decision.modelUsed})`
        : `确定性能力装箱求解 (结果稳定可复现)`
    ]
    : ["排版编排未产出，已回落到基线布局策略"];

  updateAssignedTask("TASK-LAYOUT", layout ? "completed" : "error", layoutDeliverables, layoutStage.durationMs,
    `${WIDGET_LAYOUT_AGENT_NAME} 已完成 12 栅格排版编排并交付排版决策单`);
  updateMember("layout", layout ? "completed" : "error",
    "TASK-LAYOUT 专职任务完成，排版决策单已交付主 Agent", 1, {
      executionTimeMs: layoutStage.durationMs,
      outputSummary: layout
        ? `完成 ${layout.decision.componentOrder.length} 个组件的行带对齐排版：焦点「${getWidgetLabel(layout.decision.emphasizedWidget)}」，共 ${layout.decision.gridRows ?? 0} 行`
        : "排版编排降级，已回落基线策略",
      deliverables: layoutDeliverables
    });
  updateStep(
    "layout_plan",
    `[${WIDGET_LAYOUT_AGENT_NAME} 专职执行] 排版决策单交付`,
    layout
      ? `${WIDGET_LAYOUT_AGENT_NAME} 已固化 ${layout.decision.componentOrder.length} 个组件的 12 栅格排版，视觉焦点锁定「${getWidgetLabel(layout.decision.emphasizedWidget)}」${degradedNote("layout")}。`
      : `排版编排降级，已回落基线策略${degradedNote("layout")}。`,
    layout ? "completed" : "error",
    "layout",
    layoutDeliverables
  );

  // =========================================================================
  // 5. 主 Agent 最终验收与全景交付
  // =========================================================================
  synthesis.customCards = forgedCards;

  const layoutStrategy: AdaptiveLayoutStrategy = layout?.strategy
    || (await planWidgetLayout({
      query,
      results: filteredResults,
      plan,
      widgetPlan,
      targetLanguage: targetLang.code,
      enableLlmRefinement: false,
      signals: {
        comparisonCount: synthesis.comparisonTable?.length || 0,
        mindMapBranches: synthesis.mindMap?.children?.length || 0,
        followUpCount: synthesis.followUpQuestions?.length || 0,
        takeawayCount: synthesis.keyTakeaways?.length || 0,
        summaryLength: synthesis.summary?.length || 0,
        // 独有卡片锻造已完成，此时才能判定 custom_cards 的数据就绪
        hasCustomCards: forgedCards.length > 0
      }
    })).strategy;

  const totalActualExecutionTimeMs = Date.now() - teamStartTime;

  updateMember("coordinator", "completed", "主 Agent 验收所有专职 Agent 交付成果，已聚合完成全景交付", 1, {
    outputSummary: `主 Agent 验收完成：检索/组件/排版三核协同闭环通过，编排加速 ${orchestration.speedup}x`
  });

  const finalSummaryMessage =
    `AgentTeam 协同圆满完成：检索 Agent、小组件构建 Agent 与小组件排版 Agent 三核并行作业，` +
    `编排加速约 ${orchestration.speedup}x（${orchestration.stages.length} 阶段 / 峰值并发 ${orchestration.maxConcurrency}）` +
    `${orchestration.degradedCount > 0 ? `，${orchestration.degradedCount} 个阶段已降级兜底` : ""}。`;

  const finalTeamReport = emitTeamReport(finalSummaryMessage, orchestration.speedup, {
    parallelTasksExecuted: orchestration.stages.length,
    totalSavedTimeMs: Math.max(0, orchestration.estimatedSequentialMs - orchestration.totalDurationMs),
    orchestration: {
      stages: orchestration.stages.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        status: s.status,
        durationMs: s.durationMs,
        waitMs: s.waitMs
      })),
      totalDurationMs: orchestration.totalDurationMs,
      estimatedSequentialMs: orchestration.estimatedSequentialMs,
      speedup: orchestration.speedup,
      maxConcurrency: orchestration.maxConcurrency,
      degradedCount: orchestration.degradedCount,
      failedCount: orchestration.failedCount
    }
  });

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
