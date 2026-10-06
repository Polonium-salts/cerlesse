import type { AgentStep, AgentStepStatus } from "../types.js";
import { getUiStrings } from "./appLanguage.js";

/**
 * 投影时用到的兜底标题。这些只在步骤缺少 title 时出现，
 * 属于用户可见文案，同样要跟随全局语言。
 */
function fallbackTitles(language?: string) {
  const t = getUiStrings(language);
  return {
    reasoning: t.reasoningTitle,
    tool: t.toolGenericFallback,
    readOk: t.readResult,
    readError: t.readFailed
  };
}

/**
 * ReAct-Read 循环思维链 (ReAct-Read Chain of Thought)
 * ========================================================================
 * 把 Agent 执行过程中真实产生的 `AgentStep[]`，投影成一条可视的
 * `Thought → Act → Read` 循环链路。
 *
 * 为什么需要这一层投影，而不是直接把 steps 丢给 UI：
 *   `AgentStep` 是「执行日志」语义 —— 一次工具调用被 `recordToolCall`
 *   压入后又由 `recordToolResult` 就地改写为 completed。也就是说，
 *   单个 step 同时承载了「Act（发起调用）」与「Read（读回结果）」两个阶段，
 *   直接渲染会让 ReAct 循环塌缩成一条平铺列表，看不出回合结构。
 *
 * 因此这里做的是纯函数投影：既不新增第二套 Agent 循环（严守 AGENTS.md
 * 「Never reintroduce a second agent loop」），也不让模型自己编造思考链，
 * 只是把 eventBridge 记录的真实步骤重排成可读的循环形态。
 * 每一个节点都能追溯回一条真实的 step，不存在凭空生成的「思考」。
 */

export type ReActPhaseKind = "thought" | "act" | "read";

export interface ReActTraceNode {
  /** 稳定 id：与来源 step 一一对应，便于流式更新时做 key 复用 */
  id: string;
  kind: ReActPhaseKind;
  title: string;
  detail?: string;
  status: AgentStepStatus;
  timestamp: number;
  details?: string[];
}

/** 一步工具调用所对应的完整 Act→Read 回合 */
export interface ReActRound {
  id: string;
  toolTitle: string;
  act: ReActTraceNode;
  read?: ReActTraceNode;
  status: AgentStepStatus;
  timestamp: number;
  /** 该回合是否仍在执行（Act 已发起、Read 尚未回来） */
  inFlight: boolean;
}

export interface ReActTrace {
  /** 检索推理层的思考节点（检索式收敛、证据缺口判断等） */
  thoughts: ReActTraceNode[];
  /** 工具调用回合，按真实发生顺序 */
  rounds: ReActRound[];
  /** 展平后的完整链路，供时间线直接渲染 */
  nodes: ReActTraceNode[];
  thoughtCount: number;
  actCount: number;
  readCount: number;
  /** 是否存在进行中的回合（用于流式呼吸态） */
  isRunning: boolean;
  /** 是否为完全空链路（无任何真实执行痕迹） */
  isEmpty: boolean;
}

/**
 * 判定一个 step 是否属于「检索推理」而非「工具调用」。
 *
 * eventBridge 有两条写入路径：
 *   - recordToolCall/recordToolResult：以 callId 为 id，写入 currentStepMap
 *   - recordReasoning：以 `reason_` 前缀 + agentRole "retrieval" 写入
 * 这里同时用两条特征判定，避免只依赖单一字段在历史数据上失效。
 */
function isReasoningStep(step: AgentStep): boolean {
  return step.agentRole === "retrieval" || String(step.id || "").startsWith("reason_");
}

/**
 * `recordToolCall` 会先把 description 写成 `参数: {...}`，而 `recordToolResult`
 * 只对 search_web / prepare_widget / solve_layout 三个工具把它改写为可读的观测结论。
 * 对其余工具（verify_source / search_images / get_widget_catalog 等），description
 * 仍然是参数回显。
 *
 * 于是必须区分「这段文字是调用参数」还是「这段文字是观测结论」：
 * 把 `参数: {...}` 当作 Read 节点展示，等于拿入参冒充检索结果，
 * 既不真实，也会让推理链看起来比实际更“有料”。
 */
/**
 * 调用参数回显的识别前缀。
 *
 * 必须同时匹配中英两种写法：eventBridge 的参数前缀随全局语言切换
 * （中文 `参数: {...}` / 英文 `Args: {...}`）。只认中文的话，
 * 切到英文后参数回显就会被当成观测结论展示 —— 正是这个函数要防的事。
 */
const ARGS_ECHO_PATTERN = /^(?:参数|Args)\s*[:：]/i;

/**
 * 将真实执行步骤投影为 ReAct-Read 循环。
 * 纯函数：相同输入必然得到相同输出，可单测、可回放。
 */
export function buildReActTrace(steps: AgentStep[] | undefined | null, language?: string): ReActTrace {
  const safeSteps = Array.isArray(steps) ? steps : [];
  const fb = fallbackTitles(language);

  const thoughts: ReActTraceNode[] = [];
  const rounds: ReActRound[] = [];

  for (const step of safeSteps) {
    if (!step || typeof step !== "object") continue;

    if (isReasoningStep(step)) {
      thoughts.push({
        id: step.id,
        kind: "thought",
        title: step.title || fb.reasoning,
        detail: step.description,
        status: step.status,
        timestamp: step.timestamp,
        details: step.details
      });
      continue;
    }

    const description = step.description || "";
    const descriptionIsArgs = ARGS_ECHO_PATTERN.test(description);

    // Act：展示「做了什么」。真实参数仍在时展示参数；参数已被观测结论
    // 覆盖（search_web 等）时不编造，动作信息已由 title 承载。
    const act: ReActTraceNode = {
      id: `${step.id}::act`,
      kind: "act",
      title: step.title || fb.tool,
      detail: descriptionIsArgs ? description : undefined,
      status: step.status === "running" || step.status === "pending" ? step.status : "completed",
      timestamp: step.timestamp
    };

    // Read：只展示「读回了什么」。若 description 仍是参数回显，
    // 说明 recordToolResult 没有产出观测结论 —— 此时绝不把入参当作结果，
    // 改用真实记录到的执行详情（耗时等）；连这些都没有就留空，
    // 由 UI 呈现出「已执行但无可展示的观测内容」。
    const readDetail = descriptionIsArgs
      ? (step.details && step.details.length > 0 ? step.details.join(" · ") : undefined)
      : (description || undefined);

    const read: ReActTraceNode | undefined =
      step.status === "completed" || step.status === "error"
        ? {
            id: `${step.id}::read`,
            kind: "read",
            title: step.status === "error" ? fb.readError : fb.readOk,
            detail: readDetail,
            status: step.status,
            timestamp: step.timestamp,
            details: step.details
          }
        : undefined;

    rounds.push({
      id: step.id,
      toolTitle: step.title || fb.tool,
      act,
      read,
      status: step.status,
      timestamp: step.timestamp,
      inFlight: step.status === "running" || step.status === "pending"
    });
  }

  const nodes: ReActTraceNode[] = [
    ...thoughts,
    ...rounds.flatMap((r) => (r.read ? [r.act, r.read] : [r.act]))
  ].sort((a, b) => a.timestamp - b.timestamp);

  return {
    thoughts,
    rounds,
    nodes,
    thoughtCount: thoughts.length,
    actCount: rounds.length,
    readCount: rounds.filter((r) => Boolean(r.read)).length,
    isRunning: rounds.some((r) => r.inFlight),
    isEmpty: nodes.length === 0
  };
}

/**
 * 生成折叠态的一行摘要，例如「思考 2 步 · 调用 3 次工具 · 读回 3 次」。
 * language 缺省（auto）时输出中文，与全局语言设置为 auto 时的行为一致。
 */
export function formatReActSummary(trace: ReActTrace, language?: string): string {
  const t = getUiStrings(language);
  if (trace.isEmpty) return t.reactEmpty;
  const parts: string[] = [];
  if (trace.thoughtCount > 0) parts.push(t.reactThought(trace.thoughtCount));
  if (trace.actCount > 0) parts.push(t.reactAct(trace.actCount));
  if (trace.readCount > 0) parts.push(t.reactRead(trace.readCount));
  return parts.join(" · ");
}
