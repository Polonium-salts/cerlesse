/**
 * 布局多目标评价与评分函数 (Layout Scoring Model)
 * 综合评估紧凑度、优先级排布、整齐对齐度、左右对称平衡度以及前后更新稳定性
 *
 * 评分公式：
 * score = compactness * 0.40 + priority * 0.25 + alignment * 0.15 + balance * 0.10 + stability * 0.10
 */

import { StandardWidget, WidgetLayoutRect } from "./WidgetSchema.js";

export interface ScoringWeights {
  compactness: number;
  priority: number;
  alignment: number;
  balance: number;
  stability: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  compactness: 0.40,
  priority: 0.25,
  alignment: 0.15,
  balance: 0.10,
  stability: 0.10
};

export interface LayoutScoreBreakdown {
  compactness: number; // 0 - 1
  priority: number;    // 0 - 1
  alignment: number;   // 0 - 1
  balance: number;     // 0 - 1
  stability: number;   // 0 - 1
  overallScore: number;// 0 - 100
  wasteArea: number;   // 空洞单元格数
}

export function evaluateLayoutScore(params: {
  placedItems: Array<StandardWidget & { layout: WidgetLayoutRect }>;
  skyline: number[];
  totalColumns: number;
  previousLayout?: Map<string, WidgetLayoutRect>;
  weights?: Partial<ScoringWeights>;
}): LayoutScoreBreakdown {
  const { placedItems, skyline, totalColumns, previousLayout } = params;
  const weights: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS, ...(params.weights || {}) };

  if (placedItems.length === 0) {
    return {
      compactness: 1,
      priority: 1,
      alignment: 1,
      balance: 1,
      stability: 1,
      overallScore: 100,
      wasteArea: 0
    };
  }

  const maxRow = Math.max(...skyline, 1);
  const totalGridCapacity = maxRow * totalColumns;

  // 1. 紧凑度 (Compactness)：已占用的面积 / 总包络面积
  let occupiedArea = 0;
  for (const item of placedItems) {
    occupiedArea += item.layout.w * item.layout.h;
  }
  const wasteArea = Math.max(0, totalGridCapacity - occupiedArea);
  const compactness = totalGridCapacity > 0 ? Math.min(1, Math.max(0, occupiedArea / totalGridCapacity)) : 1;

  // 2. 优先级排布 (Priority Flow)：高优先级组件是否靠前放置
  let priorityScoreSum = 0;
  let maxPossiblePriorityScore = 0;
  for (const item of placedItems) {
    const normPriority = (item.priority ?? 50) / 100; // 0 - 1
    // 越靠近顶部 (y 越小)，给的分数越高
    const yDecay = Math.max(0, 1 - (item.layout.y / (maxRow + 1)));
    priorityScoreSum += normPriority * yDecay;
    maxPossiblePriorityScore += normPriority;
  }
  const priority = maxPossiblePriorityScore > 0 ? (priorityScoreSum / maxPossiblePriorityScore) : 1;

  // 3. 对齐度 (Alignment)：各磁贴边界是否贴合 0, 3, 6, 9, 12 等主要分栏线
  let alignedEdges = 0;
  let totalEdges = 0;
  for (const item of placedItems) {
    const left = item.layout.x;
    const right = item.layout.x + item.layout.w;
    totalEdges += 2;
    if (left === 0 || left === totalColumns / 4 || left === totalColumns / 2 || left === (totalColumns * 3) / 4) {
      alignedEdges++;
    }
    if (right === totalColumns || right === totalColumns / 2 || right === (totalColumns * 3) / 4 || right === totalColumns / 4) {
      alignedEdges++;
    }
  }
  const alignment = totalEdges > 0 ? alignedEdges / totalEdges : 1;

  // 4. 平衡度 (Balance)：左侧半区与右侧半区的垂直高度差
  const midCol = totalColumns / 2;
  let leftHeightSum = 0;
  let rightHeightSum = 0;
  for (let c = 0; c < totalColumns; c++) {
    if (c < midCol) leftHeightSum += skyline[c] || 0;
    else rightHeightSum += skyline[c] || 0;
  }
  const leftAvg = leftHeightSum / Math.max(1, midCol);
  const rightAvg = rightHeightSum / Math.max(1, totalColumns - midCol);
  const heightDiff = Math.abs(leftAvg - rightAvg);
  const balance = Math.max(0, 1 - (heightDiff / Math.max(1, maxRow)));

  // 5. 稳定性 (Stability)：前后布局位移越小越好 (避免搜索刷新时剧烈跳动)
  let stabilitySum = 0;
  let trackedCount = 0;
  if (previousLayout && previousLayout.size > 0) {
    for (const item of placedItems) {
      const prev = previousLayout.get(item.id);
      if (prev) {
        trackedCount++;
        const dist = Math.sqrt(Math.pow(item.layout.x - prev.x, 2) + Math.pow(item.layout.y - prev.y, 2));
        const itemStability = Math.max(0, 1 - (dist / Math.max(totalColumns, 8)));
        stabilitySum += itemStability;
      }
    }
  }
  const stability = trackedCount > 0 ? stabilitySum / trackedCount : 1;

  const composite =
    compactness * weights.compactness +
    priority * weights.priority +
    alignment * weights.alignment +
    balance * weights.balance +
    stability * weights.stability;

  const overallScore = Math.round(composite * 1000) / 10;

  return {
    compactness,
    priority,
    alignment,
    balance,
    stability,
    overallScore,
    wasteArea
  };
}
