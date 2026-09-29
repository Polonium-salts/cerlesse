import { z } from "zod";
import type { ResultWidgetKey, TileWidth } from "../types.js";

/**
 * 单个选定小组件决策项 Schema
 */
export const WidgetSelectionItemSchema = z.object({
  key: z.string().describe("组件唯一键名，必须来自候选池"),
  priority: z.number().min(1).max(100).describe("优先级分数 (1-100)"),
  size: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).optional().describe("建议栅格宽度占比"),
  reason: z.string().describe("选择该组件的明确业务理由与能力对口说明"),
  confidence: z.number().min(0).max(1).describe("置信度 (0-1)")
});

export type WidgetSelectionItem = z.infer<typeof WidgetSelectionItemSchema>;

/**
 * 小组件启用数量策略 (Widget Activation Count Policy)
 * ============================================================
 * 全链路唯一的「一次检索至少/至多启用多少个小组件」权威口径。
 *
 * 为什么需要它：历史上各相位各有一套数量口径（Planner 的 MAX_PLANNED_WIDGETS=10、
 * Budget 的 3~10、Validator 只校验不兜底、LayoutAgent 绝不增删），
 * 于是任何一个环节收紧都会直接表现为「桌面上的磁贴变少」，且没有任何一处会为此负责。
 *
 * 语义约定：
 *   - target    理想数量。候选池充足时，启用数应向它收敛。
 *   - min       保证数量。只要合法可上桌的候选池 ≥ min，最终启用数就必须 ≥ min。
 *   - hardFloor 资源受限硬底。候选池被意图黑名单/数据未就绪削到不足 min 时，
 *               允许下探到 hardFloor，但绝不允许低于它（除非池本身真的空了）。
 *   - max       上限。超过它要截断，避免桌面失控膨胀。
 */
export interface WidgetActivationPolicy {
  /** 理想启用数量 */
  target: number;
  /** 必须保证的最小启用数量（候选池充足时的硬约束） */
  min: number;
  /** 资源受限时允许下探的绝对底线 */
  hardFloor: number;
  /** 启用数量上限 */
  max: number;
}

export const WIDGET_ACTIVATION_POLICY: WidgetActivationPolicy = {
  target: 8,
  min: 5,
  hardFloor: 5,
  max: 10
};

/**
 * 常驻小组件 (Always-On Widgets)
 * ============================================================
 * 这三个组件都必须出现在最终清单里：
 *   · ai_answer     —— 一次搜索的核心交付物（答案本身）；
 *   · related_links —— 权威入口 / 信源跳转，让结论可被追溯与核验；
 *   · image_gallery —— 视觉图集；无图时以空态呈现"本次没有可用图片"，
 *                      而不是凭空消失（空态本身也是信息）。
 *
 * 为什么必须显式声明，而不是"把优先级调高让它自己排上去"：
 * 历史上 ai_answer / related_links 在 WIDGET_REGISTRY 里的 basePriority 只有 9 和 10，
 * 而链路中有三处会按优先级排序后截断 ——
 *   1) resolveWidgetsFromCapabilities：score = basePriority + 能力匹配分，无匹配时垫底，
 *      被 slice(0, MAX_PLANNED_WIDGETS) 切掉；
 *   2) ensureMinimumWidgetCount：按 basePriority 降序补位，但清单已满时直接 break，
 *      于是永远补不回来；
 *   3) createLayoutPlan 的兜底补位：同样按 basePriority 排序。
 * 三者叠加，表现为"AI 回答卡片与网站跳转卡片间歇性不显示"。
 *
 * 调 basePriority 是隐式魔法 —— 后续任何一处新增排序都会让它再次失效，且无处可断言。
 * 因此改为在**最终出口**无条件注入：保障可审计、可测试、且不依赖任何一处排序细节。
 */
export const ALWAYS_ON_WIDGETS: ResultWidgetKey[] = [
  "related_links",
  "ai_answer",
  "image_gallery",
  "token_usage"
];

/** 判断某组件是否为常驻组件 */
export function isAlwaysOnWidget(key: string | ResultWidgetKey): boolean {
  const normalizedKey = String(key) === "sources" ? "related_links" : String(key);
  return ALWAYS_ON_WIDGETS.some((k) => String(k) === normalizedKey);
}

/**
 * 把缺失的常驻组件注入清单，并对 sources / related_links 彻底去重，
 * 确保合并后的「信源存证与网站直达」小组件永远排在第 1 的位置。
 */
export function injectAlwaysOnWidgets(
  order: ResultWidgetKey[],
  isApplicable?: (key: ResultWidgetKey) => boolean
): ResultWidgetKey[] {
  // 1. 将 sources 归一化为 related_links，并严格去重
  const deduped: ResultWidgetKey[] = [];
  const seen = new Set<string>();
  for (const k of order) {
    const canonicalKey = (String(k) === "sources" ? "related_links" : k) as ResultWidgetKey;
    if (!seen.has(String(canonicalKey))) {
      seen.add(String(canonicalKey));
      deduped.push(canonicalKey);
    }
  }

  const present = new Set(deduped.map(String));
  const candidates = isApplicable
    ? ALWAYS_ON_WIDGETS.filter(isApplicable)
    : ALWAYS_ON_WIDGETS;
  const missing = candidates.filter((k) => !present.has(String(k)));

  const result = [...deduped];
  for (const key of missing) {
    if (key === "related_links") {
      result.unshift(key);
    } else if (key === "ai_answer") {
      const anchor = result.indexOf("related_links");
      result.splice(anchor >= 0 ? anchor + 1 : 0, 0, key);
    } else {
      result.push(key);
    }
  }

  // 2. 保证 related_links (信源存证与网站直达) 永远排在第 1 位 (index 0)
  const relatedLinksIdx = result.indexOf("related_links");
  if (relatedLinksIdx > 0) {
    result.splice(relatedLinksIdx, 1);
    result.unshift("related_links");
  } else if (relatedLinksIdx < 0) {
    result.unshift("related_links");
  }

  return result;
}

/**
 * 常驻保障的完整实现：注入缺失的常驻组件，超出上限时**只裁非常驻组件**。
 * 同时确保「信源存证与网站直达」永远稳定排在第 1 位。
 */
export function applyAlwaysOnGuarantee(
  order: ResultWidgetKey[],
  isApplicable?: (key: ResultWidgetKey) => boolean
): ResultWidgetKey[] {
  const result = injectAlwaysOnWidgets(order, isApplicable);
  const alwaysSet = new Set(ALWAYS_ON_WIDGETS.map(String));

  // 超出上限时从尾部往前裁非常驻组件；常驻永远保留
  while (result.length > WIDGET_ACTIVATION_POLICY.max) {
    let cutIndex = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (!alwaysSet.has(String(result[i]))) {
        cutIndex = i;
        break;
      }
    }
    if (cutIndex < 0) break; // 已全部是常驻，无可再裁
    result.splice(cutIndex, 1);
  }

  // 再次确保第 1 位始终为 related_links
  const firstIdx = result.indexOf("related_links");
  if (firstIdx > 0) {
    result.splice(firstIdx, 1);
    result.unshift("related_links");
  }

  return result;
}

/**
 * 依据候选池规模解析本次应当达成的启用数量目标。
 *
 * 保证「目标可达成」：目标数永远不超过真实可上桌的候选池规模，
 * 避免下游为了满足一个不可能达成的数字而塞入无关或空壳组件。
 */
export function resolveActivationTargets(eligiblePoolSize: number): {
  target: number;
  min: number;
  hardFloor: number;
  max: number;
  /** 候选池被削得比硬底还少时为 true，此时只能尽力而为 */
  poolStarved: boolean;
} {
  const { target, min, hardFloor, max } = WIDGET_ACTIVATION_POLICY;
  const pool = Math.max(0, Math.floor(eligiblePoolSize));

  return {
    target: Math.min(target, pool),
    min: Math.min(min, pool),
    hardFloor: Math.min(hardFloor, pool),
    max: Math.min(max, Math.max(pool, min)),
    poolStarved: pool < min
  };
}

/**
 * 单次启用的最终验收：是否达到最低保障线。
 * 判定标准（同时也是本修复是否生效的验收口径）：
 *   1. 候选池充足 (pool ≥ min) 时：activated 必须 ≥ min，否则视为不达标；
 *   2. 候选池不足 (pool < min) 时：activated 必须 ≥ hardFloor（或已用尽整个池）。
 */
export function isActivationSatisfied(
  activated: number,
  eligiblePoolSize: number
): { satisfied: boolean; required: number; shortfall: number } {
  const targets = resolveActivationTargets(eligiblePoolSize);
  const required = targets.poolStarved ? targets.hardFloor : targets.min;
  const shortfall = Math.max(0, required - activated);
  return { satisfied: shortfall === 0, required, shortfall };
}

/**
 * 依据任务复杂度和意图数量动态计算组件预算配额 (统一权威 Policy)
 *
 * 预算下限统一抬高到 WIDGET_ACTIVATION_POLICY.min，
 * 使「预算」与「启用数量保障」不再是两套互相打架的口径。
 */
export function getWidgetBudget(
  complexity: "simple" | "medium" | "complex" = "medium",
  primaryIntent: string = "general_knowledge",
  secondaryIntents: string[] = [],
  capabilityCount: number = 0
): { min: number; max: number } {
  const { min: policyMin, max: policyMax } = WIDGET_ACTIVATION_POLICY;

  let min = policyMin;
  let max = policyMax;
  if (complexity === "simple") {
    // 简单任务同样遵守每次至少启用 5 个小组件的要求
    min = policyMin;
    max = 8;
  } else if (complexity === "medium") {
    min = policyMin;
    max = policyMax;
  } else if (complexity === "complex") {
    min = Math.max(policyMin, 7);
    max = policyMax;
  }
  if (secondaryIntents.length >= 2) {
    max = Math.min(policyMax, max + 1);
  }
  if (capabilityCount >= 6) {
    max = Math.min(policyMax, max + 1);
  }
  return { min, max };
}

/**
 * 单次启用结果的可观测摘要（供日志、前端状态条与测试断言消费）
 */
export interface WidgetActivationSummary {
  /** 最终启用数量 */
  activated: number;
  /** 本次目标数量 */
  target: number;
  /** 本次必须达到的最小数量 */
  min: number;
  /** Orama 召回后的候选池规模 */
  candidatePool: number;
  /** 经过路由白名单/黑名单与数据就绪过滤后真正可上桌的池规模 */
  eligiblePool: number;
  /** 距离最低保障线还差几个（0 表示达标） */
  shortfall: number;
  /** 是否达标 */
  satisfied: boolean;
  /** 由哪条链路产出最终清单 */
  selector: "llm_agent" | "rule_engine" | "capability_fallback" | "planner_guard";
  /** 归一化后的意图 */
  intent: string;
  /** 由数量保障阀补入的组件（用于审计"是不是靠兜底凑数"） */
  addedByFloorGuard: string[];
  /** 补充说明 */
  notes: string[];
}

/**
 * 输出一行人类可读的启用摘要日志
 */
export function logWidgetActivationSummary(
  scope: string,
  summary: WidgetActivationSummary
): void {
  const flag = summary.satisfied ? "OK " : "WARN";
  const guard = summary.addedByFloorGuard.length > 0
    ? ` | 兜底补入: [${summary.addedByFloorGuard.join(", ")}]`
    : "";
  const notes = summary.notes.length > 0 ? ` | ${summary.notes.join(" · ")}` : "";

  console.info(
    `[${scope}] ${flag} 启用 ${summary.activated}/${summary.target} (最低 ${summary.min})` +
    ` | 候选池 ${summary.candidatePool} -> 可上桌 ${summary.eligiblePool}` +
    ` | 意图 ${summary.intent} | 链路 ${summary.selector}` +
    (summary.shortfall > 0 ? ` | 缺口 ${summary.shortfall}` : "") +
    guard + notes
  );
}

/**
 * 动态创建针对特定 Budget (min ~ max) 的 WidgetDecisionSchema
 */
export function createWidgetDecisionSchema(min: number = 5, max: number = 10) {
  const boundedMin = Math.max(WIDGET_ACTIVATION_POLICY.min, Math.min(min, WIDGET_ACTIVATION_POLICY.max));
  const boundedMax = Math.max(boundedMin, Math.min(max, WIDGET_ACTIVATION_POLICY.max));

  return z.object({
    intent: z.string().describe("识别出的用户核心意图类型"),
    userGoal: z.string().describe("简要陈述用户当前检索的目标"),
    selectedWidgets: z.array(WidgetSelectionItemSchema)
      .min(boundedMin)
      .max(boundedMax)
      .describe(`选定的 ${boundedMin}~${boundedMax} 个高对口组件列表`)
  });
}

/**
 * 小组件选型决策单 Schema (Zod 契约约束，标准通用模式)
 */
export const WidgetDecisionSchema = z.object({
  intent: z.string().describe("识别出的用户核心意图类型"),
  userGoal: z.string().describe("简要陈述用户当前检索的目标"),
  selectedWidgets: z.array(WidgetSelectionItemSchema).min(5).max(10).describe("每次检索从注册表中选定 5~10 个高对口组件")
});

export type WidgetDecision = z.infer<typeof WidgetDecisionSchema>;

/**
 * 候选小组件实体描述（供 Orama 语义召回与 Selector Agent 消费）
 */
export interface CandidateWidget {
  key: ResultWidgetKey;
  name: string;
  description: string;
  category: "synthesis" | "action" | "portal" | "analysis" | "custom";
  capabilities: string[];
  intents: string[];
  semanticScore: number;
  intentScore: number;
  capabilityScore: number;
  dataReadyScore: number;
  exampleMatchScore: number;
  finalScore: number;
  defaultSpan: TileWidth;
  matchedCapabilities: string[];
  reason: string;
}

/**
 * 数据就绪信号载荷
 */
export interface ContentSignalsPayload {
  summaryLength?: number;
  takeawayCount?: number;
  sourceCount?: number;
  comparisonRows?: number;
  mindMapBranches?: number;
  followUpCount?: number;
  hasOfficial?: boolean;
  customCardCount?: number;
  imageCount?: number;
  imageIntent?: boolean;
  hasMultipleEntities?: boolean;
  hasCodeSnippet?: boolean;
  hasInstallCommand?: boolean;
}
