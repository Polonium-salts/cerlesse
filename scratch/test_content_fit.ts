/**
 * 内容定高回归 (Content-Fit Contract Guardrail)
 *
 * 断言四件事：
 *  1. 没有实测高度时，高度仍严格 = 宽度 / 清单比例（固定比例契约不退化）；
 *  2. 回灌 contentHeightPx 后，磁贴长到刚好等于内容高度，且锁定测量时的跨度
 *     （跨度一变，换行位置就变，实测高度立刻失效）；
 *  3. 比例是"下限"而非上限：内容比比例高度矮时不会被压矮；
 *  4. 全部回灌后重复求解结果稳定，且任意两张磁贴互不重叠。
 */
import {
  solveTileLayout,
  resolveTileRatio,
  RATIO_VALUES,
  type TileLayoutInput,
  type SolvedTileItem
} from "../src/lib/tileLayoutEngine.js";

const OPTS = { totalColumns: 12, containerWidth: 1280 };

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function ratioHeightOf(item: SolvedTileItem): number {
  return item.pixelWidth / RATIO_VALUES[resolveTileRatio(item.id)];
}

function overlaps(a: SolvedTileItem, b: SolvedTileItem): boolean {
  return (
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.pixelHeight &&
    b.y < a.y + a.pixelHeight
  );
}

function countOverlaps(items: SolvedTileItem[]): number {
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) n++;
    }
  }
  return n;
}

const base: TileLayoutInput[] = [
  { id: "ai_overview", size: "wide", priority: 120, isEmphasized: true },
  { id: "sources", size: "wide", priority: 110 },
  { id: "takeaways", size: "medium", priority: 100 },
  { id: "quick_answer", size: "medium", priority: 90 }
];

// ── 第 1 轮：首帧没有实测数据，一律按清单比例定高 ──────────────────────
console.log("\n[1] 首帧：高度 = 宽度 / 清单比例");
const pass1 = solveTileLayout(base, OPTS);
for (const item of pass1.items) {
  const expected = ratioHeightOf(item);
  check(
    `${item.id}（${item.w} 列）`,
    Math.abs(item.pixelHeight - expected) < 1e-9,
    `${item.pixelHeight.toFixed(1)}px`
  );
}

// ── 第 2 轮：模拟渲染层实测出"内容比磁贴高"，回灌求解器 ────────────────
console.log("\n[2] 实测回灌：磁贴为内容让高，其余仍守比例");
const need: Record<string, number> = { sources: 780, ai_overview: 900 };
const spanOf = new Map(pass1.items.map((i) => [i.id, i.w]));
const measured: TileLayoutInput[] = base.map((t) =>
  need[t.id] ? { ...t, contentHeightPx: need[t.id], contentSpan: spanOf.get(t.id)! } : t
);

const pass2 = solveTileLayout(measured, OPTS);
for (const item of pass2.items) {
  if (need[item.id]) {
    check(
      `${item.id} 长到内容高度 ${need[item.id]}px`,
      Math.abs(item.pixelHeight - need[item.id]) < 1e-9,
      `实际 ${item.pixelHeight.toFixed(1)}px`
    );
    check(
      `${item.id} 锁定测量跨度 ${spanOf.get(item.id)} 列`,
      item.w === spanOf.get(item.id),
      `实际 ${item.w} 列`
    );
  } else {
    check(
      `${item.id} 仍严格遵守比例`,
      Math.abs(item.pixelHeight - ratioHeightOf(item)) < 1e-9
    );
  }
}
check("任意两张磁贴互不重叠", countOverlaps(pass2.items) === 0);

// 明细：让"内容让高"的效果肉眼可见
console.log("\n    磁贴               跨度   比例高度      最终高度");
for (const item of pass2.items) {
  const ratioH = ratioHeightOf(item);
  console.log(
    `    ${item.id.padEnd(16)} ${String(item.w).padStart(2)} 列  ${ratioH
      .toFixed(0)
      .padStart(6)}px  ${item.pixelHeight.toFixed(0).padStart(8)}px${
      need[item.id] ? "   ← 内容让高" : ""
    }`
  );
}

// ── 第 3 轮：比例是下限 —— 内容比比例高度矮时不许压矮 ─────────────────
console.log("\n[3] 内容很少时：比例是下限，不缩短");
const tiny: TileLayoutInput[] = base.map((t) => ({
  ...t,
  contentHeightPx: 40,
  contentSpan: spanOf.get(t.id)!
}));
const pass3 = solveTileLayout(tiny, OPTS);
for (const item of pass3.items) {
  check(
    `${item.id} 保持比例高度`,
    Math.abs(item.pixelHeight - ratioHeightOf(item)) < 1e-9,
    `${item.pixelHeight.toFixed(1)}px`
  );
}

// ── 第 4 轮：全部回灌后重复求解，结果稳定 ─────────────────────────────
console.log("\n[4] 回灌全部实测值再解一次：稳定且不重叠");
const feedBack: TileLayoutInput[] = base.map((t) => {
  const solved = pass2.items.find((i) => i.id === t.id)!;
  return { ...t, contentHeightPx: solved.pixelHeight, contentSpan: solved.w };
});
const pass4 = solveTileLayout(feedBack, OPTS);
for (const item of pass4.items) {
  const prev = pass2.items.find((i) => i.id === item.id)!;
  check(
    `${item.id} 高度与跨度稳定`,
    item.pixelHeight === prev.pixelHeight && item.w === prev.w && item.x === prev.x,
    `${item.pixelHeight.toFixed(1)}px / ${item.w} 列`
  );
}
check("任意两张磁贴互不重叠", countOverlaps(pass4.items) === 0);

console.log(`\n${failures === 0 ? "✅ 全部通过" : `❌ ${failures} 项失败`}`);
process.exit(failures === 0 ? 0 : 1);
