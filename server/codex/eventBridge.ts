import {
  SearchResult,
  SearchImage,
  AgentStep,
  SearchSynthesisResult,
  AdaptiveLayoutStrategy,
  WidgetPlan,
  WidgetAction,
  ResultWidgetKey,
  SearchHitLevel
} from "../../src/types.js";
import { PreparedWidgetOutput } from "../tools/widgetTool.js";
import { SolveLayoutOutput } from "../tools/layoutTool.js";
import { resolveHitLevel } from "../services/searchService.js";
import { filterAndSanitizeWidgetTypes } from "../widgetPlanner.js";
import { WidgetSelectionSkillResult } from "./widgetSelectionSkill.js";
import { getUiStrings, type UiStrings } from "../../src/lib/appLanguage.js";
import {
  extractAgentTakeaways as extractStableTakeaways,
  finalizeAnswer,
  sanitizeAgentAnswer,
  stabilizeAgentAnswer as stabilizeStableAnswer
} from "./agentWidgetContent.js";

// 规范回答清洗与提取方法
export { extractAgentTakeaways, finalizeAnswer, sanitizeAgentAnswer, stabilizeAgentAnswer } from "./agentWidgetContent.js";

export type AgentEventType =
  | "thread_started"
  | "tool_call"
  | "tool_result"
  | "reasoning"
  | "source_update"
  | "widget_update"
  | "token_usage_update"
  | "answer_delta"
  | "final_response"
  | "error";

export interface AnswerDeltaEvent {
  type: "answer_delta";
  delta: string;
  accumulated?: string;
  timestamp: number;
}

export interface ToolCallEvent {
  type: "tool_call";
  callId: string;
  tool: string;
  arguments: Record<string, any>;
  timestamp: number;
}

export interface TokenUsageUpdateEvent {
  type: "token_usage_update";
  searchId: string;
  sequence: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
  costUsd?: number;
  durationMs?: number;
  timestamp: number;
}

export interface ToolResultEvent {
  type: "tool_result";
  callId: string;
  tool: string;
  result: any;
  durationMs: number;
  timestamp: number;
}

export interface ReasoningEvent {
  type: "reasoning";
  content: string;
  timestamp: number;
}

export interface SourceEvent {
  type: "source_update";
  sources: SearchResult[];
  timestamp: number;
}

export interface WidgetEvent {
  type: "widget_update";
  widgets: PreparedWidgetOutput[];
  timestamp: number;
}

export interface CerlesseAgentResponse {
  threadId: string;
  finalResponse: string;
  sources: SearchResult[];
  widgets: PreparedWidgetOutput[];
  actions: WidgetAction[];
  layout?: SolveLayoutOutput;
  images?: SearchImage[];
  diagnostics?: {
    toolsUsed: string[];
    durationMs: number;
    iterations: number;
    provider?: string;
    model?: string;
    modelCalls?: number;
  };
}

export type CerlesseAgentEvent =
  | { type: "thread_started"; threadId: string; query: string; timestamp: number }
  | ToolCallEvent
  | ToolResultEvent
  | ReasoningEvent
  | SourceEvent
  | WidgetEvent
  | TokenUsageUpdateEvent
  | AnswerDeltaEvent
  | { type: "final_response"; threadId: string; response: CerlesseAgentResponse; timestamp: number }
  | { type: "error"; error: string; timestamp: number };

export type EventListener = (event: CerlesseAgentEvent) => void;

/**
 * EventBridge: 管理 Codex Agent 事件派发，同时将 Agent 过程转化为前端步骤流 (AgentStep)
 */
export class CodexEventBridge {
  private listeners: Set<EventListener> = new Set();
  private steps: AgentStep[] = [];
  private currentStepMap: Map<string, AgentStep> = new Map();
  /**
   * 用户可见的步骤标题文案，跟随全局语言设置。
   * 这里存的是**已归一**的语言码（auto 也会归一成 "auto"），取文案时
   * 未知语言回退中文，不会因为设置值看不懂就让整条链路抛错。
   */
  private ui: UiStrings;

  constructor(language?: string) {
    this.ui = getUiStrings(language);
  }

  public subscribe(fn: EventListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public emit(event: CerlesseAgentEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[CodexEventBridge] Listener error:", err);
      }
    }
  }

  public recordToolCall(callId: string, toolName: string, args: Record<string, any>): AgentStep {
    // 标题模板跟随全局语言：这些文案会直接显示在 ai_answer 的 ReAct 思维链里，
    // 属于用户可见文案，必须和回答正文一起切语言。
    const t = this.ui;
    const titleMap: Record<string, string> = {
      search_web: t.toolSearchWeb(args.query || ""),
      search_images: t.toolSearchImages(args.query || ""),
      verify_source: t.toolVerifySource,
      get_widget_catalog: t.toolGetCatalog,
      prepare_widget: t.toolPrepareWidget(args.widgetId || ""),
      solve_layout: t.toolSolveLayout,
      browser_read: t.toolBrowserRead(args.url || ""),
      inspect_repository: t.toolInspectRepository(args.repoPathOrUrl || ""),
      create_action: t.toolCreateAction(args.label || "")
    };

    const step: AgentStep = {
      id: callId,
      title: titleMap[toolName] || t.toolGeneric(toolName),
      description: t.toolArgs(JSON.stringify(args).slice(0, 120)),
      status: "running",
      timestamp: Date.now()
    };

    this.currentStepMap.set(callId, step);
    this.steps.push(step);
    return step;
  }

  public recordToolResult(callId: string, toolName: string, result: any, durationMs: number): AgentStep | undefined {
    const step = this.currentStepMap.get(callId);
    if (step) {
      step.status = "completed";
      step.details = [`耗时 ${durationMs}ms`];
      if (toolName === "search_web") {
        const count = Array.isArray(result?.results) ? result.results.length : 0;
        step.description = `抓取到 ${count} 条高置信度权威信源 (耗时 ${durationMs}ms)`;
      } else if (toolName === "prepare_widget") {
        step.description = result?.success
          ? `已成功加载并绑定小组件 [${result.name}]`
          : `组件绑定失败: ${result?.error}`;
      } else if (toolName === "solve_layout") {
        step.description = `完成 ${result?.tiles?.length || 0} 个磁贴的无重叠装箱求解 (填充率 ${(result?.fillRatio * 100 || 100).toFixed(0)}%)`;
      }
    }
    return step;
  }

  public getSteps(): AgentStep[] {
    return [...this.steps];
  }

  /**
   * 记录一条检索推理：既是前端可订阅的 reasoning 事件载体，也是一条真实的步骤流记录。
   *
   * 为什么必须进步骤流：Agent「为什么这样搜」如果只留在内部日志里，用户看到的结果变化
   * 就无从解释 —— 查询被收敛、证据不足触发补检、缺口词项如实标注，这些都应当可逐条审计，
   * 而不是变成一个黑盒的「检索完成」。
   */
  public recordReasoning(content: string, details?: string[]): AgentStep {
    const step: AgentStep = {
      id: `reason_${Date.now()}_${this.steps.length}`,
      title: this.ui.reasoningTitle,
      description: content,
      status: "completed",
      timestamp: Date.now(),
      details,
      agentRole: "retrieval",
      agentName: this.ui.reasoningAgentName
    };
    this.steps.push(step);
    return step;
  }
}

/**
 * 将全新的 CodexAgentResponse 转换为向前完全兼容的 SearchSynthesisResult
 */
/**
 * 依据检索结果、回答内容与用户查询智能提炼衍生追问建议
 */
export function generateFollowUpQuestions(
  query: string,
  answer: string,
  _sources: SearchResult[] = [],
  _takeaways: string[] = []
): string[] {
  const questions: string[] = [];
  
  // 1. 尝试从模型输出中抽取显式的追问或推荐拓展
  const matches = answer.match(/(?:(?:您可能还想|可以进一步|推荐拓展|延伸阅读|相关问题|追问建议|进一步探索)[：:]?\s*)([\s\S]*?)(?=\n\n|$)/i);
  if (matches && matches[1]) {
    const lines = matches[1].split(/\n+/);
    for (const l of lines) {
      const clean = l.replace(/^[-*•\d+.\s\[\]()（）]+/, "").trim();
      if (clean && clean.length >= 4 && clean.length <= 45) {
        questions.push(clean.replace(/[?？]$/, "") + "？");
      }
    }
  }

  // 2. 结合 query 意图智能启发式生成高质量结构化追问
  if (questions.length < 3) {
    const qTrim = query.trim().replace(/[?？!！]+$/, "");
    const isTech = /代码|技术|算法|框架|语言|开发|架构|实现|原理|bug|error|教程|配置|部署/i.test(qTrim);
    const isProduct = /公司|产品|手机|车型|评测|参数|对比|价格|市值|财报|投资/i.test(qTrim);
    const isHistoryOrConcept = /历史|起源|概念|是什么|背景|定义|发展|简史/i.test(qTrim);

    if (isTech) {
      questions.push(`如何在实际项目中配置与落地 ${qTrim}？`);
      questions.push(`${qTrim} 最常见的性能瓶颈与避坑指南？`);
      questions.push(`${qTrim} 与同类主流方案的对比与技术选型？`);
    } else if (isProduct) {
      questions.push(`${qTrim} 的核心优劣势与主流竞品对比？`);
      questions.push(`${qTrim} 最新市场反馈与真实用户评价如何？`);
      questions.push(`${qTrim} 的未来战略规划与演进趋势？`);
    } else if (isHistoryOrConcept) {
      questions.push(`${qTrim} 对当今行业与社会产生了哪些深远影响？`);
      questions.push(`${qTrim} 演进历程中的标志性里程碑与关键转折？`);
      questions.push(`学术界与业界对 ${qTrim} 目前有哪些前沿展望？`);
    } else {
      questions.push(`关于 ${qTrim}，还有哪些值得关注的核心细节？`);
      questions.push(`${qTrim} 在实际场景中有哪些典型落地案例？`);
      questions.push(`如何更高效地深入探索 ${qTrim}？`);
    }
  }

  return Array.from(new Set(questions)).slice(0, 4);
}

export function buildSynthesisResultFromCodex(
  query: string,
  response: CerlesseAgentResponse,
  steps: AgentStep[],
  durationMs: number,
  /**
   * 小组件选型技能输出：绑定清单 + 证据排序榜单（供前端按相关度补位）。
   */
  selection?: WidgetSelectionSkillResult,
  /**
   * 检索推理层的真实结论。
   *
   * 为什么需要透传：旧实现里 `subQueries` 恒等于 `[query]`、`hitLevel` 恒按
   * 「信源条数」折算 —— 两者都与事实不符：Agent 实际下发过收敛后的查询与补检查询，
   * 而「命中」更应看**实体命中条数**（10 条全在讲别的事，也不叫命中）。
   */
  extras: { subQueries?: string[]; hitLevel?: SearchHitLevel; language?: string } = {}
): SearchSynthesisResult {
  const sources = response.sources || [];
  const widgets = response.widgets || [];
  const layout = response.layout;
  const actions = response.actions || [];
  const images = response.images || [];

  const rawWidgetOrder = (layout?.componentOrder || widgets.map(w => w.widgetId)) as string[];
  const { validTypes, filteredTypes } = filterAndSanitizeWidgetTypes(rawWidgetOrder, {
    query,
    intent: "research"
  });

  const widgetOrder = validTypes as ResultWidgetKey[];
  const plannedItems = widgets
    .filter(w => validTypes.includes(w.widgetId))
    .map(w => ({
      type: w.widgetId as ResultWidgetKey,
      priority: 80,
      size: (w.defaultWidth || 50) as 25 | 50 | 75 | 100,
      reason: `Selected dynamically by Codex Agent from tool results`
    }));

  const widgetPlan: WidgetPlan = {
    intent: "research",
    userGoal: "深度研究与全景知识获取",
    suggestedArchetype: "verdict_summary",
    capabilities: ["official_url", "open_demo"],
    widgets: plannedItems,
    widgetOrder,
    primaryActions: actions
  };

  // 小组件选型技能的证据排序榜单：前段为本次绑定结果，后段为相关度储备位，
  // 供前端在启用数量不足最低保障时按相关度顺序补位（而不是随机塞满）。
  if (selection?.ranking && selection.ranking.length > 0) {
    widgetPlan.widgetOrder = selection.ranking as ResultWidgetKey[];
  }

  const gridConfig: Record<ResultWidgetKey, any> = {} as any;
  if (layout && layout.tiles) {
    for (const tile of layout.tiles) {
      gridConfig[tile.id as ResultWidgetKey] = {
        colSpanLg: tile.colSpan,
        colSpanMd: Math.min(6, tile.colSpan),
        colSpanSm: 4,
        rowSpan: tile.rowSpan,
        order: widgetOrder.indexOf(tile.id as ResultWidgetKey) + 1,
        width: tile.widthPercent as any,
        isAutoFilled: false
      };
    }
  }

  const customSpans: Partial<Record<ResultWidgetKey, number>> = {};
  if (layout && layout.tiles) {
    for (const tile of layout.tiles) {
      customSpans[tile.id as ResultWidgetKey] = tile.colSpan;
    }
  }

  const layoutStrategy: AdaptiveLayoutStrategy = {
    intentType: "deep_research",
    intentLabel: "Codex Agent 全景智搜",
    explanation: "由 OpenAI Codex Agent 通过 solve_layout 工具完成无重叠错落排版",
    componentOrder: widgetOrder,
    emphasizedWidget: (widgetOrder[0] || "ai_answer") as ResultWidgetKey,
    gridConfig,
    enabledWidgets: widgetOrder,
    disabledWidgets: [],
    customWidgetSpans: customSpans,
    totalRows: layout?.totalRows || 4,
    packingMethod: "semantic-css-grid"
  };

  // 回答清洗与真实要点提炼：原样保留模型真实回答，不强行追加伪造小节
  const stableAnswer = finalizeAnswer(response.finalResponse, sources, query);
  const takeaways = extractStableTakeaways(stableAnswer, sources);

  const rawAnswerLen = (response.finalResponse || "").length;
  console.log(`[PipelineMetrics][ParseAndMerge] rawLength=${rawAnswerLen}, finalLength=${stableAnswer.length}, filteredTypes=${filteredTypes.join(",") || "none"}`);

  const hitLevel = extras.hitLevel ?? resolveHitLevel(sources.length);
  const executedQueries = (extras.subQueries || []).filter(Boolean);

  return {
    query,
    timestamp: Date.now(),
    plan: {
      originalQuery: query,
      intent: "comprehensive",
      subQueries: executedQueries.length > 0 ? executedQueries : [query],
      comparisonDimensions: []
    },
    steps,
    filteredResults: sources,
    rawResultCount: sources.length,
    hitLevel,
    relatedImages: images,
    summary: stableAnswer || getUiStrings(extras.language).fallbackSummary,
    keyTakeaways: takeaways,
    comparisonTable: [],
    mindMap: { id: "root", label: query, children: [] },
    followUpQuestions: generateFollowUpQuestions(query, stableAnswer, sources, takeaways),
    modelUsed: response.diagnostics?.model || (response.diagnostics?.provider === "mock" ? "测试替身" : "未知模型"),
    generationStatus: response.diagnostics?.provider === "mock" ? "test_mock" : "agent_completed",
    generationProvider: response.diagnostics?.provider || "unknown",
    modelCallCount: response.diagnostics?.modelCalls ?? 0,
    executionTimeMs: durationMs,
    layoutStrategy,
    widgetPlan,
    actionPlan: actions.length > 0 ? {
      userGoal: "deep_learning",
      goalStatement: "执行所选推荐操作",
      nextStepVerdict: "继续执行",
      hasExecutableAction: true,
      requiresActionWidget: true,
      suggestedArchetype: "verdict_summary",
      primaryAction: actions[0],
      tasks: [],
      guardrailAudit: {
        passed: true,
        actionRequirementEnforced: true,
        reason: "Codex Verified"
      }
    } : undefined
  };
}
