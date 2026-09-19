import type { ResultWidgetKey, TileWidth, WidgetPlannedItem } from "../src/types.js";
import {
  WidgetDecisionSchema,
  type WidgetDecision,
  type CandidateWidget,
  type ContentSignalsPayload
} from "../src/widgets/widgetContract.js";
import { getUnifiedCatalogItem, getAllUnifiedCatalogItems } from "../src/widgets/widgetRetriever.js";
import { validateWidgetRegistryConsistency } from "../src/widgets/registry/registryHealth.js";
import { callOpenRouterChat } from "./openrouter.js";
import {
  getRouteForIntent,
  filterAllowedCandidates,
  normalizeIntent,
  isWidgetForbidden
} from "./agentRouter.js";
import {
  validateWidgetDecision,
  repairWidgetDecision,
  type ValidationContext
} from "./agentValidator.js";

export interface WidgetSelectorOptions {
  query: string;
  intent: string;
  primaryIntent?: string;
  secondaryIntents?: string[];
  requiredCapabilities?: string[];
  taskComplexity?: "simple" | "medium" | "complex";
  userGoal?: string;
  candidates: CandidateWidget[];
  signals?: ContentSignalsPayload;
  apiKey?: string;
  model?: string;
  targetLanguage?: string;
}

/**
 * 依据任务复杂度和意图数量动态计算组件预算配额
 */
export function getWidgetBudget(
  complexity: "simple" | "medium" | "complex" = "medium",
  primaryIntent: string = "general_knowledge",
  secondaryIntents: string[] = [],
  capabilityCount: number = 0
): { min: number; max: number } {
  let min = 2;
  let max = 4;
  if (complexity === "medium") {
    min = 3;
    max = 5;
  } else if (complexity === "complex") {
    min = 4;
    max = 7;
  }
  if (secondaryIntents.length >= 2) {
    max = Math.min(7, max + 1);
  }
  if (capabilityCount >= 6) {
    max = Math.min(7, max + 1);
  }
  return { min, max };
}

export interface WidgetSelectorResult {
  decision: WidgetDecision;
  plannedWidgets: WidgetPlannedItem[];
  widgetOrder: ResultWidgetKey[];
  reRankedBy: "llm_agent" | "rule_engine";
}

function enforceCatalogConsistency(
  plannedWidgets: WidgetPlannedItem[],
  widgetOrder: ResultWidgetKey[]
): { plannedWidgets: WidgetPlannedItem[]; widgetOrder: ResultWidgetKey[] } {
  const catalogKeys = getAllUnifiedCatalogItems().map(item => String(item.id));
  const missing = validateWidgetRegistryConsistency(
    widgetOrder.map(String),
    catalogKeys
  );
  if (missing.length > 0) {
    console.warn(`[WidgetSelector] 自动过滤未在 Catalog/Registry 注册的组件: ${missing.join(", ")}`);
    const catalogSet = new Set(catalogKeys);
    const validPlanned = plannedWidgets.filter(w => catalogSet.has(String(w.type)));
    const validOrder = widgetOrder.filter(k => catalogSet.has(String(k)));
    return { plannedWidgets: validPlanned, widgetOrder: validOrder };
  }
  return { plannedWidgets, widgetOrder };
}

/**
 * 确定性重排兜底引擎 (结合能力覆盖最大化与动态预算)
 */
export function deterministicReRankWidgets(
  query: string,
  intent: string,
  userGoal: string,
  candidates: CandidateWidget[],
  signals?: ContentSignalsPayload,
  contextOpts?: {
    primaryIntent?: string;
    secondaryIntents?: string[];
    requiredCapabilities?: string[];
    taskComplexity?: "simple" | "medium" | "complex";
  }
): WidgetDecision {
  const canonicalIntent = normalizeIntent(intent);
  const route = getRouteForIntent(canonicalIntent);

  const budget = getWidgetBudget(
    contextOpts?.taskComplexity || "medium",
    contextOpts?.primaryIntent || canonicalIntent,
    contextOpts?.secondaryIntents || [],
    (contextOpts?.requiredCapabilities || []).length
  );

  // 1. 硬性排除黑名单组件
  const allowedCandidates = filterAllowedCandidates(candidates, canonicalIntent);

  // 2. 依据 finalScore 降序重排
  const sorted = [...allowedCandidates].sort((a, b) => b.finalScore - a.finalScore);

  const selectedMap = new Map<string, { key: string; priority: number; size: TileWidth; reason: string; confidence: number }>();

  // 3. 优先注入必选组件 (Mandatory Widgets)
  for (const mandKey of route.mandatoryWidgets) {
    const cand = sorted.find(c => c.key === mandKey);
    const catItem = getUnifiedCatalogItem(mandKey);
    if (cand || catItem) {
      selectedMap.set(mandKey, {
        key: mandKey,
        priority: cand ? Math.round(cand.finalScore * 100) : (catItem?.basePriority ?? 95),
        size: cand?.defaultSpan || catItem?.defaultSpan || 75,
        reason: cand?.reason || `意图 [${canonicalIntent}] 核心必备组件`,
        confidence: cand ? Math.max(0.8, cand.finalScore) : 0.95
      });
    }
  }

  // 4. 动态预算补充高分与边际能力增加最强组件
  const reqCaps = new Set((contextOpts?.requiredCapabilities || []).map(c => c.toLowerCase()));

  while (selectedMap.size < budget.max) {
    const coveredCaps = new Set<string>();
    for (const key of selectedMap.keys()) {
      const item = getUnifiedCatalogItem(key);
      if (item) {
        for (const cap of item.capabilities) {
          if (reqCaps.has(cap.toLowerCase())) coveredCaps.add(cap.toLowerCase());
        }
      }
    }
    const missingCaps = new Set(Array.from(reqCaps).filter(c => !coveredCaps.has(c)));

    const unselected = sorted.filter(c => !selectedMap.has(c.key) && c.finalScore >= 0.20);
    if (unselected.length === 0) break;

    const scored = unselected.map(cand => {
      const itemCaps = cand.matchedCapabilities.map(c => c.toLowerCase());
      let gain = 0;
      for (const cap of itemCaps) {
        if (missingCaps.has(cap)) gain++;
      }
      return { cand, score: cand.finalScore + gain * 0.25 };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    if (!best || (best.score < 0.25 && selectedMap.size >= budget.min)) break;

    const c = best.cand;

    // 数据就绪检查
    if (c.key === "takeaways" && signals?.takeawayCount === 0) {
      sorted.splice(sorted.findIndex(x => x.key === c.key), 1);
      continue;
    }
    if (c.key === "image_gallery") {
      const hasImages = (signals?.imageCount ?? 0) > 0;
      const hasImageIntent = signals?.imageIntent === true;
      if (!hasImages && !hasImageIntent && !route.requiresImages) {
        sorted.splice(sorted.findIndex(x => x.key === c.key), 1);
        continue;
      }
    }

    selectedMap.set(c.key, {
      key: c.key,
      priority: Math.max(50, Math.round(c.finalScore * 100)),
      size: c.defaultSpan,
      reason: c.reason || `契合度得分 ${(c.finalScore * 100).toFixed(0)}%`,
      confidence: Math.min(1.0, Math.max(0.6, c.finalScore))
    });
  }

  // 5. 确保当前意图的核心必选组件 (Mandatory Widgets) 得到满足
  for (const mandKey of route.mandatoryWidgets) {
    if (!selectedMap.has(mandKey) && !isWidgetForbidden(mandKey, canonicalIntent)) {
      const catItem = getUnifiedCatalogItem(mandKey);
      selectedMap.set(mandKey, {
        key: mandKey,
        priority: catItem?.basePriority || 90,
        size: catItem?.defaultSpan || 50,
        reason: `意图 [${canonicalIntent}] 核心必备组件`,
        confidence: 0.95
      });
    }
  }

  // 若仍无任何组件入选，以核心速答组件兜底
  if (selectedMap.size === 0 && !isWidgetForbidden("ai_answer", canonicalIntent)) {
    selectedMap.set("ai_answer", {
      key: "ai_answer",
      priority: 95,
      size: 50,
      reason: "全网检索核心速答基底",
      confidence: 0.95
    });
  }

  const selectedWidgets = Array.from(selectedMap.values()).slice(0, budget.max);
  selectedWidgets.sort((a, b) => b.priority - a.priority);

  const initialDecision: WidgetDecision = {
    intent: canonicalIntent,
    userGoal,
    selectedWidgets
  };

  // 通过 Validator 执行最终校验与必要修补
  const validationContext: ValidationContext = {
    query,
    intent: canonicalIntent,
    primaryIntent: contextOpts?.primaryIntent,
    secondaryIntents: contextOpts?.secondaryIntents,
    requiredCapabilities: contextOpts?.requiredCapabilities,
    taskComplexity: contextOpts?.taskComplexity,
    userGoal,
    signals,
    candidates
  };
  const report = validateWidgetDecision(initialDecision, validationContext);
  if (!report.passed) {
    return repairWidgetDecision(initialDecision, validationContext, report);
  }

  return initialDecision;
}

/**
 * 格式化候选组件为富数据文本供 LLM 研判
 */
function formatCandidatesForLLM(candidates: CandidateWidget[]): string {
  return candidates.map((c, idx) => {
    return `${idx + 1}. [Key: ${c.key}] "${c.name}" (${c.category})
   - 功能描述: ${c.description}
   - 算法打分: 综合分 ${(c.finalScore * 100).toFixed(0)}% | 语义分 ${(c.semanticScore * 100).toFixed(0)}% | 意图分 ${(c.intentScore * 100).toFixed(0)}% | 能力分 ${(c.capabilityScore * 100).toFixed(0)}% | 数据就绪 ${(c.dataReadyScore * 100).toFixed(0)}%
   - 匹配原子能力: [${c.matchedCapabilities.length > 0 ? c.matchedCapabilities.join(", ") : "基础"}]
   - 推荐栅格宽度: ${c.defaultSpan}%
   - 推荐原因: ${c.reason}`;
  }).join("\n\n");
}

/**
 * Widget Selector Agent (智能选型与重排 Agent)
 * ============================================================
 * 职责：
 * 1. 结合 Router 规则白名单对 Orama 召回候选执行硬过滤 (Hard Filter)
 * 2. 向上游大模型提供完整的多维打分证据与原子能力契合证明 (LLM Decides)
 * 3. 经由 Agent Validator 进行合规校验与自动修复 (Validator Verifies & Repairs)
 * 4. 支持 MAX_RETRY = 1 的校验自愈回路
 */
export async function selectAndReRankWidgets(
  options: WidgetSelectorOptions
): Promise<WidgetSelectorResult> {
  const { query, intent, candidates, signals, apiKey, model } = options;
  const canonicalIntent = normalizeIntent(options.primaryIntent || intent);
  const secondaryIntents = options.secondaryIntents || [];
  const requiredCapabilities = options.requiredCapabilities || [];
  const taskComplexity = options.taskComplexity || "medium";
  const route = getRouteForIntent(canonicalIntent);
  const userGoal = options.userGoal || `针对 "${query}" 获取精准解答与专属交互工具`;

  const budget = getWidgetBudget(
    taskComplexity,
    canonicalIntent,
    secondaryIntents,
    requiredCapabilities.length
  );

  // 1. 硬性路由过滤：只将合法允许的候选组件送入 LLM 研判
  const allowedCandidates = filterAllowedCandidates(candidates, canonicalIntent);

  const validationContext: ValidationContext = {
    query,
    intent: canonicalIntent,
    primaryIntent: options.primaryIntent || canonicalIntent,
    secondaryIntents,
    requiredCapabilities,
    taskComplexity,
    userGoal,
    signals,
    candidates: allowedCandidates
  };

  const contextOpts = {
    primaryIntent: options.primaryIntent || canonicalIntent,
    secondaryIntents,
    requiredCapabilities,
    taskComplexity
  };

  // 若无可用候选或未配置 API Key，直接执行确定性兜底重排
  if (!allowedCandidates || allowedCandidates.length === 0 || !apiKey) {
    const fallbackDecision = deterministicReRankWidgets(query, canonicalIntent, userGoal, candidates, signals, contextOpts);
    const rawPlannedWidgets = fallbackDecision.selectedWidgets.map(w => ({
      type: w.key as ResultWidgetKey,
      priority: w.priority,
      size: w.size || 50,
      flexible: true,
      reason: w.reason
    }));
    const { plannedWidgets, widgetOrder } = enforceCatalogConsistency(
      rawPlannedWidgets,
      rawPlannedWidgets.map(w => w.type)
    );
    return {
      decision: fallbackDecision,
      plannedWidgets,
      widgetOrder,
      reRankedBy: "rule_engine"
    };
  }

  // 2. 构造具有全量打分证据的高密度 Prompt
  const candidateListStr = formatCandidatesForLLM(allowedCandidates);

  const systemPrompt = `你是一个精通组件架构与用户体验的高级选型智能体 (Widget Selector Agent)。
你的核心任务是根据用户的搜索内容、主意图 [${canonicalIntent}]、次要意图 [${secondaryIntents.join(", ") || "无"}]、以及必须覆盖的原子能力列表 [${requiredCapabilities.join(", ")}]，挑选出最契合的 ${budget.min} 到 ${budget.max} 个小组件。

【选型核心原则】
1. 能力最大化覆盖: 所选组件的组合必须达到 ≥ 85% 的原子能力覆盖率。
2. 动态预算控制: 选型数量必须控制在 ${budget.min} ~ ${budget.max} 个之间（复杂度: ${taskComplexity}）。
3. 规则约束:
   - 必须优先包含的核心组件: [${route.mandatoryWidgets.join(", ") || "无"}]
   - 硬性禁止出现的组件: [${route.forbiddenWidgets.join(", ") || "无"}]
4. 杜绝无关干扰：不要在天气/报错/翻译任务中强行塞入无关组件。
5. 输出严格的 JSON 格式，所选 key 必须来自候选池。`;

  const userPrompt = `用户查询: "${query}"
主意图: "${canonicalIntent}"
次要意图: [${secondaryIntents.join(", ")}]
所需原子能力: [${requiredCapabilities.join(", ")}]
用户目标: "${userGoal}"

【候选组件全量评分与能力清单】:
${candidateListStr}

请为当前任务裁决 ${budget.min}~${budget.max} 个最优小组件，确保覆盖率 ≥ 85%，输出严格 JSON，格式如下：
{
  "intent": "${canonicalIntent}",
  "userGoal": "${userGoal}",
  "selectedWidgets": [
    {
      "key": "候选池中的组件key",
      "priority": 95,
      "size": 50,
      "reason": "结合打分与能力覆盖的选择理由",
      "confidence": 0.95
    }
  ]
}`;

  let maxAttempts = 2; // MAX_RETRY = 1 (首次尝试 + 1 次重试)
  let currentPrompt = userPrompt;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = await callOpenRouterChat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: currentPrompt }
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
        const parseResult = WidgetDecisionSchema.safeParse(parsed);

        if (parseResult.success) {
          const decision = parseResult.data;
          const report = validateWidgetDecision(decision, validationContext);

          if (report.passed) {
            const rawPlannedWidgets = decision.selectedWidgets.map(w => ({
              type: w.key as ResultWidgetKey,
              priority: w.priority,
              size: w.size || 50,
              flexible: true,
              reason: w.reason
            }));
            const { plannedWidgets, widgetOrder } = enforceCatalogConsistency(
              rawPlannedWidgets,
              rawPlannedWidgets.map(w => w.type)
            );
            return {
              decision,
              plannedWidgets,
              widgetOrder,
              reRankedBy: "llm_agent"
            };
          } else {
            console.warn(`[WidgetSelector] Attempt ${attempt + 1} 校验未通过:`, report.violations);

            if (attempt === 0) {
              currentPrompt = `${userPrompt}\n\n【注意：上次选型存在以下违规，请立即修正】:\n${report.violations.join("\n")}\n请重新生成严格合规的 JSON 选型决策：`;
              continue;
            } else {
              const repaired = repairWidgetDecision(decision, validationContext, report);
              const rawPlannedWidgets = repaired.selectedWidgets.map(w => ({
                type: w.key as ResultWidgetKey,
                priority: w.priority,
                size: w.size || 50,
                flexible: true,
                reason: w.reason
              }));
              const { plannedWidgets, widgetOrder } = enforceCatalogConsistency(
                rawPlannedWidgets,
                rawPlannedWidgets.map(w => w.type)
              );
              return {
                decision: repaired,
                plannedWidgets,
                widgetOrder,
                reRankedBy: "llm_agent"
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[WidgetSelector] LLM 选型第 ${attempt + 1} 次尝试异常:`, err);
    }
  }

  // 所有尝试均失败，降级确定性重排兜底
  console.info("[WidgetSelector] 回退至确定性规则重排引擎");
  const fallbackDecision = deterministicReRankWidgets(query, canonicalIntent, userGoal, candidates, signals, contextOpts);
  const rawPlannedWidgets = fallbackDecision.selectedWidgets.map(w => ({
    type: w.key as ResultWidgetKey,
    priority: w.priority,
    size: w.size || 50,
    flexible: true,
    reason: w.reason
  }));
  const { plannedWidgets, widgetOrder } = enforceCatalogConsistency(
    rawPlannedWidgets,
    rawPlannedWidgets.map(w => w.type)
  );

  return {
    decision: fallbackDecision,
    plannedWidgets,
    widgetOrder,
    reRankedBy: "rule_engine"
  };
}
