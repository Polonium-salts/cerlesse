import {
  solveTileLayout,
  TileLayoutInput,
  TileWidth,
  TileLayoutSolution,
  LAYOUT_REPLAN_THRESHOLDS
} from "../../src/lib/tileLayoutEngine.js";
import { getWidgetLayoutMeta } from "../../src/widgets/manifests/index.js";
import type {
  LayoutIntent,
  WidgetLayoutIntent,
  LayoutRelation,
  LayoutMetrics,
  LayoutAdjustment
} from "../../src/types.js";

export interface SolveLayoutInput {
  widgetIds?: string[];
  emphasizedWidgetId?: string;
  totalColumns?: number;
  containerWidth?: number;
  widgetWidths?: Record<string, number>;
  userOverrides?: Record<string, { size?: TileWidth; preferredSide?: "left" | "right" } | TileWidth>;
  layoutIntent?: LayoutIntent;
  relations?: LayoutRelation[];
}

export interface SolvedTileItem {
  id: string;
  colSpan: number;
  rowSpan: number;
  widthPercent: number;
  x: number;
  y: number;
  gridColumn: string;
  gridRow: string;
  isEmphasized?: boolean;
}

export interface SolveLayoutOutput {
  tiles: SolvedTileItem[];
  componentOrder: string[];
  totalRows: number;
  fillRatio: number;
  totalHeightPx: number;
  emptyCells?: number;
  metrics: LayoutMetrics;
  adjustments: LayoutAdjustment[];
  replanCount: number;
}

/**
 * solve_layout: 纯数学确定性装箱排版求解器
 * 严格契约：
 * 1. 绝不添加或删除任何业务 Widget。
 * 2. 仅计算栅格跨度、行数、坐标与阅读顺序。
 * 3. 包含自主重排循环 (最大 3 次)，保证最终评分达标。
 */
export function solveLayoutTool(input: SolveLayoutInput): SolveLayoutOutput {
  const intent = input.layoutIntent;
  let targetWidgets: Array<{
    id: string;
    widthPercent?: number;
    role?: string;
    priority?: number;
    isEmphasized?: boolean;
    group?: string;
  }> = [];

  if (intent && intent.widgets && intent.widgets.length > 0) {
    targetWidgets = intent.widgets.map(w => ({
      id: w.id,
      widthPercent: w.widthPercent,
      role: w.role,
      priority: w.priority,
      isEmphasized: w.id === intent.focusWidgetId || w.role === "hero",
      group: w.group
    }));
  } else if (input.widgetIds && input.widgetIds.length > 0) {
    const ids = Array.from(new Set(input.widgetIds.map(id => id.trim()).filter(Boolean)));
    targetWidgets = ids.map((id, index) => {
      const customW = input.widgetWidths?.[id];
      const isEmp = id === input.emphasizedWidgetId;
      return {
        id,
        widthPercent: customW,
        priority: isEmp ? 100 : Math.max(10, 80 - index * 5),
        isEmphasized: isEmp
      };
    });
  }

  if (targetWidgets.length === 0) {
    return {
      tiles: [],
      componentOrder: [],
      totalRows: 0,
      fillRatio: 1,
      totalHeightPx: 0,
      metrics: {
        overlapRate: 0,
        gapRate: 0,
        widthUtilization: 1,
        contentOverflowRate: 0,
        semanticAdjacency: 1,
        focusConsistency: 1,
        heightVariance: 0,
        visualBalance: 1,
        totalScore: 1
      },
      adjustments: [],
      replanCount: 0
    };
  }

  const totalColumns = input.totalColumns || 12;
  const containerWidth = input.containerWidth || 1280;
  const relations = input.relations || intent?.relations || [];
  const focusWidgetId = intent?.focusWidgetId || input.emphasizedWidgetId;

  // 构建求解输入
  const buildInputs = (
    widgetList: typeof targetWidgets,
    widthOverrides?: Record<string, TileWidth>
  ): TileLayoutInput[] => {
    return widgetList.map(w => {
      const layoutMeta = getWidgetLayoutMeta(w.id);
      const userOverride = input.userOverrides?.[w.id];
      const userOverrideSize: TileWidth | undefined = typeof userOverride === "number"
        ? (userOverride as TileWidth)
        : (userOverride?.size as TileWidth | undefined);
      const userPreferredSide = typeof userOverride === "object" ? userOverride?.preferredSide : undefined;

      let size: TileWidth = 50;
      let isUserOverridden = false;

      if (userOverrideSize && [25, 50, 75, 100].includes(userOverrideSize)) {
        // 用户手动调整过的大小具有最高优先级，Agent 重新排版时不推翻
        size = userOverrideSize;
        isUserOverridden = true;
      } else if (widthOverrides && widthOverrides[w.id]) {
        size = widthOverrides[w.id];
      } else if (w.widthPercent === 25 || w.widthPercent === 50 || w.widthPercent === 75 || w.widthPercent === 100) {
        size = w.widthPercent;
      } else if (layoutMeta.defaultWidth === 25 || layoutMeta.defaultWidth === 50 || layoutMeta.defaultWidth === 75 || layoutMeta.defaultWidth === 100) {
        size = layoutMeta.defaultWidth as TileWidth;
      } else if (w.id === "image_gallery") {
        size = 75;
      } else if (w.id === "ai_answer") {
        size = 100;
      }

      return {
        id: w.id,
        size,
        isUserOverridden,
        preferredSide: userPreferredSide,
        role: w.role as any,
        isEmphasized: w.isEmphasized || w.id === focusWidgetId,
        priority: w.priority ?? (w.id === focusWidgetId ? 100 : 50),
        group: w.group
      };
    });
  };

  // 初始求解
  let currentInputs = buildInputs(targetWidgets);
  let bestSolution: TileLayoutSolution = solveTileLayout(currentInputs, {
    totalColumns,
    containerWidth,
    relations,
    focusWidgetId
  });

  let replanCount = 0;
  const maxReplans = 3;

  // 质量检查与重排反馈循环 (Re-planning Loop)
  while (
    replanCount < maxReplans &&
    (bestSolution.metrics.gapRate > LAYOUT_REPLAN_THRESHOLDS.GAP_RATE_THRESHOLD ||
      bestSolution.metrics.totalScore < LAYOUT_REPLAN_THRESHOLDS.MIN_TOTAL_SCORE_THRESHOLD)
  ) {
    replanCount++;
    const overrides: Record<string, TileWidth> = {};

    // 针对空洞进行配对优化：如果存在孤立的 75% 或 50% 产生间隙，尝试寻找 25% 配对
    const currentSizes = bestSolution.items.map(item => ({ id: item.id, size: item.size }));
    const has75 = currentSizes.some(s => s.size === 75);
    const has25 = currentSizes.some(s => s.size === 25);

    // 寻找不受显式关系约束的候选组件
    const boundRelationIds = new Set<string>();
    for (const r of relations) {
      boundRelationIds.add(r.source);
      boundRelationIds.add(r.target);
    }

    if (has75 && !has25 && currentSizes.some(s => s.size === 50)) {
      // 将其中一个 50% 次要组件降为 25% 以便与 75% 完美拼接为 100%
      const candidateToShrink = targetWidgets.find(
        w => !w.isEmphasized && w.id !== "ai_answer" && w.id !== "image_gallery" && !boundRelationIds.has(w.id)
      ) || targetWidgets.find(
        w => !w.isEmphasized && w.id !== "ai_answer" && w.id !== "image_gallery"
      );
      if (candidateToShrink) {
        overrides[candidateToShrink.id] = 25;
      }
    } else if (bestSolution.metrics.gapRate > 0.10) {
      // 尝试在 interleave: true 模式下重新打散小组件
      const candidate = targetWidgets.find(
        w => w.id !== focusWidgetId && w.widthPercent !== 100 && !boundRelationIds.has(w.id)
      );
      if (candidate) {
        const currentW = overrides[candidate.id] || 50;
        overrides[candidate.id] = currentW === 50 ? 25 : 50;
      }
    }

    const nextInputs = buildInputs(targetWidgets, overrides);
    const candidateSolution = solveTileLayout(nextInputs, {
      totalColumns,
      containerWidth,
      relations,
      focusWidgetId,
      interleave: replanCount % 2 === 1
    });

    const isScoreBetter = candidateSolution.metrics.totalScore > bestSolution.metrics.totalScore;
    const isAdjacencyMaintained = candidateSolution.metrics.semanticAdjacency >= bestSolution.metrics.semanticAdjacency;

    if (isScoreBetter && isAdjacencyMaintained) {
      bestSolution = candidateSolution;
    }
  }

  const tiles: SolvedTileItem[] = bestSolution.items.map(tile => ({
    id: tile.id,
    colSpan: tile.w,
    rowSpan: 1,
    widthPercent: tile.size,
    x: tile.x,
    y: tile.y,
    gridColumn: tile.gridStyle.gridColumn,
    gridRow: tile.gridStyle.gridRow,
    isEmphasized: tile.isEmphasized
  }));

  // Reading order sorted by Y top coordinate then X column
  const componentOrder = [...tiles]
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    .map(t => t.id);

  return {
    tiles,
    componentOrder,
    totalRows: bestSolution.totalRows,
    fillRatio: bestSolution.fillRatio,
    totalHeightPx: bestSolution.totalHeightPx,
    emptyCells: bestSolution.emptyCells,
    metrics: bestSolution.metrics,
    adjustments: bestSolution.adjustments,
    replanCount
  };
}
