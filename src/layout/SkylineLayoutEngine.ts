/**
 * Skyline + Best-Fit 智能磁贴排版引擎 (Skyline & Best-Fit 2D Layout Engine)
 * 核心原理：
 * 1. 维护 12/8/4 列 Skyline 天际线高度数组；
 * 2. 采用 Best-Fit 最优空洞拟合策略，寻找能够容纳组件且产生最少空白的最佳落位；
 * 3. 运行多目标评分模型优化紧凑度与对齐度；
 * 4. 支持增量更新与位置平滑保持 (Stability)。
 */

import {
  StandardWidget,
  WidgetLayoutRect,
  LayoutEngineOptions,
  LayoutEngineResult
} from "./WidgetSchema.js";
import { calculateWidgetSize } from "./WidgetSizePredictor.js";
import { evaluateLayoutScore } from "./Scoring.js";

export class SkylineLayoutEngine {
  private totalColumns: number;
  private rowUnitPx: number;
  private gapPx: number;
  private allowSpanFlex: boolean;
  private enableInterleaving: boolean;
  private options: LayoutEngineOptions;

  constructor(options: LayoutEngineOptions) {
    this.options = options;
    this.totalColumns = options.totalColumns || 12;
    this.rowUnitPx = options.rowUnitPx || 64;
    this.gapPx = options.gapPx || 16;
    this.allowSpanFlex = options.allowSpanFlex ?? true;
    this.enableInterleaving = options.enableInterleaving ?? true;
  }

  /**
   * 求解小组件自适应排版 (Solve Layout via Skyline + Best-Fit)
   */
  public solve(widgets: StandardWidget[]): LayoutEngineResult {
    if (!widgets || widgets.length === 0) {
      return {
        items: [],
        totalRows: 0,
        totalColumns: this.totalColumns,
        compactnessScore: 100,
        overallScore: 100,
        wasteArea: 0
      };
    }

    // 1. 初始化天际线 Skyline
    const skyline: number[] = new Array(this.totalColumns).fill(0);
    const placedItems: Array<StandardWidget & { layout: WidgetLayoutRect }> = [];

    // 2. 穿插排序待放置队列 (Interleaved Sorter: L -> S -> M -> S)
    const categorized = widgets.map(w => {
      const dim = calculateWidgetSize(w, this.totalColumns);
      const span = Math.min(this.totalColumns, Math.max(1, dim.w));
      const cat = span >= 9 ? "L" : span <= 4 ? "S" : "M";
      return { widget: w, dim, span, cat };
    });

    const lGroup = categorized.filter(c => c.cat === "L").sort((a, b) => (b.widget.priority ?? 50) - (a.widget.priority ?? 50));
    const mGroup = categorized.filter(c => c.cat === "M").sort((a, b) => (b.widget.priority ?? 50) - (a.widget.priority ?? 50));
    const sGroup = categorized.filter(c => c.cat === "S").sort((a, b) => (b.widget.priority ?? 50) - (a.widget.priority ?? 50));

    const pending: typeof categorized = [];
    // 固定的排最前
    categorized.filter(c => c.widget.pinned).forEach(c => pending.push(c));

    while (lGroup.length > 0 || mGroup.length > 0 || sGroup.length > 0) {
      if (lGroup.length > 0) pending.push(lGroup.shift()!);
      if (sGroup.length > 0) pending.push(sGroup.shift()!);
      if (mGroup.length > 0) pending.push(mGroup.shift()!);
      if (sGroup.length > 0) pending.push(sGroup.shift()!);
      if (lGroup.length === 0 && mGroup.length === 0 && sGroup.length > 0) pending.push(...sGroup.splice(0));
      else if (lGroup.length === 0 && sGroup.length === 0 && mGroup.length > 0) pending.push(...mGroup.splice(0));
      else if (mGroup.length === 0 && sGroup.length === 0 && lGroup.length > 0) pending.push(...lGroup.splice(0));
    }

    // 追踪穿插节奏
    let wideCount = 0;

    // 3. 逐个进行 2D Skyline + Best-Fit + 穿插奖励放置
    while (pending.length > 0) {
      const { widget: current, dim, span: w, cat } = pending.shift()!;
      let h = Math.max(1, dim.h);

      // 穿插偏好判定 (例如 75% 宽组件在 12 列模式下左右交替穿插)
      let preferredX: number | null = null;
      if (this.totalColumns === 12 && w === 9 && this.enableInterleaving) {
        if (!current.preferredSide) {
          // 偶数次居左 (x=0)，奇数次居右 (x=3)
          preferredX = (wideCount % 2 === 1) ? 3 : 0;
          wideCount++;
        } else if (current.preferredSide === "right") {
          preferredX = 3;
        } else if (current.preferredSide === "left") {
          preferredX = 0;
        }
      }

      // 4. 寻找 Skyline 上最优 Best-Fit 候选位置 (含口袋与穿插奖励)
      let bestX = 0;
      let bestY = Infinity;
      let bestScore = -Infinity;

      // 遍历所有可能的起始列 x (从 0 到 totalColumns - w)
      for (let x = 0; x <= this.totalColumns - w; x++) {
        let yBase = 0;
        for (let col = x; col < x + w; col++) {
          if (skyline[col] > yBase) {
            yBase = skyline[col];
          }
        }

        let wasteUnderneath = 0;
        for (let col = x; col < x + w; col++) {
          wasteUnderneath += (yBase - skyline[col]);
        }

        let posScore = 1000 - yBase * 50 - wasteUnderneath * 30;

        // 穿插与邻接嵌套奖励 (Crossing Bonus)
        if (cat === "S") {
          for (const item of placedItems) {
            const isBeside = (x === item.layout.x + item.layout.w || x + w === item.layout.x);
            if (isBeside) posScore += 60;
          }
        }

        if (preferredX !== null) {
          if (x === preferredX) posScore += 80;
          else posScore -= 30;
        }

        if (x === 0 || x + w === this.totalColumns || x === 3 || x === 6 || x === 9) {
          posScore += 20;
        }

        if (posScore > bestScore || (posScore === bestScore && yBase < bestY)) {
          bestScore = posScore;
          bestX = x;
          bestY = yBase;
        }
      }

      // 5. 放置并更新 Skyline
      const newHeight = bestY + h;
      for (let col = bestX; col < bestX + w; col++) {
        skyline[col] = newHeight;
      }

      placedItems.push({
        ...current,
        layout: {
          x: bestX,
          y: bestY,
          w,
          h,
          pixelHeight: h * this.rowUnitPx + (h - 1) * this.gapPx
        }
      });
    }

    // 6. 尾端留白与空洞填充/拉伸优化 (Post-processing Gap Elimination)
    if (this.allowSpanFlex && this.totalColumns === 12) {
      this.eliminateGapsAndAlign(placedItems, skyline);
    }

    // 7. 计算整体验收评分
    const totalRows = Math.max(...skyline, 0);
    const scoreBreakdown = evaluateLayoutScore({
      placedItems,
      skyline,
      totalColumns: this.totalColumns,
      previousLayout: this.options.previousLayout,
      weights: this.options.scoringWeights
    });

    return {
      items: placedItems,
      totalRows,
      totalColumns: this.totalColumns,
      compactnessScore: Math.round(scoreBreakdown.compactness * 100),
      overallScore: scoreBreakdown.overallScore,
      wasteArea: scoreBreakdown.wasteArea
    };
  }

  /**
   * 空白消除与同层平齐对齐 (Gap Elimination & Row Alignment)
   */
  private eliminateGapsAndAlign(
    items: Array<StandardWidget & { layout: WidgetLayoutRect }>,
    skyline: number[]
  ) {
    // 按 y 坐标分组为视觉行
    const rowMap = new Map<number, Array<StandardWidget & { layout: WidgetLayoutRect }>>();
    for (const item of items) {
      const list = rowMap.get(item.layout.y) || [];
      list.push(item);
      rowMap.set(item.layout.y, list);
    }

    for (const [y, rowItems] of rowMap.entries()) {
      rowItems.sort((a, b) => a.layout.x - b.layout.x);
      let totalOccupiedCols = rowItems.reduce((acc, it) => acc + it.layout.w, 0);

      // 若同行只有一个组件且占 9 格或 6 格且为该行独占，若为尾部则可平滑拉伸填满
      if (totalOccupiedCols < this.totalColumns) {
        const gap = this.totalColumns - totalOccupiedCols;

        // 若只有一个 6 或 9 且可拉伸（非固定组件）
        if (rowItems.length === 1 && rowItems[0].type !== "image_gallery") {
          const single = rowItems[0];
          single.layout.w = this.totalColumns;
          single.layout.x = 0;
          for (let c = 0; c < this.totalColumns; c++) {
            skyline[c] = Math.max(skyline[c], single.layout.y + single.layout.h);
          }
        } else if (gap === 3 && rowItems.length === 2) {
          // 例如 6 + 3 = 9，空 3 格：将 6 格升为 9 格形成 9 + 3 = 12 满行闭合
          const stretchable = rowItems.find(it => it.layout.w === 6 && it.type !== "image_gallery");
          if (stretchable) {
            stretchable.layout.w = 9;
            // 重新排列位置
            let curX = 0;
            for (const it of rowItems) {
              it.layout.x = curX;
              curX += it.layout.w;
            }
          }
        }
      }
    }
  }
}

/**
 * 工厂函数：执行自适应 Skyline + Best-Fit 布局求解
 */
export function solveSkylineLayout(
  widgets: StandardWidget[],
  options?: Partial<LayoutEngineOptions>
): LayoutEngineResult {
  const fullOptions: LayoutEngineOptions = {
    totalColumns: options?.totalColumns || 12,
    rowUnitPx: options?.rowUnitPx || 64,
    gapPx: options?.gapPx || 16,
    allowSpanFlex: options?.allowSpanFlex ?? true,
    enableInterleaving: options?.enableInterleaving ?? true,
    scoringWeights: options?.scoringWeights,
    previousLayout: options?.previousLayout
  };

  const engine = new SkylineLayoutEngine(fullOptions);
  return engine.solve(widgets);
}
