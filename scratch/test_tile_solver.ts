/**
 * 固定比例契约回归护栏 (Fixed-Ratio Contract Guardrail)
 *
 * 断言四件事：
 *  1. 所有磁贴都被安置，一个不丢；
 *  2. 渲染宽高比 === 组件固有宽高比（像素级精确，误差 < 1e-9）；
 *  3. 同一组件的比例在 12 / 6 / 4 列与不同容器宽度下完全不变；
 *  4. 任意两个磁贴的矩形区域互不重叠。
 */
import {
  solveTileLayout,
  resolveTileRatio,
  RATIO_VALUES,
  TILE_COLUMN_GAP_PX,
  TILE_ROW_GAP_PX,
  WIDGET_RATIOS,
  ARCHETYPE_RATIOS,
  type TileLayoutInput
} from "../src/lib/tileLayoutEngine.js";

const inputs: TileLayoutInput[] = [
  { id: "ai_overview", size: "large", priority: 120, isEmphasized: true },
  { id: "quick_answer", size: "medium", priority: 110 },
  { id: "custom_card__dl", size: "medium", ratio: ARCHETYPE_RATIOS["download_hub"], priority: 105 },
  { id: "takeaways", size: "medium", priority: 100 },
  { id: "actions_toolbox", size: "wide", priority: 95 },
  { id: "metrics_telemetry", size: "small", priority: 90 },
  { id: "followup", size: "small", priority: 85 },
  { id: "sources", size: "full", priority: 80 }
];

let allPassed = true;
const fail = (msg: string) => {
  allPassed = false;
  console.log(`  [FAIL] ${msg}`);
};

const ratioSeen: Record<string, number[]> = {};

console.log("=== 固定比例契约校验 ===");

for (const width of [1280, 900]) {
  for (const cols of [12, 6, 4]) {
    const res = solveTileLayout(inputs, {
      totalColumns: cols,
      containerWidth: width,
      columnGap: TILE_COLUMN_GAP_PX,
      rowGap: TILE_ROW_GAP_PX
    });

    const cell = (width - (cols - 1) * TILE_COLUMN_GAP_PX) / cols;
    const pixelWidthOf = (span: number) => span * cell + (span - 1) * TILE_COLUMN_GAP_PX;

    console.log(
      `\nW=${width} Cols=${cols}: tiles=${res.items.length} height=${Math.round(res.totalHeightPx)}px`
    );

    // 契约 1：一个都不能丢
    if (res.items.length !== inputs.length) {
      fail(`磁贴数量不符：期望 ${inputs.length}，实际 ${res.items.length}`);
    }

    const rects: Array<{ id: string; x0: number; x1: number; y0: number; y1: number }> = [];

    for (const item of res.items) {
      const expected = resolveTileRatio(item.id, inputs.find(i => i.id === item.id)?.ratio);
      const expectedRatio = RATIO_VALUES[expected];
      const actual = item.pixelWidth / item.pixelHeight;

      // 契约 2：比例像素级精确
      if (Math.abs(actual - expectedRatio) > 1e-9) {
        fail(`${item.id} 比例漂移：实际 ${actual.toFixed(6)}，期望 ${expectedRatio.toFixed(6)}`);
      }

      // 契约 2b：声明宽度与实际像素宽度一致（保证装箱矩形与实际渲染一致）
      const declaredWidth = pixelWidthOf(item.w);
      if (Math.abs(declaredWidth - item.pixelWidth) > 1e-6) {
        fail(`${item.id} 像素宽度不一致：${item.pixelWidth} vs ${declaredWidth}`);
      }

      // 契约 3：记录比例，稍后比对跨断点不变性
      (ratioSeen[item.id] ||= []).push(actual);

      rects.push({
        id: item.id,
        x0: item.x,
        x1: item.x + item.w,
        y0: item.y,
        y1: item.y + item.pixelHeight
      });

      console.log(
        `  ${item.id.padEnd(20)} span=${item.w} ratio=${item.ratio.padEnd(5)} ` +
          `${Math.round(item.pixelWidth)}x${Math.round(item.pixelHeight)} @(${item.x}, ${Math.round(item.y)}) OK`
      );
    }

    // 契约 4：互不重叠
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (overlapX > 0 && overlapY > 0) {
          fail(`${a.id} 与 ${b.id} 重叠 (x:${overlapX}列, y:${Math.round(overlapY)}px)`);
        }
      }
    }
  }
}

// 契约 3：跨断点比例恒定
console.log("\n--- 跨断点比例不变性 ---");
for (const [id, list] of Object.entries(ratioSeen)) {
  const min = Math.min(...list);
  const max = Math.max(...list);
  const invariant = max - min < 1e-9;
  if (!invariant) fail(`${id} 比例随断点变化：${list.map(v => v.toFixed(4)).join(" / ")}`);
  console.log(`  ${id.padEnd(20)} ${list.map(v => v.toFixed(4)).join(" = ")} ${invariant ? "OK" : "<= 漂移!"}`);
}

// 覆盖率：每个官方组件都必须声明固定比例
console.log("\n--- 比例声明覆盖率 ---");
const total = Object.keys(WIDGET_RATIOS).length + Object.keys(ARCHETYPE_RATIOS).length;
console.log(`  官方组件 ${Object.keys(WIDGET_RATIOS).length} 个 · 卡片原型 ${Object.keys(ARCHETYPE_RATIOS).length} 个 (共 ${total})`);
for (const [id, ratio] of Object.entries(WIDGET_RATIOS)) {
  if (!RATIO_VALUES[ratio]) fail(`${id} 声明了非法比例 ${ratio}`);
}

console.log(`\n固定比例契约: ${allPassed ? "PASSED" : "FAILED"}`);
process.exit(allPassed ? 0 : 1);
