/**
 * 验证脚本：插件清单（JSON）是否真正驱动了磁贴的网格比例。
 *
 * 为什么需要它：清单体系的核心契约是「改 JSON → 磁贴形状随之改变」，
 * 而这条链路跨了三层（JSON → manifests/index → lib/tileLayoutEngine），
 * 且布局引擎是反向依赖清单的。一旦依赖方向被破坏形成运行时循环，
 * MANIFEST_RATIOS 会因暂时性死区（TDZ）尚未初始化，
 * 比例便静默退化成默认的 4:3 —— **类型检查与打包都无法发现这种失败**，
 * 只有实际求值一次才能确认。故保留此脚本作为回归护栏。
 *
 * 运行：npx tsx scratch/verify_widget_manifests.ts
 */
import {
  WIDGET_RATIOS,
  RATIO_VALUES,
  resolveTileRatio,
  solveTileLayout
} from "../src/lib/tileLayoutEngine.js";
import {
  WIDGET_MANIFESTS,
  MANIFEST_RATIOS,
  MANIFEST_MIN_WIDTHS
} from "../src/widgets/manifests/index.js";
import { spanOfTileWidth, type TileWidth } from "../src/lib/tileLayoutEngine.js";

let failed = 0;
const fail = (msg: string) => {
  failed++;
  console.log("  ✗ " + msg);
};

console.log("\n--- 1. 运行时依赖方向（无循环导致 TDZ）---");
if (!MANIFEST_RATIOS || Object.keys(MANIFEST_RATIOS).length === 0) {
  fail("MANIFEST_RATIOS 为空 —— 很可能存在运行时循环依赖");
} else {
  console.log(`  ✓ MANIFEST_RATIOS 求值成功，含 ${Object.keys(MANIFEST_RATIOS).length} 条`);
}

console.log("\n--- 2. 清单 → 布局引擎比例表 链路 ---");
for (const manifest of WIDGET_MANIFESTS) {
  const engineRatio = WIDGET_RATIOS[manifest.id];
  if (engineRatio !== manifest.grid.ratio) {
    fail(
      `${manifest.id}: WIDGET_RATIOS=${engineRatio} ≠ 清单 grid.ratio=${manifest.grid.ratio}`
    );
  }
  if (!RATIO_VALUES[manifest.grid.ratio]) {
    fail(`${manifest.id}: 清单声明了非法比例 "${manifest.grid.ratio}"`);
  }
  if (resolveTileRatio(manifest.id) !== manifest.grid.ratio) {
    fail(`${manifest.id}: resolveTileRatio 未返回清单声明的比例`);
  }
}
console.log(`  ✓ ${WIDGET_MANIFESTS.length} 个清单的比例全部正确传导至布局引擎`);

console.log("\n--- 3. 非清单条目仍由引擎本地维护 ---");
if (WIDGET_RATIOS["custom_cards"] !== "4:3") {
  fail("custom_cards 的本地比例丢失（用户自定义卡片容器没有清单，应保留在引擎内）");
} else {
  console.log("  ✓ custom_cards 保留本地比例 4:3");
}

console.log("\n--- 4. minWidth 可选声明的传导 ---");
const minWidthIds = Object.keys(MANIFEST_MIN_WIDTHS);
console.log(`  · 声明了 minWidth 的清单: ${minWidthIds.join(", ") || "(无)"}`);
const LEGAL_WIDTHS: TileWidth[] = [25, 50, 75, 100];
for (const [id, width] of Object.entries(MANIFEST_MIN_WIDTHS)) {
  if (!LEGAL_WIDTHS.includes(width)) fail(`${id}: minWidth=${width} 非法（只能是 25/50/75/100）`);
}
console.log("  ✓ minWidth 取值合法");

console.log("\n--- 5. 清单字段完整性 ---");
for (const m of WIDGET_MANIFESTS) {
  if (!m.id || !m.name || !m.version) fail(`${m.id ?? "(无 id)"}: 缺少必填字段`);
  const grid = m.grid;
  if (!LEGAL_WIDTHS.includes(grid?.width) || !Array.isArray(grid.supportedWidths) || grid.supportedWidths.length === 0) {
    fail(`${m.id}: grid 段不完整或宽度非法`);
    continue;
  }
  if (!grid.supportedWidths.includes(grid.width)) {
    fail(`${m.id}: width "${grid.width}" 不在 supportedWidths 内`);
  }
  for (const w of grid.supportedWidths) {
    if (!LEGAL_WIDTHS.includes(w)) fail(`${m.id}: supportedWidths 含非法档位 ${w}`);
  }
  if (grid.minWidth !== undefined && (!LEGAL_WIDTHS.includes(grid.minWidth) || grid.minWidth > grid.width)) {
    fail(`${m.id}: minWidth=${grid.minWidth} 非法（必须 ≤ width 且在四档内）`);
  }
  if (spanOfTileWidth(grid.width, 12) !== Math.round((grid.width / 100) * 12)) {
    fail(`${m.id}: 宽度 ${grid.width}% 的列跨度换算不正确`);
  }
  if (!RATIO_VALUES[grid.ratio]) {
    fail(`${m.id}: ratio "${grid.ratio}" 不在允许的比例目录中`);
  }
}
console.log(`  ✓ ${WIDGET_MANIFESTS.length} 份清单字段完整且自洽`);

console.log("\n--- 6. 端到端：清单比例决定磁贴的实际像素形状 ---");
const solution = solveTileLayout(
  WIDGET_MANIFESTS.map((m) => ({
    id: m.id,
    size: m.grid.width,
    minSpan: m.grid.minWidth ? spanOfTileWidth(m.grid.minWidth, 12) : undefined
  })),
  { totalColumns: 12, containerWidth: 1280 }
);
for (const item of solution.items) {
  const manifest = WIDGET_MANIFESTS.find((m) => m.id === item.id);
  if (!manifest) continue;
  const actual = item.pixelWidth / item.pixelHeight;
  const expected = RATIO_VALUES[manifest.grid.ratio];
  if (Math.abs(actual - expected) > 1e-6) {
    fail(
      `${item.id}: 实际形状 ${actual.toFixed(4)} ≠ 清单比例 ${manifest.grid.ratio} (${expected.toFixed(4)})`
    );
  }
  console.log(
    `  · ${item.id.padEnd(22)} ${manifest.grid.ratio.padEnd(5)} → ` +
      `${Math.round(item.pixelWidth)}×${Math.round(item.pixelHeight)}px`
  );
}
console.log(`  ✓ ${solution.items.length} 张磁贴的实际像素比例全部等于其清单声明的 grid.ratio`);

console.log(
  failed > 0
    ? `\n✗ 失败 ${failed} 项\n`
    : "\n✓ 全部通过：JSON 清单已成功驱动磁贴网格比例\n"
);
process.exit(failed > 0 ? 1 : 0);
