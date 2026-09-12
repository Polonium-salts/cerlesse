import {
  ResultWidgetKey,
  WidgetPlannedSize,
  WidgetPlannedItem,
  AdaptiveLayoutStrategy,
  CustomCardData
} from "../types.js";
import { WIDGET_REGISTRY } from "./adaptiveLayout.js";

export interface BentoWidgetInput {
  key: ResultWidgetKey;
  priority: number; // 1 - 100, higher = higher placement priority
  size: WidgetPlannedSize; // "small" | "medium" | "large" | "full"
  flexible?: boolean; // Can this widget stretch or shrink to fill row gaps?
  minSpan?: number; // 4
  maxSpan?: number; // 12
  isEmphasized?: boolean;
}

export interface SolvedBentoItem {
  key: ResultWidgetKey;
  colSpan: number; // 4, 6, 8, 12
  rowIndex: number;
  itemsInRow: number;
  isCompact: boolean;
  gridClass: string;
  priority: number;
  size: WidgetPlannedSize;
  isEmphasized?: boolean;
}

export interface BentoLayoutSolution {
  items: SolvedBentoItem[];
  totalRows: number;
  gapCount: number;
}

/**
 * Maps semantic size to standard 12-column grid spans
 */
export function sizeToColSpan(size: WidgetPlannedSize): number {
  switch (size) {
    case "full":
      return 12;
    case "large":
      return 8;
    case "medium":
      return 6;
    case "small":
    default:
      return 4;
  }
}

/**
 * Returns clean responsive Tailwind CSS grid span classes
 */
export function getBentoGridClass(colSpan: number): string {
  switch (colSpan) {
    case 12:
      return "col-span-12";
    case 8:
      return "col-span-12 lg:col-span-8";
    case 6:
      return "col-span-12 lg:col-span-6";
    case 4:
    default:
      return "col-span-12 sm:col-span-6 lg:col-span-4";
  }
}

interface WorkingRowItem {
  input: BentoWidgetInput;
  colSpan: number;
}

/**
 * Bento 2D Bin-Packing Layout Solver
 *
 * 核心设计原理：
 * 1. Agent 决定：重要程度 (priority)、尺寸需求 (size: small/medium/large/full)、可压缩延伸程度 (flexible)
 * 2. Layout Solver 决定：二维空间排布、自动换行、前瞻空隙填充 (Lookahead Gap Filling) 与缝隙自适应闭合 (Zero-Gap Bento)
 *
 * 不再做死板的线性 componentOrder 遍历，而是像 iOS/Android 负一屏和 Bento Grid 桌面一样智能排版。
 */
export function solveBentoLayout(
  inputs: BentoWidgetInput[],
  maxColsPerRow: number = 12
): BentoLayoutSolution {
  if (!inputs || inputs.length === 0) {
    return { items: [], totalRows: 0, gapCount: 0 };
  }

  // 1. 拷贝并按 priority 降序排列候选小组件 (高重要度组件优先占领优质展示空间)
  const remaining = [...inputs].sort((a, b) => {
    if (a.isEmphasized && !b.isEmphasized) return -1;
    if (!a.isEmphasized && b.isEmphasized) return 1;
    return b.priority - a.priority;
  });

  const rows: WorkingRowItem[][] = [];
  let currentRow: WorkingRowItem[] = [];
  let currentUsedCols = 0;

  while (remaining.length > 0) {
    const spaceLeft = maxColsPerRow - currentUsedCols;

    // 2. 若当前行已满，结算当前行并开启新的一行
    if (spaceLeft < 4) {
      if (currentRow.length > 0) {
        // 如果当前行还有多余空隙 (如 2 列)，并且该行中有 flexible 的组件，拉伸该组件补齐 12 列
        if (spaceLeft > 0) {
          const flexibleItem = currentRow.find(i => i.input.flexible !== false);
          if (flexibleItem) {
            flexibleItem.colSpan += spaceLeft;
          }
        }
        rows.push(currentRow);
      }
      currentRow = [];
      currentUsedCols = 0;
      continue;
    }

    // 3. 在候选队列中寻找能够恰好放入 spaceLeft 的最佳组件 (前瞻填充机制 Lookahead Gap-Filling)
    // 优先：理想 span <= spaceLeft 的最高优先级组件
    let candidateIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const idealSpan = sizeToColSpan(item.size);

      // 完全合适或能够容纳
      if (idealSpan <= spaceLeft) {
        candidateIndex = i;
        break;
      }

      // 如果当前是新行第一项，且组件本身较大 (例如 full 或 large)，无条件放入该行
      if (currentUsedCols === 0) {
        candidateIndex = i;
        break;
      }
    }

    // 4. 如果找到了能够填补当前行空隙的组件
    if (candidateIndex !== -1) {
      const [chosen] = remaining.splice(candidateIndex, 1);
      const idealSpan = sizeToColSpan(chosen.size);
      const allocatedSpan = Math.min(idealSpan, spaceLeft);

      currentRow.push({
        input: chosen,
        colSpan: allocatedSpan
      });
      currentUsedCols += allocatedSpan;
    } else {
      // 5. 没有找到能够装入当前行剩余空隙的组件：
      // 如果当前行已有组件且标明为 flexible，让行内已有组件自动延伸填满该行 (消除留白)
      if (currentRow.length > 0) {
        const flexibleItem = currentRow.find(i => i.input.flexible !== false) || currentRow[currentRow.length - 1];
        if (flexibleItem && spaceLeft > 0) {
          flexibleItem.colSpan += spaceLeft;
        }
        rows.push(currentRow);
        currentRow = [];
        currentUsedCols = 0;
      } else {
        // 安全兜底：如果一行空空如也连一个组件都无法放入，强制将第一个组件作为全宽或单行放入
        const [forced] = remaining.splice(0, 1);
        rows.push([{ input: forced, colSpan: maxColsPerRow }]);
        currentUsedCols = 0;
      }
    }
  }

  // 结算最后一行
  if (currentRow.length > 0) {
    const spaceLeft = maxColsPerRow - currentUsedCols;
    if (spaceLeft > 0) {
      const flexibleItem = currentRow.find(i => i.input.flexible !== false);
      if (flexibleItem) {
        flexibleItem.colSpan += spaceLeft;
      }
    }
    rows.push(currentRow);
  }

  // 6. 构造成品 SolvedBentoItem 列表
  const solvedItems: SolvedBentoItem[] = [];
  let gapCount = 0;

  rows.forEach((row, rIdx) => {
    const rowItemsCount = row.length;
    let rowTotal = 0;

    row.forEach((item) => {
      rowTotal += item.colSpan;
      const isCompact = item.colSpan <= 4;
      solvedItems.push({
        key: item.input.key,
        colSpan: item.colSpan,
        rowIndex: rIdx,
        itemsInRow: rowItemsCount,
        isCompact,
        gridClass: getBentoGridClass(item.colSpan),
        priority: item.input.priority,
        size: item.input.size,
        isEmphasized: item.input.isEmphasized
      });
    });

    if (rowTotal < maxColsPerRow) {
      gapCount += (maxColsPerRow - rowTotal);
    }
  });

  return {
    items: solvedItems,
    totalRows: rows.length,
    gapCount
  };
}

export const DEFAULT_DESKTOP_SIZES: Record<ResultWidgetKey, WidgetPlannedSize> = {
  custom_cards: "large",           // 4x4 大方块 (2 cols x 2 rows)
  actions_toolbox: "medium",       // 4x2 中号横条 (2 cols x 1 row)
  official_portal: "medium",       // 4x2 中号横条 (2 cols x 1 row)
  verification_checklist: "medium",// 4x2 中号横条 (2 cols x 1 row)
  takeaways: "medium",             // 4x2 中号横条 (2 cols x 1 row)
  fast_chat: "medium",             // 4x2 中号横条 (2 cols x 1 row)
  topic_digest: "medium",          // 4x2 中号横条 (2 cols x 1 row)
  analytics_trend: "medium",       // 4x2 中号横条 (2 cols x 1 row)
  mindmap: "large",                // 4x4 大方块 (2 cols x 2 rows)
  comparison: "large",             // 4x4 大方块 (2 cols x 2 rows)
  metrics_telemetry: "small",      // 2x2 小号方块 (1 col x 1 row)
  mobile_qr: "small",              // 2x2 小号方块 (1 col x 1 row)
  followup: "small",               // 2x2 小号方块 (1 col x 1 row)
  quick_answer: "medium",          // 4x2 中号横条 (2 cols x 1 row)
  sources: "medium",               // 4x2 中号横条 (2 cols x 1 row)
  agent_workflow: "medium",        // 4x2 中号横条 (2 cols x 1 row)
  ai_overview: "large"             // 4x4 大方块 (2 cols x 2 rows)
};

/**
 * 方便地从 AdaptiveLayoutStrategy 或 WidgetPlannedItem[] 提取 Bento 输入
 * 支持将多张 Agent 自主锻造的独有小组件解构为独立桌面上的一等公民模组
 */
export function buildBentoInputs(options: {
  activeWidgets: ResultWidgetKey[];
  strategy?: AdaptiveLayoutStrategy;
  plannedWidgets?: WidgetPlannedItem[];
  customCards?: CustomCardData[];
}): BentoWidgetInput[] {
  const { activeWidgets, strategy, plannedWidgets = [], customCards = [] } = options;
  const plannedMap = new Map<ResultWidgetKey, WidgetPlannedItem>();
  plannedWidgets.forEach(pw => plannedMap.set(pw.type, pw));

  const inputs: BentoWidgetInput[] = [];

  for (const key of activeWidgets) {
    if (key === "custom_cards" && customCards.length > 0) {
      // 将多张独有卡片解构为独立的模组网格项
      customCards.forEach((card, idx) => {
        const cardKey = `custom_card__${card.id}` as ResultWidgetKey;
        const size: WidgetPlannedSize = idx === 0 
          ? (card.archetype === "timeline" || card.archetype === "parameter_matrix" ? "large" : "medium")
          : "medium";
        inputs.push({
          key: cardKey,
          priority: 110 - idx * 5,
          size,
          flexible: true,
          isEmphasized: idx === 0
        });
      });
      continue;
    }

    const planned = plannedMap.get(key);
    const reg = WIDGET_REGISTRY[key];
    const isEmphasized = key === strategy?.emphasizedWidget || key === strategy?.layoutPlan?.featured;

    let priority = planned?.priority ?? reg?.basePriority ?? 50;
    if (isEmphasized) {
      priority += 50;
    }

    let size: WidgetPlannedSize = planned?.size || DEFAULT_DESKTOP_SIZES[key] || "medium";
    // 防呆：除用户特意放大或极少数特殊全景展示外，不让小组件意外坍塌为单列全宽
    if (size === "full" && key !== "ai_overview" && key !== "comparison") {
      size = DEFAULT_DESKTOP_SIZES[key] || "medium";
    }

    const flexible = planned?.flexible ?? true;

    inputs.push({
      key,
      priority,
      size,
      flexible,
      isEmphasized
    });
  }

  return inputs;
}

// ==========================================
// 3. iOS & Android Desktop Modular Grid Solver
// 4列模组网格 (2x2 小号, 4x2 中号, 4x4 大号, 4x8 全宽) 2D 槽位重力吸附引擎
// ==========================================
export interface SolvedDesktopItem {
  key: ResultWidgetKey;
  size: WidgetPlannedSize;
  colStart: number; // 1-indexed for CSS grid
  colSpan: number; // 1, 2, or 4
  rowStart: number; // 1-indexed for CSS grid
  rowSpan: number; // 1 or 2
  isCompact: boolean;
  gridClass: string;
  style?: React.CSSProperties;
  priority: number;
  isEmphasized?: boolean;
}

export interface DesktopLayoutSolution {
  items: SolvedDesktopItem[];
  totalRows: number;
  totalColumns: number;
  gapCount: number;
}

/**
 * 根据视口/窗口长宽比例及宽度自动计算最佳横格列数 (1 ~ 5 列)
 * - 1 列: 竖屏手机 / 极窄窗口 (ratio < 0.88 或 容器宽 < 580px)
 * - 2 列: 小平板 / 分屏窗口 (0.88 <= ratio < 1.25 或 容器宽 580~900px)
 * - 3 列: 宽平板 / 中型笔记本窗口 (1.25 <= ratio < 1.62 或 容器宽 900~1240px)
 * - 4 列: 标准 16:9 / 16:10 宽屏显示器 (1.62 <= ratio < 2.05 或 容器宽 1240~1640px)
 * - 5 列: 超宽带鱼屏 21:9 / 2K/4K 广角大屏 (ratio >= 2.05 或 容器宽 >= 1640px)
 */
export function computeColumnsByWindowRatio(
  winWidth?: number,
  winHeight?: number,
  containerWidth?: number
): {
  columns: number;
  ratio: number;
  ratioLabel: string;
} {
  const w = typeof window !== "undefined" ? window.innerWidth : (winWidth || 1280);
  const h = typeof window !== "undefined" ? window.innerHeight : (winHeight || 800);
  const cw = containerWidth || w;
  const ratio = Number((w / Math.max(h, 1)).toFixed(2));

  let cols = 4;
  let ratioLabel = "16:9 宽屏";

  if (ratio < 0.88) {
    cols = 1;
    ratioLabel = "竖屏 (9:16)";
  } else if (ratio < 1.25) {
    cols = 2;
    ratioLabel = "分屏/方屏 (4:3)";
  } else if (ratio < 1.62) {
    cols = 3;
    ratioLabel = "中宽屏 (3:2)";
  } else if (ratio < 2.05) {
    cols = 4;
    ratioLabel = "标准宽屏 (16:9)";
  } else {
    cols = 5;
    ratioLabel = "超宽带鱼屏 (21:9+)";
  }

  // 物理宽度防过度挤压安全校验:
  if (cw < 580) {
    cols = 1;
  } else if (cw < 880) {
    cols = Math.min(cols, 2);
  } else if (cw < 1220) {
    cols = Math.min(cols, 3);
  } else if (cw < 1620) {
    cols = Math.min(cols, 4);
  }

  cols = Math.min(Math.max(1, cols), 5);

  return { columns: cols, ratio, ratioLabel };
}

export function getDesktopGridClass(w: number, h: number): string {
  const colClass = `col-span-${Math.min(Math.max(1, w), 5)}`;
  const rowClass = h >= 2 ? "row-span-2 min-h-[390px]" : "row-span-1 min-h-[190px]";
  return `${colClass} ${rowClass}`;
}

/**
 * iOS & Android 桌面模组 2D 空间槽位重力吸附求解器
 * 核心：建立二维空间占用矩阵 matrix[row][col]，自顶向下从左向右寻找首个无碰撞槽位
 * 实现类似 iPadOS / iOS 17+ WidgetKit 与 Android 14+ Launcher 的原生模组嵌套体验
 */
export function solveDesktopModularLayout(
  inputs: BentoWidgetInput[],
  totalColumns: number = 4
): DesktopLayoutSolution {
  if (!inputs || inputs.length === 0) {
    return { items: [], totalRows: 0, totalColumns, gapCount: 0 };
  }

  // 1. 拷贝并按优先级排序 (聚焦项最高)
  const sorted = [...inputs].sort((a, b) => {
    if (a.isEmphasized && !b.isEmphasized) return -1;
    if (!a.isEmphasized && b.isEmphasized) return 1;
    return b.priority - a.priority;
  });

  // 2. 2D 槽位占用表
  const matrix: boolean[][] = [];
  const getCell = (r: number, c: number) => {
    if (!matrix[r]) return false;
    return Boolean(matrix[r][c]);
  };
  const setCell = (r: number, c: number, val: boolean) => {
    while (matrix.length <= r) {
      matrix.push(new Array(totalColumns).fill(false));
    }
    matrix[r][c] = val;
  };

  const isSlotFree = (r: number, c: number, w: number, h: number): boolean => {
    if (c + w > totalColumns) return false;
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        if (getCell(r + i, c + j)) return false;
      }
    }
    return true;
  };

  const occupySlot = (r: number, c: number, w: number, h: number) => {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        setCell(r + i, c + j, true);
      }
    }
  };

  const solvedItems: SolvedDesktopItem[] = [];

  for (const item of sorted) {
    let w = 2;
    let h = 1;

    switch (item.size) {
      case "small":
        w = 1;
        h = 1;
        break;
      case "medium":
        w = Math.min(2, totalColumns);
        h = 1;
        break;
      case "large":
        if (totalColumns >= 5 && (item.isEmphasized || item.key === "ai_overview" || item.key === "mindmap")) {
          w = 3;
        } else {
          w = Math.min(2, totalColumns);
        }
        h = totalColumns >= 2 ? 2 : 1;
        break;
      case "full":
        w = totalColumns;
        h = (item.key === "sources" || item.key === "mindmap" || item.key === "comparison") 
          ? (totalColumns >= 2 ? 2 : 1) 
          : 1;
        break;
      default:
        w = Math.min(2, totalColumns);
        h = 1;
        break;
    }

    w = Math.min(Math.max(1, w), totalColumns);

    // 寻找从左到右、从上到下的首个无碰撞矩形插槽
    let placed = false;
    let r = 0;
    while (!placed && r < 60) {
      for (let c = 0; c < totalColumns; c++) {
        if (isSlotFree(r, c, w, h)) {
          occupySlot(r, c, w, h);
          const colStart = c + 1;
          const rowStart = r + 1;
          const isCompact = w === 1 && h === 1;
          const gridClass = getDesktopGridClass(w, h);

          solvedItems.push({
            key: item.key,
            size: item.size,
            colStart,
            colSpan: w,
            rowStart,
            rowSpan: h,
            isCompact,
            gridClass,
            style: {
              gridColumn: `span ${w} / span ${w}`,
              gridRow: `span ${h} / span ${h}`
            },
            priority: item.priority,
            isEmphasized: item.isEmphasized
          });
          placed = true;
          break;
        }
      }
      r++;
    }

    if (!placed) {
      // 容错降级放置在末行
      const fallbackRow = matrix.length;
      occupySlot(fallbackRow, 0, w, h);
      solvedItems.push({
        key: item.key,
        size: item.size,
        colStart: 1,
        colSpan: w,
        rowStart: fallbackRow + 1,
        rowSpan: h,
        isCompact: w === 1 && h === 1,
        gridClass: getDesktopGridClass(w, h),
        style: {
          gridColumn: `span ${w} / span ${w}`,
          gridRow: `span ${h} / span ${h}`
        },
        priority: item.priority,
        isEmphasized: item.isEmphasized
      });
    }
  }

  // 统计内部间隙
  let gapCount = 0;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < totalColumns; c++) {
      if (!matrix[r][c]) {
        gapCount++;
      }
    }
  }

  return {
    items: solvedItems,
    totalRows: matrix.length,
    totalColumns,
    gapCount
  };
}

