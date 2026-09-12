import { BentoWidgetInput } from "../src/lib/bentoLayoutEngine.js";

function testSolver(inputs: BentoWidgetInput[], totalColumns: number = 4) {
  if (!inputs || inputs.length === 0) {
    return { items: [], totalRows: 0, totalColumns, gapCount: 0 };
  }

  const sorted = [...inputs].sort((a, b) => {
    if (a.isEmphasized && !b.isEmphasized) return -1;
    if (!a.isEmphasized && b.isEmphasized) return 1;
    return b.priority - a.priority;
  });

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

  const solvedItems: any[] = [];

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

    let placed = false;
    let r = 0;
    while (!placed && r < 60) {
      for (let c = 0; c < totalColumns; c++) {
        if (isSlotFree(r, c, w, h)) {
          occupySlot(r, c, w, h);
          const colStart = c + 1;
          const rowStart = r + 1;
          const isCompact = w === 1 && h === 1;

          solvedItems.push({
            key: item.key,
            size: item.size,
            colStart,
            colSpan: w,
            rowStart,
            rowSpan: h,
            isCompact,
            gridClass: `col-span-${w} row-span-${h}`,
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
        gridClass: `col-span-${w} row-span-${h}`,
        priority: item.priority,
        isEmphasized: item.isEmphasized
      });
    }
  }

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
  console.log(`\n=== Testing ${cols} Columns ===`);
  const solution = testSolver(testInputs, cols);
  console.log(`Total rows: ${solution.totalRows}, Items: ${solution.items.length}, Gap count: ${solution.gapCount}`);
  solution.items.forEach(item => {
    console.log(`  ${item.key}: w=${item.colSpan} h=${item.rowSpan} at (r=${item.rowStart}, c=${item.colStart})`);
  });
}
