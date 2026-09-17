import { z } from "zod";
import type { ResultWidgetKey, TileWidth, WidgetPlannedItem } from "../src/types.js";
import {
  WidgetDecisionSchema,
  type WidgetDecision,
  type CandidateWidget,
  type ContentSignalsPayload
} from "../src/widgets/widgetContract.js";
import { WIDGET_CATALOG } from "../src/widgets/widgetRetriever.js";
import { callOpenRouterChat } from "./openrouter.js";

export interface WidgetSelectorOptions {
  query: string;
  intent: string;
  userGoal?: string;
  candidates: CandidateWidget[];
  signals?: ContentSignalsPayload;
  apiKey?: string;
  model?: string;
  targetLanguage?: string;
}

export interface WidgetSelectorResult {
  decision: WidgetDecision;
  plannedWidgets: WidgetPlannedItem[];
  widgetOrder: ResultWidgetKey[];
  reRankedBy: "llm_agent" | "rule_engine";
}

/**
 * 校验并规范化 Selector 的决策结果 (Zod + 目录 + 数据可用性校验)
 */
export function validateWidgetDecision(
  rawDecision: unknown,
  candidates: CandidateWidget[],
  signals?: ContentSignalsPayload
): { valid: boolean; decision: WidgetDecision | null; errors: string[] } {
  const errors: string[] = [];
  const parseResult = WidgetDecisionSchema.safeParse(rawDecision);

  if (!parseResult.success) {
    return {
      valid: false,
      decision: null,
      errors: parseResult.error.issues.map(e => `${e.path.join(".")}: ${e.message}`)
    };
  }

  const decision = parseResult.data;
  const candidateKeys = new Set(candidates.map(c => c.key));
  const seenKeys = new Set<string>();
  const sanitizedWidgets = [];

  for (const item of decision.selectedWidgets) {
    const key = item.key as ResultWidgetKey;
    // 1. 存在性校验：必须在合法 WIDGET_CATALOG 中
    if (!WIDGET_CATALOG[key]) {
      errors.push(`未知组件 key: "${key}"，已剔除`);
      continue;
    }

    // 2. 去重校验
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    // 3. 数据可用性校验：防止空壳磁贴 (图片组件保持常驻启用)
    if (key === "takeaways" && (signals?.takeawayCount ?? 0) === 0) {
      errors.push("takeaways 缺少要点数据，已阻断");
      continue;
    }

    sanitizedWidgets.push({
      ...item,
      key,
      size: item.size || WIDGET_CATALOG[key].defaultSpan
    });
  }

  // 保证用户指令：图片小组件保持启用
  if (!sanitizedWidgets.some(w => w.key === "image_gallery")) {
    sanitizedWidgets.push({
      key: "image_gallery",
      priority: 74,
      size: 75,
      reason: "全网检索图片素材与视觉图集",
      confidence: 0.9
    });
  }

  if (sanitizedWidgets.length === 0) {
    return { valid: false, decision: null, errors: ["校验后无有效组件保留"] };
  }

  return {
    valid: true,
    decision: {
      ...decision,
      selectedWidgets: sanitizedWidgets
    },
    errors
  };
}

/**
 * 确定性重排兜底引擎 (基于 Orama 打分与多信号融合的确定性排序)
 */
export function deterministicReRankWidgets(
  query: string,
  intent: string,
  userGoal: string,
  candidates: CandidateWidget[],
  signals?: ContentSignalsPayload
): WidgetDecision {
  // 过滤得分过低或明显不相关的组件
  const eligible = candidates.filter(c => c.finalScore >= 0.20);
  const selectedCandidates = eligible.length >= 2 ? eligible.slice(0, 5) : candidates.slice(0, 3);

  const selectedWidgets = selectedCandidates.map((c, index) => {
    // 优先级阶梯递减：第 1 名 95，随后依次递减
    const priority = Math.max(60, 95 - index * 8);
    const catalogItem = WIDGET_CATALOG[c.key];
    const size: TileWidth = catalogItem ? catalogItem.defaultSpan : 50;

    return {
      key: c.key,
      priority,
      size,
      reason: c.reason || `契合度得分 ${(c.finalScore * 100).toFixed(0)}%`,
      confidence: Math.min(1.0, Math.max(0.6, c.finalScore))
    };
  });

  // 保证图片小组件始终保持启用
  if (!selectedWidgets.some(w => w.key === "image_gallery")) {
    selectedWidgets.push({
      key: "image_gallery",
      priority: 74,
      size: 75,
      reason: "全网检索图片素材与视觉图集",
      confidence: 0.85
    });
  }

  return {
    intent,
    userGoal,
    selectedWidgets
  };
}

/**
 * Widget Selector Agent (智能选型与重排 Agent)
 * ============================================================
 * 职责：从 Orama 召回的 Top 候选组件中，综合检索上下文选出最优的 3~5 个小组件
 */
export async function selectAndReRankWidgets(
  options: WidgetSelectorOptions
): Promise<WidgetSelectorResult> {
  const { query, intent, candidates, signals, apiKey, model, targetLanguage } = options;
  const userGoal = options.userGoal || `针对 "${query}" 获取精准回答与相关业务工具`;

  // 若无可用候选直接使用确定性兜底
  if (!candidates || candidates.length === 0) {
    const fallbackDecision = deterministicReRankWidgets(query, intent, userGoal, candidates, signals);
    const plannedWidgets = fallbackDecision.selectedWidgets.map(w => ({
      type: w.key as ResultWidgetKey,
      priority: w.priority,
      size: w.size || 50,
      flexible: true,
      reason: w.reason
    }));
    return {
      decision: fallbackDecision,
      plannedWidgets,
      widgetOrder: plannedWidgets.map(w => w.type),
      reRankedBy: "rule_engine"
    };
  }

  // 若提供了 API Key，则使用大模型进行深度语义重排与裁决
  if (apiKey) {
    try {
      const candidateListStr = candidates.map((c, idx) => 
        `${idx + 1}. key="${c.key}" (${c.name}): ${c.description} [类别: ${c.category}, 语义相关分: ${(c.semanticScore * 100).toFixed(0)}%, 建议宽度: ${c.defaultSpan}%]`
      ).join("\n");

      const systemPrompt = `你是一个严谨专业的小组件选型与重排 Agent (Widget Selector Agent)。
你的核心任务是根据用户的搜索内容、核心意图以及 Orama 语义检索引擎初筛出的候选组件池，精选出最适合呈现在结果页的 2 到 5 个核心小组件。

选型铁律：
1. 绝对不要在所有任务上都塞相同的无关组件（例如天气查询绝不要放翻译或通用代码库；代码报错绝不要放天气或旅行图集）。
2. 从候选池中挑选最对口、能真正帮助用户解决问题的组件。
3. 必须输出合法且严格符合 Schema 的 JSON。
4. 选出的组件 key 必须来自给定的候选池，不得臆造任何不存在的 key。`;

      const userPrompt = `用户查询: "${query}"
核心意图: "${intent}"
用户目标: "${userGoal}"

Orama 语义召回的候选组件列表:
${candidateListStr}

请为当前任务精选 2~5 个最合适的小组件，并为每个组件给出 1-100 的优先级分数（最核心的 90-100）、推荐宽度占比（25/50/75/100）及明确理由。
仅输出 JSON，结构如下：
{
  "intent": "${intent}",
  "userGoal": "${userGoal}",
  "selectedWidgets": [
    {
      "key": "组件key",
      "priority": 95,
      "size": 50,
      "reason": "推荐该组件的业务原因",
      "confidence": 0.95
    }
  ]
}`;

      const raw = await callOpenRouterChat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model,
        apiKey,
        responseFormatJson: true,
        timeoutMs: 2500,
        temperature: 0.1,
        maxTokens: 600
      });

      if (raw) {
        const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const validation = validateWidgetDecision(parsed, candidates, signals);

        if (validation.valid && validation.decision) {
          const plannedWidgets = validation.decision.selectedWidgets.map(w => ({
            type: w.key as ResultWidgetKey,
            priority: w.priority,
            size: w.size || 50,
            flexible: true,
            reason: w.reason
          }));
          return {
            decision: validation.decision,
            plannedWidgets,
            widgetOrder: plannedWidgets.map(w => w.type),
            reRankedBy: "llm_agent"
          };
        } else {
          console.warn("[WidgetSelector] LLM 选型结果未通过校验，回退确定性重排:", validation.errors);
        }
      }
    } catch (err) {
      console.warn("[WidgetSelector] LLM 选型异常，回退确定性重排:", err);
    }
  }

  // 确定性重排兜底
  const decision = deterministicReRankWidgets(query, intent, userGoal, candidates, signals);
  const plannedWidgets = decision.selectedWidgets.map(w => ({
    type: w.key as ResultWidgetKey,
    priority: w.priority,
    size: w.size || 50,
    flexible: true,
    reason: w.reason
  }));
  return {
    decision,
    plannedWidgets,
    widgetOrder: plannedWidgets.map(w => w.type),
    reRankedBy: "rule_engine"
  };
}
