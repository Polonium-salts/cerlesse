import type { ResultWidgetKey } from "../src/types.js";
import type { CandidateWidget, ContentSignalsPayload, WidgetDecision, WidgetSelectionItem } from "../src/widgets/widgetContract.js";
import { getRouteForIntent, isWidgetForbidden, normalizeIntent } from "./agentRouter.js";
import { getUnifiedCatalogItem } from "../src/widgets/widgetRetriever.js";

export interface ValidationContext {
  query: string;
  intent: string;
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
}

/**
 * 校验小组件选型决策是否合规 (Agent Validator)
 * 检查项：
 * 1. 必选组件是否存在 (Missing Mandatory Widgets)
 * 2. 是否夹带硬性禁用组件 (Forbidden Widgets Incursion)
 * 3. 组件数据是否真正就绪 (Data Readiness Check)
 * 4. 是否存在未登记的非法 Key (Catalog Validity)
 * 5. 是否存在重复选型 (Deduplication)
 * 6. 选型数量是否处于合理范围 (2 ~ 6)
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

  // 5. 数量上下限检测
  if (selectedKeys.length < 2) {
    violations.push(`选定组件数 (${selectedKeys.length}) 低于最小允许阈值 2`);
  }
  if (selectedKeys.length > 6) {
    violations.push(`选定组件数 (${selectedKeys.length}) 超过最大允许阈值 6`);
  }

  const passed = violations.length === 0;

  return {
    passed,
    violations,
    missingMandatory,
    forbiddenIncluded,
    unreadyIncluded,
    invalidKeys,
    duplicateKeys
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

  // 3. 如果有效组件少于 2 个，从允许的候选池中按 finalScore 降序补充
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

  // 4. 确保三大基底 (ai_answer + related_links + sources) 完整存在
  if (!existingMap.has("ai_answer") && route.allowedWidgets.includes("ai_answer")) {
    existingMap.set("ai_answer", {
      key: "ai_answer",
      priority: 95,
      size: 50,
      reason: "核心知识与综合速答基底",
      confidence: 0.95
    });
  }
  if (!existingMap.has("related_links") && route.allowedWidgets.includes("related_links")) {
    existingMap.set("related_links", {
      key: "related_links",
      priority: 90,
      size: 50,
      reason: "官方信源与快速跳转直达",
      confidence: 0.9
    });
  }
  if (!existingMap.has("sources") && route.allowedWidgets.includes("sources")) {
    existingMap.set("sources", {
      key: "sources",
      priority: 85,
      size: 50,
      reason: "权威文献溯源与存证记录",
      confidence: 0.85
    });
  }

  // 5. 限制最多 6 个组件
  const items = Array.from(existingMap.values()).slice(0, 6);
  // 按 priority 降序
  items.sort((a, b) => b.priority - a.priority);

  return {
    intent: route.intent,
    userGoal: decision.userGoal || context.userGoal,
    selectedWidgets: items
  };
}
