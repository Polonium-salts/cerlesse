import { MANIFEST_BY_ID, WIDGET_MANIFESTS } from "../src/widgets/manifests/index.js";
import { GENERATED_EXTENSION_CATALOG } from "../src/widgets/registry/generatedCatalog.js";
import type {
  ResultWidgetKey,
  WidgetPlan,
  WidgetPlannedItem,
  AgentIntent,
  CustomCardArchetype
} from "../src/types.js";
import type { TileWidth } from "../src/lib/tileLayoutEngine.js";

/**
 * 具有对应 Manifest 与渲染模块的白名单集合
 * 涵盖静态清单与已通过校验的扩展小组件目录
 */
export const RENDERABLE_WIDGET_IDS = new Set<string>([
  ...WIDGET_MANIFESTS.map(m => m.id),
  ...GENERATED_EXTENSION_CATALOG.map(e => e.id)
]);

/**
 * 判断某个小组件类型是否具备合法 Manifest 与渲染实现
 */
export function isRenderableWidget(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const cleanId = id.trim();
  return RENDERABLE_WIDGET_IDS.has(cleanId);
}

export interface WidgetPlanFilterOptions {
  query?: string;
  intent?: string;
  userGoal?: string;
}

export interface WidgetPlanFilterResult {
  validTypes: string[];
  filteredTypes: string[];
  downgradedToAiAnswer: boolean;
  warnings: string[];
}

/**
 * 检查组件是否与核心答复/摘要等意图强相关
 */
function isIntentStronglyRelated(type: string, query?: string, intent?: string): boolean {
  const q = (query || "").toLowerCase();
  const it = (intent || "").toLowerCase();

  // 若类型名本身包含问答、摘要、定义、解释等意图语义
  const answerKeywords = [
    "answer", "overview", "synthesis", "summary", "digest",
    "explain", "concept", "verdict", "definition", "report"
  ];
  if (answerKeywords.some(kw => type.toLowerCase().includes(kw))) {
    return true;
  }

  // 若用户提问本身具有明确的研究/解释/问答意图
  if (it.includes("research") || it.includes("synthesis") || it.includes("overview")) {
    return true;
  }
  if (/(是什么|为什么|如何|原理|介绍|解释|分析|总结|what|why|how)/i.test(q)) {
    return true;
  }

  return false;
}

/**
 * 在生成 widgetPlan 前，过滤掉没有对应 manifest 与渲染模块的类型；
 * 被过滤的类型若意图强相关则降级映射为 ai_answer，并在日志中输出 warn（含类型名）。
 */
export function filterAndSanitizeWidgetTypes(
  candidateTypes: string[],
  options?: WidgetPlanFilterOptions
): WidgetPlanFilterResult {
  const validTypes: string[] = [];
  const filteredTypes: string[] = [];
  const warnings: string[] = [];
  let downgradedToAiAnswer = false;

  for (const rawType of candidateTypes) {
    const type = typeof rawType === "string" ? rawType.trim() : "";
    if (!type) continue;

    if (isRenderableWidget(type)) {
      if (!validTypes.includes(type)) {
        validTypes.push(type);
      }
    } else {
      filteredTypes.push(type);
      const isStronglyRelated = isIntentStronglyRelated(type, options?.query, options?.intent);

      if (isStronglyRelated && !validTypes.includes("ai_answer")) {
        validTypes.push("ai_answer");
        downgradedToAiAnswer = true;
        const warnMsg = `[widgetPlanner] 类型 "${type}" 没有对应 manifest 与渲染模块，已被过滤并降级映射为 ai_answer。`;
        console.warn(warnMsg);
        warnings.push(warnMsg);
      } else {
        const warnMsg = `[widgetPlanner] 类型 "${type}" 没有对应 manifest 与渲染模块，已被过滤。`;
        console.warn(warnMsg);
        warnings.push(warnMsg);
      }
    }
  }

  // 兜底保障：若所有候选均被过滤且无任何有效组件，提供基础 ai_answer 保障
  if (validTypes.length === 0) {
    validTypes.push("ai_answer");
    downgradedToAiAnswer = true;
    const warnMsg = `[widgetPlanner] 候选组件全部被过滤，自动回退到 [ai_answer]。`;
    console.warn(warnMsg);
    warnings.push(warnMsg);
  }

  return {
    validTypes,
    filteredTypes,
    downgradedToAiAnswer,
    warnings
  };
}

/**
 * 构建并校验合法的 WidgetPlan
 */
export function buildWidgetPlan(
  rawTypes: string[],
  options?: WidgetPlanFilterOptions & {
    userGoal?: string;
    suggestedArchetype?: string;
    capabilities?: string[];
    primaryActions?: any[];
  }
): WidgetPlan {
  const { validTypes } = filterAndSanitizeWidgetTypes(rawTypes, options);

  const plannedItems: WidgetPlannedItem[] = validTypes.map(type => {
    const meta = MANIFEST_BY_ID[type];
    const catalogEntry = GENERATED_EXTENSION_CATALOG.find(e => e.id === type);
    const defaultWidth = (meta?.grid?.width || catalogEntry?.layout?.defaultWidth || 50) as TileWidth;
    return {
      type: type as ResultWidgetKey,
      priority: type === "ai_answer" ? 100 : 80,
      size: defaultWidth,
      reason: `Validated and planned with registered manifest (${type})`
    };
  });

  return {
    intent: (options?.intent as AgentIntent) || "research",
    userGoal: options?.userGoal || "深度研究与知识获取",
    suggestedArchetype: (options?.suggestedArchetype as CustomCardArchetype) || "verdict_summary",
    capabilities: options?.capabilities || ["official_url", "open_demo"],
    widgets: plannedItems,
    widgetOrder: validTypes as ResultWidgetKey[],
    primaryActions: options?.primaryActions || []
  };
}
