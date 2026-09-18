import type { ResultWidgetKey, TileWidth, WidgetPlannedItem } from "../src/types.js";
import {
  WidgetDecisionSchema,
  type WidgetDecision,
  type CandidateWidget,
  type ContentSignalsPayload
} from "../src/widgets/widgetContract.js";
import { getUnifiedCatalogItem } from "../src/widgets/widgetRetriever.js";
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
 * 确定性重排兜底引擎 (基于 Agent Router + Orama 综合分数的确定性排序)
 */
export function deterministicReRankWidgets(
  query: string,
  intent: string,
  userGoal: string,
  candidates: CandidateWidget[],
  signals?: ContentSignalsPayload
): WidgetDecision {
  const canonicalIntent = normalizeIntent(intent);
  const route = getRouteForIntent(canonicalIntent);

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

  // 4. 补充高分候选组件 (排除已选和低于阈值的项)
  for (const c of sorted) {
    if (selectedMap.size >= 4) break;
    if (selectedMap.has(c.key)) continue;
    if (c.finalScore < 0.25) continue;

    // 数据就绪检查
    if (c.key === "takeaways" && signals?.takeawayCount === 0) continue;
    if (c.key === "image_gallery") {
      const hasImages = (signals?.imageCount ?? 0) > 0;
      const hasImageIntent = signals?.imageIntent === true;
      if (!hasImages && !hasImageIntent && !route.requiresImages) continue;
    }

    selectedMap.set(c.key, {
      key: c.key,
      priority: Math.max(50, Math.round(c.finalScore * 100)),
      size: c.defaultSpan,
      reason: c.reason || `契合度得分 ${(c.finalScore * 100).toFixed(0)}%`,
      confidence: Math.min(1.0, Math.max(0.6, c.finalScore))
    });
  }

  // 5. 确保三大基底 (ai_answer, related_links, sources) 稳定存在
  if (!selectedMap.has("ai_answer") && !isWidgetForbidden("ai_answer", canonicalIntent)) {
    selectedMap.set("ai_answer", {
      key: "ai_answer",
      priority: 95,
      size: 50,
      reason: "全网检索核心速答基底",
      confidence: 0.95
    });
  }
  if (!selectedMap.has("related_links") && !isWidgetForbidden("related_links", canonicalIntent)) {
    selectedMap.set("related_links", {
      key: "related_links",
      priority: 90,
      size: 50,
      reason: "官方认证入口与导航直达",
      confidence: 0.9
    });
  }
  if (!selectedMap.has("sources") && !isWidgetForbidden("sources", canonicalIntent)) {
    selectedMap.set("sources", {
      key: "sources",
      priority: 85,
      size: 50,
      reason: "权威信源存证与文献引用",
      confidence: 0.85
    });
  }

  const selectedWidgets = Array.from(selectedMap.values()).slice(0, 6);
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
  const canonicalIntent = normalizeIntent(intent);
  const route = getRouteForIntent(canonicalIntent);
  const userGoal = options.userGoal || `针对 "${query}" 获取精准解答与专属交互工具`;

  // 1. 硬性路由过滤：只将合法允许的候选组件送入 LLM 研判
  const allowedCandidates = filterAllowedCandidates(candidates, canonicalIntent);

  const validationContext: ValidationContext = {
    query,
    intent: canonicalIntent,
    userGoal,
    signals,
    candidates: allowedCandidates
  };

  // 若无可用候选或未配置 API Key，直接执行确定性兜底重排
  if (!allowedCandidates || allowedCandidates.length === 0 || !apiKey) {
    const fallbackDecision = deterministicReRankWidgets(query, canonicalIntent, userGoal, candidates, signals);
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

  // 2. 构造具有全量打分证据的高密度 Prompt
  const candidateListStr = formatCandidatesForLLM(allowedCandidates);

  const systemPrompt = `你是一个精通组件架构与用户体验的高级选型智能体 (Widget Selector Agent)。
你的核心任务是根据用户的搜索内容、真实意图、以及算法打分系统计算出的全量指标，挑选出最契合、最能解决用户痛点的 2 到 5 个小组件。

【架构原则】
1. 规则约束：本次任务意图为 [${canonicalIntent}]。
   - 必须优先包含的核心组件: [${route.mandatoryWidgets.join(", ") || "无"}]
   - 硬性禁止出现的组件: [${route.forbiddenWidgets.join(", ") || "无"}]
2. 证据导向：综合分 (FinalScore)、原子能力匹配 (Matched Capabilities) 和数据就绪度代表了算法评估事实，请依据这些证据进行理性裁决。
3. 杜绝无关干扰：不要在天气/报错/翻译任务中强行塞入无关组件（如天气任务严禁放翻译或排错；排错任务严禁放天气或图片库）。
4. 输出严格的 JSON 格式，所选 key 必须来自候选池。`;

  const userPrompt = `用户查询: "${query}"
规范意图: "${canonicalIntent}"
用户目标: "${userGoal}"

【候选组件全量评分与能力清单】:
${candidateListStr}

请为当前任务裁决 2~5 个最优小组件，输出严格 JSON，格式如下：
{
  "intent": "${canonicalIntent}",
  "userGoal": "${userGoal}",
  "selectedWidgets": [
    {
      "key": "候选池中的组件key",
      "priority": 95,
      "size": 50,
      "reason": "结合打分与任务诉求的选择理由",
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
              reRankedBy: "llm_agent"
            };
          } else {
            console.warn(`[WidgetSelector] Attempt ${attempt + 1} 校验未通过:`, report.violations);

            // 若仍有重试机会，组装错误信息重新提示
            if (attempt === 0) {
              currentPrompt = `${userPrompt}\n\n【注意：上次选型存在以下违规，请立即修正】:\n${report.violations.join("\n")}\n请重新生成严格合规的 JSON 选型决策：`;
              continue;
            } else {
              // 重试后仍有瑕疵，使用 Validator 自动修复
              const repaired = repairWidgetDecision(decision, validationContext, report);
              const plannedWidgets = repaired.selectedWidgets.map(w => ({
                type: w.key as ResultWidgetKey,
                priority: w.priority,
                size: w.size || 50,
                flexible: true,
                reason: w.reason
              }));
              return {
                decision: repaired,
                plannedWidgets,
                widgetOrder: plannedWidgets.map(w => w.type),
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
  const fallbackDecision = deterministicReRankWidgets(query, canonicalIntent, userGoal, candidates, signals);
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
