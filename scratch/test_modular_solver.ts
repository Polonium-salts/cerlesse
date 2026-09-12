import { BentoWidgetInput, SolvedDesktopItem, DesktopLayoutSolution } from "../src/lib/bentoLayoutEngine.js";

export function solveDesktopModularLayoutV2(
  inputs: BentoWidgetInput[],
  totalColumns: number = 4
): DesktopLayoutSolution {
  if (!inputs || inputs.length === 0) {
    return { items: [], totalRows: 0, totalColumns, gapCount: 0 };
  }

  // 1. 拷贝并按优先级排序 (聚焦项最高)
  const remaining = [...inputs].sort((a, b) => {
    if (a.isEmphasized && !b.isEmphasized) return -1;
    if (!a.isEmphasized && b.isEmphasized) return 1;
    return b.priority - a.priority;
  });

  // 辅助函数：根据尺寸和总列数计算期望 (w, h)
  const getDesiredDimensions = (item: BentoWidgetInput): { w: number; h: number } => {
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
    return { w, h };
  };

  // 2D 占用矩阵 matrix[row][col] -> SolvedDesktopItem | null
  const matrix: (SolvedDesktopItem | null)[][] = [];

  const getCell = (r: number, c: number): SolvedDesktopItem | null => {
    if (!matrix[r]) return null;
    return matrix[r][c] || null;
  };

  const setCell = (r: number, c: number, item: SolvedDesktopItem | null) => {
    while (matrix.length <= r) {
      matrix.push(new Array(totalColumns).fill(null));
    }
    matrix[r][c] = item;
  };

  const isSlotFree = (r: number, c: number, w: number, h: number): boolean => {
    if (c + w > totalColumns) return false;
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        if (getCell(r + i, c + j) !== null) return false;
      }
    }
    return true;
  };

  const occupySlot = (r: number, c: number, w: number, h: number, item: SolvedDesktopItem) => {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        setCell(r + i, c + j, item);
      }
    }
  };

  const getDesktopGridClass = (w: number, h: number): string => {
    const colClass = `col-span-${Math.min(Math.max(1, w), 5)}`;
    const rowClass = h >= 2 ? "row-span-2 min-h-[390px]" : "row-span-1 min-h-[190px]";
    return `${colClass} ${rowClass}`;
  };

  const solvedItems: SolvedDesktopItem[] = [];

  // 主循环：单元格逐行逐列扫描 (Cell-by-cell scan)
  let r = 0;
  while (remaining.length > 0 && r < 100) {
    for (let c = 0; c < totalColumns; c++) {
      if (getCell(r, c) !== null) {
        continue;
      }

      // 计算当前行从 c 开始的连续可用宽度
      let freeW = 0;
      while (c + freeW < totalColumns && getCell(r, c + freeW) === null) {
        freeW++;
      }

      if (freeW === 0) continue;

      // 阶段 1：寻找最契合当前空隙的组件
      // 当 c === 0 时：优先保证高优先级核心组件置顶；
      // 当 c > 0 时：前瞻寻找能完美填补当前行剩余 freeW 空穴的小组件 (Lookahead Gap-Filling)
      let bestCandidateIdx = -1;

      if (c === 0) {
        // 新行起点：选择未放置组件中优先级最高的项
        bestCandidateIdx = 0;
      } else {
        // 行内空隙：前瞻查找最契合 freeW 的组件
        let candidateMatchQuality = 0; // 2 = exact width match, 1 = partial width match
        for (let i = 0; i < remaining.length; i++) {
          const item = remaining[i];
          const dims = getDesiredDimensions(item);

          if (isSlotFree(r, c, dims.w, dims.h)) {
            if (dims.w === freeW) {
              bestCandidateIdx = i;
              candidateMatchQuality = 2;
              break; // 尺寸恰好吻合，直接选中补位
            } else if (dims.w < freeW && candidateMatchQuality < 1) {
              bestCandidateIdx = i;
              candidateMatchQuality = 1;
            }
          } else if (dims.h > 1 && isSlotFree(r, c, dims.w, 1)) {
            if (dims.w === freeW && candidateMatchQuality < 2) {
              bestCandidateIdx = i;
              candidateMatchQuality = 2;
            }
          }
        }
      }

      if (bestCandidateIdx !== -1) {
        const [chosen] = remaining.splice(bestCandidateIdx, 1);
        let dims = getDesiredDimensions(chosen);

        // 如果该组件在当前位置放不下其原本的高度，但放得下 h=1
        let actualH = dims.h;
        if (!isSlotFree(r, c, dims.w, actualH)) {
          if (isSlotFree(r, c, dims.w, 1)) {
            actualH = 1;
          } else {
            // 裁剪宽度适配
            dims.w = Math.min(dims.w, freeW);
            actualH = isSlotFree(r, c, dims.w, 2) ? 2 : 1;
          }
        }

        // 如果组件本身是 flexible 或当前行剩余空间需要完全闭合
        let actualW = dims.w;
        // 如果剩下的未放置组件已经没有了，或者这是行内最后一个槽位，并且组件可以覆盖 freeW
        if (remaining.length === 0 && actualW < freeW && chosen.flexible !== false) {
          actualW = freeW;
        }

        const solvedItem: SolvedDesktopItem = {
          key: chosen.key,
          size: chosen.size,
          colStart: c + 1,
          colSpan: actualW,
          rowStart: r + 1,
          rowSpan: actualH,
          isCompact: actualW === 1 && actualH === 1,
          gridClass: getDesktopGridClass(actualW, actualH),
          style: {
            gridColumn: `span ${actualW} / span ${actualW}`,
            gridRow: `span ${actualH} / span ${actualH}`
          },
          priority: chosen.priority,
          isEmphasized: chosen.isEmphasized
        };

        occupySlot(r, c, actualW, actualH, solvedItem);
        solvedItems.push(solvedItem);

        // 如果放置的组件宽度占用了多个列，跳过内层循环的列数
        c += actualW - 1;
      } else {
        // 阶段 2：未找到能放入当前 freeW 空隙的组件
        // 缝隙自适应闭合 (Zero-Gap Closure):
        // 检查左侧相邻组件：如果存在同行的左侧组件，让其水平向右延伸吸收该 freeW 留白！
        const leftNeighbor = c > 0 ? getCell(r, c - 1) : null;
        if (leftNeighbor && leftNeighbor.rowStart === r + 1 && leftNeighbor.rowSpan === 1) {
          // 左侧组件仅占当前行，直接向右伸展
          const prevColSpan = leftNeighbor.colSpan;
          const nextColSpan = Math.min(prevColSpan + freeW, totalColumns);
          leftNeighbor.colSpan = nextColSpan;
          leftNeighbor.isCompact = nextColSpan === 1 && leftNeighbor.rowSpan === 1;
          leftNeighbor.gridClass = getDesktopGridClass(nextColSpan, leftNeighbor.rowSpan);
          leftNeighbor.style = {
            gridColumn: `span ${nextColSpan} / span ${nextColSpan}`,
            gridRow: `span ${leftNeighbor.rowSpan} / span ${leftNeighbor.rowSpan}`
          };
          occupySlot(r, c, freeW, 1, leftNeighbor);
          c += freeW - 1;
        } else if (remaining.length > 0) {
          // 如果左侧无法扩展，而队列中还有组件，将下一个组件宽度自适应压缩为 freeW 放入当前空隙！
          const [forced] = remaining.splice(0, 1);
          const actualW = freeW;
          const actualH = 1;
          const solvedItem: SolvedDesktopItem = {
            key: forced.key,
            size: forced.size,
            colStart: c + 1,
            colSpan: actualW,
            rowStart: r + 1,
            rowSpan: actualH,
            isCompact: actualW === 1 && actualH === 1,
            gridClass: getDesktopGridClass(actualW, actualH),
            style: {
              gridColumn: `span ${actualW} / span ${actualW}`,
              gridRow: `span ${actualH} / span ${actualH}`
            },
            priority: forced.priority,
            isEmphasized: forced.isEmphasized
          };
          occupySlot(r, c, actualW, actualH, solvedItem);
          solvedItems.push(solvedItem);
          c += actualW - 1;
        }
      }
    }
    r++;
  }

  // 阶段 3：末尾留白收尾检查 (Final Row Zero-Gap Sweep)
  // 检查所有行的内部与末尾，如果存在未被占用的单元格，进行弹性延伸补齐
  for (let rowIdx = 0; rowIdx < matrix.length; rowIdx++) {
    for (let colIdx = 0; colIdx < totalColumns; colIdx++) {
      if (matrix[rowIdx][colIdx] === null) {
        // 计算从 colIdx 开始连续空槽
        let emptyW = 0;
        while (colIdx + emptyW < totalColumns && matrix[rowIdx][colIdx + emptyW] === null) {
          emptyW++;
        }

        // 寻找该行左侧最近的组件进行水平向右填充
        let leftItem: SolvedDesktopItem | null = null;
        for (let checkCol = colIdx - 1; checkCol >= 0; checkCol--) {
          if (matrix[rowIdx][checkCol]) {
            leftItem = matrix[rowIdx][checkCol];
            break;
          }
        }

        if (leftItem) {
          // 延伸 leftItem
          leftItem.colSpan += emptyW;
          leftItem.isCompact = leftItem.colSpan === 1 && leftItem.rowSpan === 1;
          leftItem.gridClass = getDesktopGridClass(leftItem.colSpan, leftItem.rowSpan);
          leftItem.style = {
            gridColumn: `span ${leftItem.colSpan} / span ${leftItem.colSpan}`,
            gridRow: `span ${leftItem.rowSpan} / span ${leftItem.rowSpan}`
          };
          for (let k = 0; k < emptyW; k++) {
            matrix[rowIdx][colIdx + k] = leftItem;
          }
        }
        colIdx += emptyW - 1;
      }
    }
  }

  // 统计间隙 (Gap Count)
  let gapCount = 0;
  for (let rowIdx = 0; rowIdx < matrix.length; rowIdx++) {
    for (let colIdx = 0; colIdx < totalColumns; colIdx++) {
      if (!matrix[rowIdx][colIdx]) {
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

const testInputs: BentoWidgetInput[] = [
  { key: "ai_overview", priority: 120, size: "large", isEmphasized: true },
  { key: "quick_answer", priority: 110, size: "medium" },
  { key: "custom_cards", priority: 105, size: "medium" },
  { key: "takeaways", priority: 100, size: "medium" },
  { key: "actions_toolbox", priority: 95, size: "medium" },
  { key: "metrics_telemetry", priority: 90, size: "small" },
  { key: "followup", priority: 85, size: "small" },
  { key: "sources", priority: 80, size: "full" },
];

for (let cols = 1; cols <= 5; cols++) {
  console.log(`\n=== Testing V2 with ${cols} Columns ===`);
  const solution = solveDesktopModularLayoutV2(testInputs, cols);
  console.log(`Total rows: ${solution.totalRows}, Items: ${solution.items.length}, Gap count: ${solution.gapCount}`);
  solution.items.forEach(item => {
    console.log(`  ${item.key}: w=${item.colSpan} h=${item.rowSpan} at (r=${item.rowStart}, c=${item.colStart})`);
  });
}
