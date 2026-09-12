/**
 * TileLayoutEngine - Windows Phone 风格二维 12 栅格磁贴布局引擎
 *
 * 核心原理：
 * 1. 标准离散磁贴尺寸：
 *    - small:  2 宽 × 2 高 (正方小磁贴，如天气、时钟、股票简报)
 *    - medium: 4 宽 × 2 高 (标准横条，如日历待办、音乐卡、要点摘要)
 *    - wide:   6 宽 × 2 高 (宽条磁贴，如快捷动作箱、信源精选)
 *    - large:  4 宽 × 4 高 (正方大磁贴，如深度研报概览、思维导图、全尺寸对比)
 *    - full:   12 宽 × 4 高 (全宽画卷横幅)
 * 2. 二维占用矩阵 matrix[y][x]，自顶向下从左向右紧凑装箱 (Gravity Bin-Packing)，杜绝空隙；
 * 3. 支持桌面端 12 列原生坐标，中屏 (6 列) 与窄屏 (4/2 列) 比例折算映射；
 * 4. 支持桌面坐标显式存储与持久化 (Desktop Layout State)。
 */

export type TileSize = "small" | "medium" | "wide" | "large" | "full";

export interface TileDimensions {
  w: number; // 列跨度 (Columns Span)
  h: number; // 行跨度 (Rows Span)
}

export interface TileLayoutInput {
  id: string;
  size: TileSize;
  priority?: number;
  isEmphasized?: boolean;
  x?: number; // 可选的显式指定坐标
  y?: number;
  fixedPosition?: boolean;
}

export interface SolvedTileItem {
  id: string;
  size: TileSize;
  x: number; // 0-indexed column
  y: number; // 0-indexed row
  w: number; // column span
  h: number; // row span
  isEmphasized?: boolean;
  priority: number;
  gridStyle: {
    gridColumn: string;
    gridRow: string;
  };
}

export interface TileLayoutSolution {
  items: SolvedTileItem[];
  totalColumns: number;
  totalRows: number;
  gapCount: number;
}

/**
 * 根据总列数与语义尺寸换算磁贴物理占格 (w, h)
 */
export function getTileDimensions(size: TileSize, totalColumns: number = 12): TileDimensions {
  if (totalColumns >= 12) {
    switch (size) {
      case "small":
        return { w: 2, h: 2 };
      case "medium":
        return { w: 4, h: 2 };
      case "wide":
        return { w: 6, h: 2 };
      case "large":
        return { w: 4, h: 4 };
      case "full":
        return { w: 12, h: 4 };
      default:
        return { w: 4, h: 2 };
    }
  }

  // 6 列自适应模式 (平板 / 中屏)
  if (totalColumns >= 6) {
    switch (size) {
      case "small":
        return { w: 2, h: 2 };
      case "medium":
        return { w: 3, h: 2 };
      case "wide":
        return { w: 6, h: 2 };
      case "large":
        return { w: 3, h: 4 };
      case "full":
        return { w: 6, h: 4 };
      default:
        return { w: 3, h: 2 };
    }
  }

  // 4 列或更窄模式 (移动端 / 极窄分屏)
  switch (size) {
    case "small":
      return { w: 2, h: 2 };
    case "medium":
    case "wide":
      return { w: Math.min(4, totalColumns), h: 2 };
    case "large":
    case "full":
      return { w: totalColumns, h: 4 };
    default:
      return { w: Math.min(2, totalColumns), h: 2 };
  }
}

/**
 * 二维 12 栅格重力装箱算法 (Gravity Packing Solver)
 */
export function solveTileLayout(
  inputs: TileLayoutInput[],
  totalColumns: number = 12
): TileLayoutSolution {
  if (!inputs || inputs.length === 0) {
    return { items: [], totalColumns, totalRows: 0, gapCount: 0 };
  }

  // 二维占用布尔表 matrix[y][x]
  const matrix: boolean[][] = [];

  const getCell = (y: number, x: number): boolean => {
    if (!matrix[y]) return false;
    return Boolean(matrix[y][x]);
  };

  const setCell = (y: number, x: number, val: boolean) => {
    while (matrix.length <= y) {
      matrix.push(new Array(totalColumns).fill(false));
    }
    matrix[y][x] = val;
  };

  const isSlotFree = (y: number, x: number, w: number, h: number): boolean => {
    if (x + w > totalColumns) return false;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (getCell(y + r, x + c)) return false;
      }
    }
    return true;
  };

  const occupySlot = (y: number, x: number, w: number, h: number) => {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        setCell(y + r, x + c, true);
      }
    }
  };

  const solved: SolvedTileItem[] = [];

  // 1. 先放置显式指定固定坐标的磁贴 (Fixed Position Tiles)
  const fixedTiles = inputs.filter(t => t.fixedPosition && t.x !== undefined && t.y !== undefined);
  for (const t of fixedTiles) {
    const { w, h } = getTileDimensions(t.size, totalColumns);
    const clampedW = Math.min(w, totalColumns);
    const x = Math.min(t.x!, totalColumns - clampedW);
    const y = t.y!;
    occupySlot(y, x, clampedW, h);
    solved.push({
      id: t.id,
      size: t.size,
      x,
      y,
      w: clampedW,
      h,
      isEmphasized: t.isEmphasized,
      priority: t.priority ?? 50,
      gridStyle: {
        gridColumn: `${x + 1} / span ${clampedW}`,
        gridRow: `${y + 1} / span ${h}`
      }
    });
  }

  // 2. 排序待自动重力吸附放置的磁贴：聚焦项优先，优先级高的优先
  const fixedIds = new Set(fixedTiles.map(t => t.id));
  const autoTiles = inputs
    .filter(t => !fixedIds.has(t.id))
    .sort((a, b) => {
      if (a.isEmphasized && !b.isEmphasized) return -1;
      if (!a.isEmphasized && b.isEmphasized) return 1;
      return (b.priority ?? 50) - (a.priority ?? 50);
    });

  // 3. 逐个搜寻最顶最左无碰撞空位
  for (const t of autoTiles) {
    const { w, h } = getTileDimensions(t.size, totalColumns);
    const clampedW = Math.min(w, totalColumns);

    let placed = false;
    let y = 0;
    const maxSearchRows = 100;

    while (!placed && y < maxSearchRows) {
      for (let x = 0; x <= totalColumns - clampedW; x++) {
        if (isSlotFree(y, x, clampedW, h)) {
          occupySlot(y, x, clampedW, h);
          solved.push({
            id: t.id,
            size: t.size,
            x,
            y,
            w: clampedW,
            h,
            isEmphasized: t.isEmphasized,
            priority: t.priority ?? 50,
            gridStyle: {
              gridColumn: `${x + 1} / span ${clampedW}`,
              gridRow: `${y + 1} / span ${h}`
            }
          });
          placed = true;
          break;
        }
      }
      y++;
    }

    if (!placed) {
      // 容错底部开辟新行放置
      const fallbackY = matrix.length;
      occupySlot(fallbackY, 0, clampedW, h);
      solved.push({
        id: t.id,
        size: t.size,
        x: 0,
        y: fallbackY,
        w: clampedW,
        h,
        isEmphasized: t.isEmphasized,
        priority: t.priority ?? 50,
        gridStyle: {
          gridColumn: `1 / span ${clampedW}`,
          gridRow: `${fallbackY + 1} / span ${h}`
        }
      });
    }
  }

  // 4. 统计内部间隙
  let gapCount = 0;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < totalColumns; c++) {
      if (!matrix[r] || !matrix[r][c]) {
        gapCount++;
      }
    }
  }

  return {
    items: solved,
    totalColumns,
    totalRows: matrix.length,
    gapCount
  };
}

/**
 * 桌面状态本地持久化辅助
 */
const DESKTOP_STORAGE_KEY = "cerlesse_tile_desktop_v1";

export interface StoredDesktopState {
  version: number;
  timestamp: number;
  tiles: Array<{
    id: string;
    size: TileSize;
    x: number;
    y: number;
  }>;
}

export function saveDesktopState(items: SolvedTileItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDesktopState = {
      version: 1,
      timestamp: Date.now(),
      tiles: items.map(item => ({
        id: item.id,
        size: item.size,
        x: item.x,
        y: item.y
      }))
    };
    localStorage.setItem(DESKTOP_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to persist desktop tile state:", e);
  }
}

export function loadDesktopState(): StoredDesktopState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DESKTOP_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDesktopState;
  } catch {
    return null;
  }
}

export function clearDesktopState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DESKTOP_STORAGE_KEY);
  } catch {}
}
