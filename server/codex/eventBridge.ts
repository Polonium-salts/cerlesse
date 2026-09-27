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
import { WidgetSelectionSkillResult } from "./widgetSelectionSkill.js";
import {
  extractAgentTakeaways as extractStableTakeaways,
  stabilizeAgentAnswer as stabilizeStableAnswer
} from "./agentWidgetContent.js";

// 回答稳定化 / 要点提取的唯一实现在 agentWidgetContent.ts（含单测），
// 这里只做兼容转发，避免同一份规则在两处各写一遍而逐渐分叉。
export { extractAgentTakeaways, stabilizeAgentAnswer } from "./agentWidgetContent.js";

export type AgentEventType =
  | "thread_started"
  | "tool_call"
  | "tool_result"
  | "reasoning"
  | "source_update"
  | "widget_update"
  | "final_response"
  | "error";

export interface ToolCallEvent {
  type: "tool_call";
  callId: string;
  tool: string;
  arguments: Record<string, any>;
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
    const titleMap: Record<string, string> = {
      search_web: `检索网络：${args.query || ""}`,
      search_images: `检索配图：${args.query || ""}`,
      verify_source: `核验信源权威度与域安全`,
      get_widget_catalog: `拉取组件注册中心完整目录`,
      prepare_widget: `绑定交付小组件：${args.widgetId || ""}`,
      solve_layout: `装箱排版：计算 12 栅格最优错落布局`,
      browser_read: `深度阅读页面：${args.url || ""}`,
      inspect_repository: `检查开源仓库状态：${args.repoPathOrUrl || ""}`,
      create_action: `生成可执行操作卡片：${args.label || ""}`
    };

    const step: AgentStep = {
      id: callId,
      title: titleMap[toolName] || `调用能力工具 [${toolName}]`,
      description: `参数: ${JSON.stringify(args).slice(0, 120)}`,
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
      title: "检索推理",
      description: content,
      status: "completed",
      timestamp: Date.now(),
      details,
      agentRole: "retrieval",
      agentName: "检索推理层"
    };
    this.steps.push(step);
    return step;
  }
}

/**
 * 将全新的 CodexAgentResponse 转换为向前完全兼容的 SearchSynthesisResult
 */
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
  extras: { subQueries?: string[]; hitLevel?: SearchHitLevel } = {}
): SearchSynthesisResult {
  const sources = response.sources || [];
  const widgets = response.widgets || [];
  const layout = response.layout;
  const actions = response.actions || [];
  const images = response.images || [];

  const widgetOrder = (layout?.componentOrder || widgets.map(w => w.widgetId)) as ResultWidgetKey[];
  const plannedItems = widgets.map(w => ({
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

  // 回答稳定化与要点提取都走 agentWidgetContent：模型作答过于简略或只回一句占位语时，
  // 仍能得到有信源支撑的结构化答案与要点，避免 takeaways 卡片被前端网关整卡砍掉。
  const stableAnswer = stabilizeStableAnswer(query, response.finalResponse, sources);
  const takeaways = extractStableTakeaways(stableAnswer, sources);

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
    summary: stableAnswer || "已完成检索并生成回答。",
    keyTakeaways: takeaways,
    comparisonTable: [],
    mindMap: { id: "root", label: query, children: [] },
    followUpQuestions: [],
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
