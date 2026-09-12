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

  // 二维占用布尔表 matrix[y][x] -> SolvedTileItem | null
  const matrix: (SolvedTileItem | null)[][] = [];

  const getCell = (y: number, x: number): SolvedTileItem | null => {
    if (!matrix[y]) return null;
    return matrix[y][x] || null;
  };

  const setCell = (y: number, x: number, item: SolvedTileItem | null) => {
    while (matrix.length <= y) {
      matrix.push(new Array(totalColumns).fill(null));
    }
    matrix[y][x] = item;
  };

  const isSlotFree = (y: number, x: number, w: number, h: number): boolean => {
    if (x + w > totalColumns) return false;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (getCell(y + r, x + c) !== null) return false;
      }
    }
    return true;
  };

  const occupySlot = (y: number, x: number, w: number, h: number, item: SolvedTileItem) => {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        setCell(y + r, x + c, item);
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
    const item: SolvedTileItem = {
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
    };
    occupySlot(y, x, clampedW, h, item);
    solved.push(item);
  }

  // 2. 排序待自动重力吸附放置的磁贴：聚焦项优先，优先级高的优先
  const fixedIds = new Set(fixedTiles.map(t => t.id));
  const remainingAutoTiles = inputs
    .filter(t => !fixedIds.has(t.id))
    .sort((a, b) => {
      if (a.isEmphasized && !b.isEmphasized) return -1;
      if (!a.isEmphasized && b.isEmphasized) return 1;
      return (b.priority ?? 50) - (a.priority ?? 50);
    });

  // 3. 单元格二维紧凑吸附扫描 (Cell-by-cell Gravity Bin-Packing with Lookahead & Elastic Stretch)
  let y = 0;
  const maxSearchRows = 100;

  while (remainingAutoTiles.length > 0 && y < maxSearchRows) {
    for (let x = 0; x < totalColumns; x++) {
      if (getCell(y, x) !== null) {
        continue;
      }

      // 计算当前行从 x 开始的连续空闲列数
      let freeW = 0;
      while (x + freeW < totalColumns && getCell(y, x + freeW) === null) {
        freeW++;
      }

      if (freeW === 0) continue;

      // 阶段 1：寻找候选磁贴
      let bestCandidateIdx = -1;

      if (x === 0) {
        // 行首：优先放置待放置队列中优先级最高项
        bestCandidateIdx = 0;
      } else {
        // 行内空隙：前瞻查找能填补 freeW 的最佳磁贴 (Lookahead Hole Plugging)
        let candidateMatchQuality = 0; // 2 = exact width, 1 = partial width
        for (let i = 0; i < remainingAutoTiles.length; i++) {
          const t = remainingAutoTiles[i];
          const dims = getTileDimensions(t.size, totalColumns);
          const clampedW = Math.min(dims.w, totalColumns);

          if (isSlotFree(y, x, clampedW, dims.h)) {
            if (clampedW === freeW) {
              bestCandidateIdx = i;
              candidateMatchQuality = 2;
              break; // 宽度精确对齐，优先填入
            } else if (clampedW < freeW && candidateMatchQuality < 1) {
              bestCandidateIdx = i;
              candidateMatchQuality = 1;
            }
          } else if (dims.h > 2 && isSlotFree(y, x, clampedW, 2)) {
            // 高度可降级为 2 槽位
            if (clampedW === freeW && candidateMatchQuality < 2) {
              bestCandidateIdx = i;
              candidateMatchQuality = 2;
            }
          }
        }
      }

      if (bestCandidateIdx !== -1) {
        const [chosen] = remainingAutoTiles.splice(bestCandidateIdx, 1);
        const dims = getTileDimensions(chosen.size, totalColumns);
        let actualW = Math.min(dims.w, totalColumns);
        let actualH = dims.h;

        // 如果宽度超出当前行剩余空间，自适应压缩宽度以适应
        if (!isSlotFree(y, x, actualW, actualH)) {
          if (isSlotFree(y, x, actualW, 2)) {
            actualH = 2;
          } else {
            actualW = Math.min(actualW, freeW);
            actualH = isSlotFree(y, x, actualW, 2) ? 2 : 1;
          }
        }

        // 如果这是最后一个磁贴且还有剩余列空间，自动扩展占满整行
        if (remainingAutoTiles.length === 0 && actualW < freeW) {
          actualW = freeW;
        }

        const item: SolvedTileItem = {
          id: chosen.id,
          size: chosen.size,
          x,
          y,
          w: actualW,
          h: actualH,
          isEmphasized: chosen.isEmphasized,
          priority: chosen.priority ?? 50,
          gridStyle: {
            gridColumn: `${x + 1} / span ${actualW}`,
            gridRow: `${y + 1} / span ${actualH}`
          }
        };

        occupySlot(y, x, actualW, actualH, item);
        solved.push(item);
        x += actualW - 1;
      } else {
        // 阶段 2：未找到合适磁贴，行内横向弹性延伸消除空隙
        const leftNeighbor = x > 0 ? getCell(y, x - 1) : null;
        if (leftNeighbor && leftNeighbor.y === y && isSlotFree(y, x, freeW, leftNeighbor.h)) {
          // 左侧磁贴高度允许延伸
          leftNeighbor.w += freeW;
          leftNeighbor.gridStyle.gridColumn = `${leftNeighbor.x + 1} / span ${leftNeighbor.w}`;
          occupySlot(y, x, freeW, leftNeighbor.h, leftNeighbor);
          x += freeW - 1;
        } else if (remainingAutoTiles.length > 0) {
          // 强制适配当前尺寸放入下一个磁贴
          const [forced] = remainingAutoTiles.splice(0, 1);
          const actualW = freeW;
          const actualH = 2;
          const item: SolvedTileItem = {
            id: forced.id,
            size: forced.size,
            x,
            y,
            w: actualW,
            h: actualH,
            isEmphasized: forced.isEmphasized,
            priority: forced.priority ?? 50,
            gridStyle: {
              gridColumn: `${x + 1} / span ${actualW}`,
              gridRow: `${y + 1} / span ${actualH}`
            }
          };
          occupySlot(y, x, actualW, actualH, item);
          solved.push(item);
          x += actualW - 1;
        }
      }
    }
    y++;
  }

  // 阶段 3：末尾留白全网格消除清扫 (Zero-Gap Sweep)
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < totalColumns; c++) {
      if (matrix[r][c] === null) {
        let emptyW = 0;
        while (c + emptyW < totalColumns && matrix[r][c + emptyW] === null) {
          emptyW++;
        }

        // 寻找同行左侧磁贴拉伸
        let leftTile: SolvedTileItem | null = null;
        for (let checkCol = c - 1; checkCol >= 0; checkCol--) {
          if (matrix[r][checkCol]) {
            leftTile = matrix[r][checkCol];
            break;
          }
        }

        if (leftTile) {
          leftTile.w += emptyW;
          leftTile.gridStyle.gridColumn = `${leftTile.x + 1} / span ${leftTile.w}`;
          for (let k = 0; k < emptyW; k++) {
            matrix[r][c + k] = leftTile;
          }
        }
        c += emptyW - 1;
      }
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
