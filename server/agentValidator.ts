import type { CapabilityCoverageReport, ResultWidgetKey } from "../src/types.js";
import type { CandidateWidget, ContentSignalsPayload, WidgetDecision, WidgetSelectionItem } from "../src/widgets/widgetContract.js";
import { getRouteForIntent, isWidgetForbidden, normalizeIntent } from "./agentRouter.js";
import { getUnifiedCatalogItem } from "../src/widgets/widgetRetriever.js";

export interface ValidationContext {
  query: string;
  intent: string;
  primaryIntent?: string;
  secondaryIntents?: string[];
  requiredCapabilities?: string[];
  taskComplexity?: "simple" | "medium" | "complex";
  userGoal: string;
  signals?: ContentSignalsPayload;
  candidates: CandidateWidget[];
}

export interface ValidationReport {
  passed: boolean;
  violations: string[];
  missingMandatory: ResultWidgetKey[];
  forbiddenIncluded: ResultWidgetKey[];
  unreadyIncluded: ResultWidgetKey[];
  invalidKeys: string[];
  duplicateKeys: string[];
  coverageReport?: CapabilityCoverageReport;
}

/**
 * 计算当前选定组件对所需原子能力的覆盖率
 */
export function calculateCapabilityCoverage(
  requiredCapabilities: string[] = [],
  selectedKeys: ResultWidgetKey[] = []
): CapabilityCoverageReport {
  if (!requiredCapabilities || requiredCapabilities.length === 0) {
    return { required: [], covered: [], missing: [], ratio: 1.0 };
  }

  const reqSet = new Set(requiredCapabilities.map((c) => c.toLowerCase()));
  const coveredSet = new Set<string>();

  for (const key of selectedKeys) {
    const item = getUnifiedCatalogItem(key);
    if (item) {
      for (const cap of item.capabilities) {
        const lower = cap.toLowerCase();
        if (reqSet.has(lower)) {
          coveredSet.add(lower);
        }
      }
    }
  }

  const required = Array.from(reqSet);
  const covered = Array.from(coveredSet);
  const missing = required.filter((c) => !coveredSet.has(c));
  const ratio = required.length > 0 ? covered.length / required.length : 1.0;

  return { required, covered, missing, ratio };
}

/**
 * 校验小组件选型决策是否合规 (Agent Validator)
 * 检查项：
 * 1. 必选组件是否存在 (Missing Mandatory Widgets)
 * 2. 是否夹带硬性禁用组件 (Forbidden Widgets Incursion)
 * 3. 组件数据是否真正就绪 (Data Readiness Check)
 * 4. 是否存在未登记的非法 Key (Catalog Validity)
 * 5. 是否存在重复选型 (Deduplication)
 * 6. 核心能力覆盖率校验 (Capability Coverage >= 85%)
 */
export function validateWidgetDecision(
  decision: WidgetDecision,
  context: ValidationContext
): ValidationReport {
  const violations: string[] = [];
  const missingMandatory: ResultWidgetKey[] = [];
  const forbiddenIncluded: ResultWidgetKey[] = [];
  const unreadyIncluded: ResultWidgetKey[] = [];
  const invalidKeys: string[] = [];
  const duplicateKeys: string[] = [];

  const route = getRouteForIntent(decision.intent || context.intent);
  const selectedKeys = decision.selectedWidgets.map((w) => w.key as ResultWidgetKey);
  const keySet = new Set<string>();

  // 1. 重复项与合法性检测
  for (const item of decision.selectedWidgets) {
    if (keySet.has(item.key)) {
      duplicateKeys.push(item.key);
      violations.push(`发现重复组件: ${item.key}`);
    }
    keySet.add(item.key);

    if (!getUnifiedCatalogItem(item.key)) {
      invalidKeys.push(item.key);
      violations.push(`非法组件键名 (未在 Catalog 中登记): ${item.key}`);
    }
  }

  // 2. 检查黑名单 (Forbidden Widgets)
  for (const key of selectedKeys) {
    if (isWidgetForbidden(key, route.intent)) {
      forbiddenIncluded.push(key);
      violations.push(`组件 [${key}] 在当前意图 [${route.intent}] 下被硬性禁用`);
    }
  }

  // 3. 检查必选组件 (Mandatory Widgets)
  for (const mand of route.mandatoryWidgets) {
    if (!selectedKeys.includes(mand)) {
      missingMandatory.push(mand);
      violations.push(`缺失意图 [${route.intent}] 的核心必选组件: [${mand}]`);
    }
  }

  // 4. 数据就绪度检测 (Data Readiness)
  if (context.signals) {
    const { signals } = context;
    for (const key of selectedKeys) {
      if (key === "image_gallery") {
        const hasImages = (signals.imageCount ?? 0) > 0;
        const hasImageIntent = signals.imageIntent === true;
        if (!hasImages && !hasImageIntent) {
          unreadyIncluded.push(key);
          violations.push(`组件 [image_gallery] 数据未就绪 (无图片素材且非图片搜索意图)`);
        }
      }
      if (key === "comparison") {
        const hasRows = (signals.comparisonRows ?? 0) > 0;
        const hasMultiEntities = signals.hasMultipleEntities === true;
        const hasVsQuery = /(vs|对比|区别|比较|哪个好|pk)/i.test(context.query);
        if (!hasRows && !hasMultiEntities && !hasVsQuery) {
          unreadyIncluded.push(key);
          violations.push(`组件 [comparison] 数据未就绪 (无多实体横向对比数据)`);
        }
      }
      if (key === "takeaways") {
        if (signals.takeawayCount !== undefined && signals.takeawayCount === 0) {
          unreadyIncluded.push(key);
          violations.push(`组件 [takeaways] 数据未就绪 (要点列表为空)`);
        }
      }
    }
  }

  // 5. 检查能力覆盖率 (Capability Coverage Check >= 85%)
  let coverageReport: CapabilityCoverageReport | undefined;
  if (context.requiredCapabilities && context.requiredCapabilities.length > 0) {
    coverageReport = calculateCapabilityCoverage(context.requiredCapabilities, selectedKeys);
    if (coverageReport.ratio < 0.85 && coverageReport.missing.length > 0) {
      violations.push(
        `能力覆盖率不足 (${(coverageReport.ratio * 100).toFixed(0)}% < 85%)，缺失关键能力: [${coverageReport.missing.join(", ")}]`
      );
    }
  }

  // 6. 数量上下限检测
  if (selectedKeys.length < 2) {
    violations.push(`选定组件数 (${selectedKeys.length}) 低于最小允许阈值 2`);
  }
  if (selectedKeys.length > 7) {
    violations.push(`选定组件数 (${selectedKeys.length}) 超过最大允许阈值 7`);
  }

  const passed = violations.length === 0;

  return {
    passed,
    violations,
    missingMandatory,
    forbiddenIncluded,
    unreadyIncluded,
    invalidKeys,
    duplicateKeys,
    coverageReport
  };
}

/**
 * 自动修复不合规的小组件选型决策 (Decision Auto-Remediator)
 */
export function repairWidgetDecision(
  decision: WidgetDecision,
  context: ValidationContext,
  report: ValidationReport
): WidgetDecision {
  const route = getRouteForIntent(decision.intent || context.intent);
  const existingMap = new Map<string, WidgetSelectionItem>();

  // 1. 过滤掉非法 Key、禁用 Key 和数据未就绪的 Key
  for (const item of decision.selectedWidgets) {
    const key = item.key as ResultWidgetKey;
    if (report.invalidKeys.includes(key)) continue;
    if (report.forbiddenIncluded.includes(key)) continue;
    if (report.unreadyIncluded.includes(key)) continue;
    if (!existingMap.has(key)) {
      existingMap.set(key, item);
    }
  }

  // 2. 补齐缺失的必选组件
  for (const mandKey of report.missingMandatory) {
    if (!existingMap.has(mandKey)) {
      const catItem = getUnifiedCatalogItem(mandKey);
      const candidate = context.candidates.find((c) => c.key === mandKey);
      existingMap.set(mandKey, {
        key: mandKey,
        priority: candidate ? Math.round(candidate.finalScore * 100) : (catItem?.basePriority ?? 90),
        size: candidate?.defaultSpan || catItem?.defaultSpan || 75,
        reason: candidate?.reason || `意图 [${route.intent}] 核心必备组件`,
        confidence: 0.95
      });
    }
  }

  // 3. 边际能力增益补齐 (Gap Filling for missing capabilities)
  if (context.requiredCapabilities && context.requiredCapabilities.length > 0) {
    let currentCoverage = calculateCapabilityCoverage(
      context.requiredCapabilities,
      Array.from(existingMap.keys()) as ResultWidgetKey[]
    );

    if (currentCoverage.ratio < 0.85 && currentCoverage.missing.length > 0) {
      const candidatesToConsider = context.candidates.filter((c) => {
        if (existingMap.has(c.key)) return false;
        if (route.forbiddenWidgets.includes(c.key)) return false;
        if (!route.allowedWidgets.includes(c.key)) return false;
        return true;
      });

      const scoredCandidates = candidatesToConsider.map((cand) => {
        const item = getUnifiedCatalogItem(cand.key);
        const itemCaps = new Set((item?.capabilities || []).map((cp) => cp.toLowerCase()));
        const missingSet = new Set(currentCoverage.missing);
        let gain = 0;
        for (const cap of itemCaps) {
          if (missingSet.has(cap)) gain++;
        }
        return { candidate: cand, gain, score: cand.finalScore + gain * 0.3 };
      });

      scoredCandidates.sort((a, b) => b.score - a.score);

      for (const { candidate, gain } of scoredCandidates) {
        if (gain === 0 && currentCoverage.ratio >= 0.85) break;
        if (existingMap.size >= 7) break;

        const catItem = getUnifiedCatalogItem(candidate.key);
        existingMap.set(candidate.key, {
          key: candidate.key,
          priority: Math.round(candidate.finalScore * 100),
          size: candidate.defaultSpan || catItem?.defaultSpan || 50,
          reason: candidate.reason || `自动补齐缺失能力 [${catItem?.capabilities.slice(0, 2).join(", ")}]`,
          confidence: candidate.finalScore
        });

        currentCoverage = calculateCapabilityCoverage(
          context.requiredCapabilities,
          Array.from(existingMap.keys()) as ResultWidgetKey[]
        );

        if (currentCoverage.ratio >= 0.85) break;
      }
    }
  }

  // 4. 如果有效组件少于 2 个，从允许的候选池中按 finalScore 降序补充
  if (existingMap.size < 2) {
    const validCandidates = context.candidates.filter((c) => {
      if (existingMap.has(c.key)) return false;
      if (route.forbiddenWidgets.includes(c.key)) return false;
      if (!route.allowedWidgets.includes(c.key)) return false;
      if (c.key === "image_gallery" && (context.signals?.imageCount ?? 0) === 0 && !context.signals?.imageIntent) {
        return false;
      }
      return true;
    });

    for (const cand of validCandidates) {
      if (existingMap.size >= 3) break;
      existingMap.set(cand.key, {
        key: cand.key,
        priority: Math.round(cand.finalScore * 100),
        size: cand.defaultSpan,
        reason: cand.reason || "补充高契合度候选组件",
        confidence: cand.finalScore
      });
    }
  }

  // 5. 若修复后组件依然少于 2 个且核心速答被允许，则以 ai_answer 兜底
  if (existingMap.size < 2 && !existingMap.has("ai_answer") && route.allowedWidgets.includes("ai_answer")) {
    existingMap.set("ai_answer", {
      key: "ai_answer",
      priority: 95,
      size: 50,
      reason: "核心知识与综合速答基底",
      confidence: 0.95
    });
  }

  // 6. 限制最多 7 个组件
  const items = Array.from(existingMap.values()).slice(0, 7);
  items.sort((a, b) => b.priority - a.priority);

  return {
    intent: route.intent,
    userGoal: decision.userGoal || context.userGoal,
    selectedWidgets: items
  };
}
