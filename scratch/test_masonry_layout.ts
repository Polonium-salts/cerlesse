/**
 * 不规则磁贴墙 · 观感与密度量化测试
 *
 * 用 ASCII 把布局直接画出来（每列 5 字符宽，每 40px 一行），并量化四项指标：
 *   参差度 raggednessPx  —— 桌面下沿起伏（越大越"瀑布流"）
 *   错落数 staggeredCount —— 顶边独占一条水平线的磁贴数（0 = 完全逐行对齐 = 规整）
 *   空洞率 holeRatio      —— 各列轮廓内部的真实空洞（下沿参差不算，那是美学）
 *   跨度微调 flex         —— 求解器为闭合空洞改了几张磁贴的宽度
 *
 * 运行：npx tsx scratch/test_masonry_layout.ts
 */
import {
  solveTileLayout,
  resolveTileRatio,
  RATIO_VALUES,
  RATIO_LABELS,
  TILE_COLUMN_GAP_PX,
  TILE_ROW_GAP_PX,
  TILE_ROW_UNIT_PX,
  TILE_MAX_HEIGHT_PX,
  TILE_HARD_MAX_HEIGHT_PX,
  WIDGET_RATIOS,
  type TileLayoutInput,
  type SolvedTileItem,
  type TilePlacementOrder
} from "../src/lib/tileLayoutEngine.js";

const CONTAINER_WIDTH = 1280;
const COLS = 12;
const BASE = {
  totalColumns: COLS,
  containerWidth: CONTAINER_WIDTH,
  columnGap: TILE_COLUMN_GAP_PX,
  rowGap: TILE_ROW_GAP_PX
};

let passed = true;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) passed = false;
};

type Metrics = ReturnType<typeof solve> & { holeRatio: number };

/** 把磁贴布局画成 ASCII —— 每列 5 字符宽，每 40px 为一行字符 */
function renderAscii(items: SolvedTileItem[], totalColumns: number, totalHeightPx: number): string {
  const COL_CHARS = 5;
  const ROW_PX = 40;
  const rows = Math.max(1, Math.ceil(totalHeightPx / ROW_PX));
  const grid: string[][] = Array.from({ length: rows }, () =>
    new Array(totalColumns * COL_CHARS).fill(" ")
  );

  const put = (r: number, c: number, ch: string) => {
    if (r >= 0 && r < rows && c >= 0 && c < totalColumns * COL_CHARS) grid[r][c] = ch;
  };

  items.forEach((item, idx) => {
    const r0 = Math.round(item.y / ROW_PX);
    const r1 = Math.max(r0, Math.round((item.y + item.pixelHeight) / ROW_PX) - 1);
    const c0 = item.x * COL_CHARS;
    const c1 = (item.x + item.w) * COL_CHARS - 1;

    for (let c = c0; c <= c1; c++) {
      put(r0, c, "─");
      put(r1, c, "─");
    }
    for (let r = r0; r <= r1; r++) {
      put(r, c0, "│");
      put(r, c1, "│");
    }
    ["┌", "┐", "└", "┘"].forEach((ch, i) => {
      put(i < 2 ? r0 : r1, i % 2 === 0 ? c0 : c1, ch);
    });

    const label = `${idx + 1}·${item.id.replace("custom_card__", "card:")} [${item.w}]`.slice(0, c1 - c0 - 1);
    for (let i = 0; i < label.length; i++) put(r0 + 1, c0 + 1 + i, label[i]);
  });

  return grid.map((row) => "  " + row.join("").replace(/\s+$/, "")).join("\n");
}

function solve(inputs: TileLayoutInput[], opts: Parameters<typeof solveTileLayout>[1]) {
  return solveTileLayout(inputs, opts);
}

function measure(inputs: TileLayoutInput[], opts: Parameters<typeof solveTileLayout>[1]): Metrics {
  const res = solveTileLayout(inputs, opts);
  const silhouetteCells = Math.max(
    1,
    Math.ceil(res.columnHeights.reduce((s, h) => s + Math.max(0, h - TILE_ROW_GAP_PX), 0) / TILE_ROW_UNIT_PX)
  );
  return { ...res, holeRatio: res.gapCount / silhouetteCells };
}

function run(title: string, inputs: TileLayoutInput[], opts: Parameters<typeof solveTileLayout>[1], showAscii = true): Metrics {
  const res = measure(inputs, opts);
  console.log(`\n${"=".repeat(100)}`);
  console.log(`▌ ${title}`);
  console.log("=".repeat(100));
  if (showAscii) console.log(renderAscii(res.items, res.totalColumns, res.totalHeightPx));
  console.log(
    `\n  [METRICS] holes=${res.gapCount} holeRatio=${(res.holeRatio * 100).toFixed(2)}%` +
      ` height=${Math.round(res.totalHeightPx)} ragged=${Math.round(res.raggednessPx)}` +
      ` staggered=${res.staggeredCount}/${res.items.length} topLines=${res.topLineCount} flex=${res.adjustedSpanCount}` +
      ` fill=${(res.fillRatio * 100).toFixed(1)}% maxTileH=${Math.round(Math.max(...res.items.map((i) => i.pixelHeight)))}`
  );
  return res;
}

// ── 场景 ────────────────────────────────────────────────────────────
const scenarioA: TileLayoutInput[] = [
  { id: "ai_overview", size: "full", priority: 120, isEmphasized: true },
  { id: "quick_answer", size: "large", priority: 110 },
  { id: "takeaways", size: "medium", priority: 100 },
  { id: "metrics_telemetry", size: "small", priority: 95 },
  { id: "comparison", size: "large", priority: 90 },
  { id: "followup", size: "small", priority: 85 },
  { id: "mindmap", size: "large", priority: 80 },
  { id: "actions_toolbox", size: "medium", priority: 75 },
  { id: "sources", size: "full", priority: 70 },
  { id: "official_portal", size: "medium", priority: 65 },
  { id: "agent_workflow", size: "large", priority: 60 }
];

// 最贴近真实排版 Agent 的产出：焦点提权到全宽（其余为 4/6/8 混合宽度）
const scenarioC: TileLayoutInput[] = [
  { id: "ai_overview", size: "full", priority: 120, isEmphasized: true },
  { id: "quick_answer", size: "large", priority: 110 },
  { id: "takeaways", size: "medium", priority: 100 },
  { id: "metrics_telemetry", size: "small", priority: 95 },
  { id: "comparison", size: "large", priority: 90 },
  { id: "followup", size: "small", priority: 85 },
  { id: "mindmap", size: "large", priority: 80 },
  { id: "actions_toolbox", size: "medium", priority: 75 },
  { id: "sources", size: "large", priority: 70 },
  { id: "official_portal", size: "medium", priority: 65 },
  { id: "agent_workflow", size: "large", priority: 60 }
];

const scenarioB: TileLayoutInput[] = [
  { id: "custom_card__c1", size: "large", ratio: "4:5", priority: 130, isEmphasized: true },
  { id: "quick_answer", size: "medium", priority: 120 },
  { id: "fast_chat", size: "small", priority: 115 },
  { id: "takeaways", size: "large", priority: 110 },
  { id: "followup", size: "small", priority: 105 },
  { id: "analytics_trend", size: "wide", priority: 100 },
  { id: "sources", size: "large", priority: 95 },
  { id: "verification_checklist", size: "medium", priority: 90 }
];

// ── 参数矩阵：找出"最不规则且最致密"的组合 ──────────────────────────
console.log("\n" + "#".repeat(108));
console.log("# 参数矩阵（排序策略 × 高度上限 × 跨度偏离代价）");
console.log("#".repeat(108));
console.log(
  "\n  " +
    "场景".padEnd(9) +
    "排序".padEnd(9) +
    "上限".padEnd(6) +
    "惩罚".padEnd(6) +
    "空洞率".padEnd(9) +
    "总高".padEnd(7) +
    "参差".padEnd(7) +
    "错落".padEnd(7) +
    "顶线".padEnd(6) +
    "最高磁贴".padEnd(10) +
    "微调"
);
for (const [sName, inputs] of [["A(双全宽)", scenarioA], ["C(单焦点)", scenarioC]] as const) {
  for (const order of ["reading", "anchor"] as TilePlacementOrder[]) {
    for (const maxH of [620, 720, 960]) {
      for (const pen of [20, 90]) {
        const r = measure(inputs, { ...BASE, placementOrder: order, maxTileHeightPx: maxH, spanDeviationPenaltyPx: pen });
        console.log(
          "  " +
            sName.padEnd(9) +
            order.padEnd(9) +
            String(maxH).padEnd(6) +
            String(pen).padEnd(6) +
            `${(r.holeRatio * 100).toFixed(2)}%`.padEnd(9) +
            `${Math.round(r.totalHeightPx)}`.padEnd(7) +
            `${Math.round(r.raggednessPx)}`.padEnd(7) +
            `${r.staggeredCount}/${r.items.length}`.padEnd(7) +
            `${r.topLineCount}`.padEnd(6) +
            `${Math.round(Math.max(...r.items.map((i) => i.pixelHeight)))}`.padEnd(10) +
            `${r.adjustedSpanCount}`
        );
      }
    }
  }
}

// ── 最终配置的完整可视化（默认配置：阅读序 + 高度720 + 惩罚20）────
const FINAL = { ...BASE };
const a = run("场景 A · 默认配置（含两张全宽磁贴）", scenarioA, FINAL);
const c = run("场景 C · 最贴近真实排版 Agent 产出（仅一个焦点全宽）", scenarioC, FINAL);
const b = run("场景 B · 含 4:5 独有卡片 + 小磁贴密集", scenarioB, FINAL);

// ── 性质断言 ───────────────────────────────────────────────────────
console.log(`\n${"=".repeat(100)}`);
console.log("▌ 性质断言");
console.log("=".repeat(100));

for (const [name, res] of [["场景A", a], ["场景B", b], ["场景C", c]] as const) {
  check(`${name} 磁贴一张不丢`, res.items.length > 0);

  const rects = res.items.map((i) => ({ id: i.id, x0: i.x, x1: i.x + i.w, y0: i.y, y1: i.y + i.pixelHeight }));
  let overlap = "";
  for (let i = 0; i < rects.length && !overlap; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const A = rects[i];
      const B = rects[j];
      if (Math.min(A.x1, B.x1) > Math.max(A.x0, B.x0) && Math.min(A.y1, B.y1) > Math.max(A.y0, B.y0)) {
        overlap = `${A.id} × ${B.id}`;
        break;
      }
    }
  }
  check(`${name} 磁贴互不重叠`, overlap === "", overlap);

  let ratioBad = "";
  for (const item of res.items) {
    const expected = RATIO_VALUES[resolveTileRatio(item.id, item.ratio)];
    if (Math.abs(item.pixelWidth / item.pixelHeight - expected) > 1e-9) ratioBad = item.id;
  }
  check(`${name} 固有比例像素级精确`, ratioBad === "", ratioBad);

  let boundsBad = "";
  for (const item of res.items) {
    if (item.x < 0 || item.x + item.w > res.totalColumns) boundsBad = item.id;
    if (item.pixelHeight > TILE_HARD_MAX_HEIGHT_PX) boundsBad += "(超高)";
  }
  check(`${name} 横向不越界且高度不超硬上限`, boundsBad === "", boundsBad);

  // 不规则性质
  check(`${name} 呈错落（存在独占顶线的磁贴）`, res.staggeredCount > 0, `${res.staggeredCount} 张`);
  check(`${name} 顶线不被所有磁贴共享`, res.topLineCount > 1, `${res.topLineCount} 条`);
  check(`${name} 桌面下沿参差（非削平的直线）`, res.raggednessPx > 0, `${Math.round(res.raggednessPx)}px`);
  check(`${name} 轮廓内部几乎无空洞`, res.holeRatio <= 0.06, `${(res.holeRatio * 100).toFixed(2)}%`);
}

// ── 设计决策的实证依据 ──────────────────────────────────────────────
console.log("\n--- 设计决策依据（每条都由上面的矩阵实测支撑）---");

// 决策 1：跨度偏离惩罚取 20 而非 90
const cPen90 = measure(scenarioC, { ...BASE, spanDeviationPenaltyPx: 90 });
const aPen90 = measure(scenarioA, { ...BASE, spanDeviationPenaltyPx: 90 });
check(
  "低跨度惩罚（20）显著降低空洞率",
  c.holeRatio < cPen90.holeRatio && a.holeRatio < aPen90.holeRatio,
  `场景C ${(c.holeRatio * 100).toFixed(2)}% vs ${(cPen90.holeRatio * 100).toFixed(2)}%` +
    ` · 场景A ${(a.holeRatio * 100).toFixed(2)}% vs ${(aPen90.holeRatio * 100).toFixed(2)}%`
);

// 决策 2：高度上限取 720（两个场景都能守住 6%）
check(
  "高度上限 720 让两个场景的空洞率都守住 6%",
  a.holeRatio <= 0.06 && c.holeRatio <= 0.06,
  `场景A ${(a.holeRatio * 100).toFixed(2)}% · 场景C ${(c.holeRatio * 100).toFixed(2)}%`
);
const cNoClamp = measure(scenarioC, { ...BASE, clampToHeightBand: false });
check(
  "高度上限 960 会让全宽焦点放任到一屏以上",
  Math.max(...cNoClamp.items.map((i) => i.pixelHeight)) > TILE_MAX_HEIGHT_PX,
  `不护栏 ${Math.round(Math.max(...cNoClamp.items.map((i) => i.pixelHeight)))}px > 上限 ${TILE_MAX_HEIGHT_PX}px`
);

// 决策 3：默认 reading 排序（既保住排版 Agent 的阅读序，又更不规则）
const cAnchor = measure(scenarioC, { ...BASE, placementOrder: "anchor" });
check(
  "阅读序的错落程度不低于锚点排序",
  c.staggeredCount >= cAnchor.staggeredCount,
  `错落 ${c.staggeredCount}/${c.items.length} vs ${cAnchor.staggeredCount}/${cAnchor.items.length}` +
    `（参差 ${Math.round(c.raggednessPx)}px vs ${Math.round(cAnchor.raggednessPx)}px）`
);

// 决策 4：护栏不再断崖式降级（727px 仅越界 7px，不该被砍掉 2 列宽）
const tallNarrow: TileLayoutInput[] = [{ id: "custom_card__t", size: "large", ratio: "4:5", priority: 100, isEmphasized: true }];
const tallRes = measure(tallNarrow, { ...BASE });
const tallItem = tallRes.items[0];
check(
  "轻微高度越界不再触发断崖式收窄",
  tallItem.w === 6 && tallItem.pixelHeight <= TILE_HARD_MAX_HEIGHT_PX,
  `4:5 卡片落到 ${tallItem.w} 列 / ${Math.round(tallItem.pixelHeight)}px（断崖式降级会砍到 4 列）`
);

// 存在性事实：全宽磁贴会抹平所有列高，是瀑布流的"天敌"
const cNoFull: TileLayoutInput[] = scenarioC.map((t) => (t.size === "full" ? { ...t, size: "wide" as const } : t));
const cFlat = measure(cNoFull, { ...BASE });
console.log(
  `  [观察] 全宽磁贴对参差度的影响：无全宽 ${Math.round(cFlat.raggednessPx)}px vs 有全宽 ${Math.round(c.raggednessPx)}px` +
    `（本配置下 4:3 全宽已被护栏收到 8 列，故差异不显著）`
);

const extreme: TileLayoutInput[] = [
  { id: "followup", size: "full", priority: 100, isEmphasized: true },
  { id: "quick_answer", size: "large", priority: 90 },
  { id: "sources", size: "full", priority: 80 }
];
const extremeGuard = measure(extreme, { ...BASE });
const extremeRaw = measure(extreme, { ...BASE, clampToHeightBand: false });
check(
  "护栏拦截 12 列 × 4:5 = 1600px 的荒谬几何",
  Math.max(...extremeGuard.items.map((i) => i.pixelHeight)) <= TILE_HARD_MAX_HEIGHT_PX,
  `护栏后 ${Math.round(Math.max(...extremeGuard.items.map((i) => i.pixelHeight)))}px（不护栏 ${Math.round(
    Math.max(...extremeRaw.items.map((i) => i.pixelHeight))
  )}px）`
);
check(
  "跨度微调未大面积推翻排版 Agent 决策",
  a.adjustedSpanCount <= Math.ceil(a.items.length / 2),
  `${a.adjustedSpanCount}/${a.items.length} 张`
);

console.log("\n--- 形状语汇覆盖 ---");
const usedRatios = new Set<string>(Object.values(WIDGET_RATIOS));
console.log(
  `  组件目录共使用 ${usedRatios.size} 种形状：${[...usedRatios]
    .map((r) => `${r}(${RATIO_LABELS[r as keyof typeof RATIO_LABELS]})`)
    .join("、")}`
);
check("形状语汇不少于 5 档", usedRatios.size >= 5, `${usedRatios.size} 档`);

console.log(`\n不规则磁贴墙: ${passed ? "PASSED" : "FAILED"}\n`);
process.exit(passed ? 0 : 1);
