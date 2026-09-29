import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  solveTileLayout,
  applyRowTailPadding,
  TileLayoutInput,
  TileWidth,
  normalizeTileWidth,
  packTiles,
  type PackInput
} from "../../src/lib/tileLayoutEngine.js";
import { sanitizeManifest } from "../../src/widgets/manifests/index.js";
import { solveLayoutTool } from "../../server/tools/layoutTool.js";
import { filterAndSanitizeWidgetTypes, isRenderableWidget } from "../../server/widgetPlanner.js";
import type { LayoutIntent } from "../../src/types.js";

describe("TileLayoutEngine & solve_layout Architecture Tests", () => {
  it("enforces canonical width tiers (25%, 50%, 75%, 100%)", () => {
    const inputs: TileLayoutInput[] = [
      { id: "ai_answer", size: 100 },
      { id: "image_gallery", size: 75 },
      { id: "comparison", size: 50 },
      { id: "quick_facts", size: 25 },
      // Invalid / odd width that should be normalized
      { id: "search_engine", size: 30 as TileWidth }
    ];

    const solution = solveTileLayout(inputs, { totalColumns: 12 });
    for (const item of solution.items) {
      assert.ok([25, 50, 75, 100].includes(item.size), `Item size ${item.size} must be one of [25, 50, 75, 100]`);
    }
    assert.ok(solution.adjustments.length > 0, "Adjustments should be recorded");
    const searchAdj = solution.adjustments.find(a => a.widgetId === "search_engine");
    assert.strictEqual(searchAdj?.to, 25);
  });

  it("guarantees zero overlap (overlapRate === 0) across complex widget combinations", () => {
    const inputs: TileLayoutInput[] = [
      { id: "ai_answer", size: 100, role: "hero" },
      { id: "image_gallery", size: 75 },
      { id: "quick_facts", size: 25 },
      { id: "code_snippet", size: 50 },
      { id: "comparison", size: 50 },
      { id: "takeaways", size: 50 }
    ];

    const solution = solveTileLayout(inputs, { totalColumns: 12 });
    assert.strictEqual(solution.metrics.overlapRate, 0);
    assert.strictEqual(solution.metrics.contentOverflowRate, 0);

    // Verify 2D bounding boxes do not overlap
    for (let i = 0; i < solution.items.length; i++) {
      for (let j = i + 1; j < solution.items.length; j++) {
        const a = solution.items[i];
        const b = solution.items[j];

        const horizontalOverlap = !(a.x + a.w <= b.x || b.x + b.w <= a.x);
        const verticalOverlap = !(a.y + a.pixelHeight <= b.y || b.y + b.pixelHeight <= a.y);
        const collides = horizontalOverlap && verticalOverlap;
        assert.strictEqual(collides, false, `Widgets ${a.id} and ${b.id} must not overlap`);
      }
    }
  });

  it("handles 75% + 25% complementary pairing seamlessly", () => {
    const inputs: TileLayoutInput[] = [
      { id: "image_gallery", size: 75 },
      { id: "quick_facts", size: 25 }
    ];

    const solution = solveTileLayout(inputs, { totalColumns: 12 });
    assert.strictEqual(solution.items.length, 2);
    assert.strictEqual(solution.items[0].w + solution.items[1].w, 12);
    assert.ok(solution.metrics.gapRate <= 0.08, `Gap rate should be <= 0.08, got ${solution.metrics.gapRate}`);
  });

  it("satisfies semantic relation constraints (prefer_adjacent, prefer_same_row, prefer_below)", () => {
    const intent: LayoutIntent = {
      focusWidgetId: "ai_answer",
      widgets: [
        { id: "ai_answer", role: "hero", widthPercent: 100 },
        { id: "code_snippet", role: "primary", widthPercent: 50 },
        { id: "error_debugger", role: "secondary", widthPercent: 50 }
      ],
      relations: [
        { source: "code_snippet", target: "error_debugger", type: "prefer_same_row", weight: 1.0 }
      ]
    };

    const output = solveLayoutTool({ layoutIntent: intent, totalColumns: 12 });
    assert.strictEqual(output.tiles.length, 3);
    assert.ok(output.metrics.semanticAdjacency >= 0.7, `Semantic adjacency ${output.metrics.semanticAdjacency} should be >= 0.7`);
    assert.ok(output.metrics.totalScore >= 0.85, `Total score ${output.metrics.totalScore} should be >= 0.85`);

    const codeTile = output.tiles.find(t => t.id === "code_snippet")!;
    const debugTile = output.tiles.find(t => t.id === "error_debugger")!;
    assert.ok(Math.abs(codeTile.y - debugTile.y) < 50, "code_snippet and error_debugger should be on same row");
  });

  it("runs the re-planning loop if initial metrics are sub-optimal", () => {
    const intent: LayoutIntent = {
      widgets: [
        { id: "image_gallery", role: "primary", widthPercent: 75 },
        { id: "takeaways", role: "secondary", widthPercent: 50 }
      ]
    };

    const output = solveLayoutTool({ layoutIntent: intent, totalColumns: 12 });
    assert.strictEqual(output.tiles.length, 2);
    assert.ok(output.metrics.totalScore >= 0.85, `Total score ${output.metrics.totalScore} should be >= 0.85`);
  });

  // Test suite covering the 9 regression queries
  const regressionScenarios = [
    { query: "React 19 vs Vue 3 核心特性对比", widgets: ["ai_answer", "comparison", "feature_matrix", "quick_facts"] },
    { query: "Docker 启动失败 端口冲突 解决方案", widgets: ["ai_answer", "code_snippet", "command_palette", "quick_facts"] },
    { query: "2026 年最具潜力的开源 AI 工具", widgets: ["ai_answer", "repository_stats", "timeline", "image_gallery"] },
    { query: "特斯拉 Model 3 2026 款落地价与配置", widgets: ["ai_answer", "price_calculator", "image_gallery", "quick_facts"] },
    { query: "如何制作正宗四川麻婆豆腐", widgets: ["ai_answer", "recipe_card", "image_gallery", "timer_card"] },
    { query: "Python 异步编程 asyncio 最佳实践", widgets: ["ai_answer", "code_snippet", "cheat_sheet", "quick_facts"] },
    { query: "杭州西湖一日游保姆级攻略", widgets: ["ai_answer", "itinerary_map", "timeline", "image_gallery"] },
    { query: "英伟达最新财报亮点与股价分析", widgets: ["ai_answer", "financial_chart", "key_metrics", "quick_facts"] },
    { query: "Kubernetes Pod 处于 CrashLoopBackOff 排查步骤", widgets: ["ai_answer", "code_snippet", "troubleshooting_flow", "quick_facts"] }
  ];

  for (const scenario of regressionScenarios) {
    it(`handles scenario '${scenario.query}' with zero overlap and high totalScore`, () => {
      const output = solveLayoutTool({
        widgetIds: scenario.widgets,
        totalColumns: 12,
        containerWidth: 1280
      });

      assert.strictEqual(output.metrics.overlapRate, 0);
      assert.strictEqual(output.metrics.contentOverflowRate, 0);
      assert.strictEqual(output.tiles.length, scenario.widgets.length);
    });
  }
});
describe("Image gallery natural height", () => {
  it("uses content height instead of the oversized 75% ratio height", () => {
    const solution = solveTileLayout([{ id: "image_gallery", size: 75 }], {
      totalColumns: 12,
      containerWidth: 1280
    });
    const imageTile = solution.items.find((item) => item.id === "image_gallery");
    assert.ok(imageTile);
    assert.equal(imageTile.pixelHeight, 260);
    assert.equal(imageTile.size, 75);
  });
});

describe("Ratio Drift Root Causes & Solutions Tests", () => {
  it("Root Cause 1: strict ratioMode keeps ratio height and does not drift with contentHeightPx", () => {
    const flexibleSolution = solveTileLayout([{
      id: "ai_answer",
      size: 50,
      ratio: "4:3",
      ratioMode: "flexible",
      contentHeightPx: 600
    }], { totalColumns: 12, containerWidth: 1280 });

    const strictSolution = solveTileLayout([{
      id: "related_links",
      size: 50,
      ratio: "4:3",
      ratioMode: "strict",
      contentHeightPx: 600
    }], { totalColumns: 12, containerWidth: 1280 });

    const flexItem = flexibleSolution.items[0];
    const strictItem = strictSolution.items[0];

    assert.ok(flexItem.pixelHeight >= 600, "Flexible tile should expand with content");
    assert.ok(strictItem.pixelHeight < 600, "Strict tile should stay locked to ratio height");
    assert.equal(strictItem.pixelHeight, Math.round(strictItem.pixelWidth / (4 / 3)));
  });

  it("Root Cause 2: ratioByBreakpoint applies breakpoint-specific ratio on mobile and tablet", () => {
    const desktopSolution = solveTileLayout([{
      id: "custom_card",
      size: 100,
      ratio: "16:9",
      ratioByBreakpoint: { tablet: "4:3", mobile: "1:1" }
    }], { totalColumns: 12, containerWidth: 1280, breakpoint: "desktop" });

    const mobileSolution = solveTileLayout([{
      id: "custom_card",
      size: 100,
      ratio: "16:9",
      ratioByBreakpoint: { tablet: "4:3", mobile: "1:1" }
    }], { totalColumns: 4, containerWidth: 400, breakpoint: "mobile" });

    assert.equal(desktopSolution.items[0].ratio, "16:9");
    assert.equal(mobileSolution.items[0].ratio, "1:1");
  });

  it("Root Cause 3: normalizeTileWidth correctly normalizes legacy size strings to canonical tiers", () => {
    assert.equal(normalizeTileWidth("small"), 25);
    assert.equal(normalizeTileWidth("medium"), 25);
    assert.equal(normalizeTileWidth("large"), 50);
    assert.equal(normalizeTileWidth("wide"), 75);
    assert.equal(normalizeTileWidth("full"), 100);
  });

  it("Root Cause 4: userOverrides persist and take precedence in layout tool solving", () => {
    const output = solveLayoutTool({
      widgetIds: ["related_links", "ai_answer"],
      userOverrides: {
        related_links: { size: 75 }
      },
      totalColumns: 12,
      containerWidth: 1280
    });

    const linksTile = output.tiles.find(t => t.id === "related_links");
    assert.ok(linksTile);
    assert.equal(linksTile.widthPercent, 75, "User override width (75%) should be preserved by layout tool");
  });

  it("enforces related_links flexible height scaling with content count while width remains fixed", () => {
    // 基础调用：无内容高度回填
    const baseSolution = solveTileLayout([{
      id: "related_links",
      size: 50
    }], { totalColumns: 12, containerWidth: 1200 });

    // 预估高度生效测试 (通过 estimatedHeightPx)
    const estimatedSolution = solveTileLayout([{
      id: "related_links",
      size: 50,
      estimatedHeightPx: 608 // 56 + 6 * 92
    }], { totalColumns: 12, containerWidth: 1200 });

    // 实测高度生效测试 (通过 contentHeightPx)
    const measuredSolution = solveTileLayout([{
      id: "related_links",
      size: 50,
      contentHeightPx: 750
    }], { totalColumns: 12, containerWidth: 1200 });

    // 验证宽度均恒定保持在 50%（6列宽）
    assert.equal(baseSolution.items[0].w, 6);
    assert.equal(estimatedSolution.items[0].w, 6);
    assert.equal(measuredSolution.items[0].w, 6);

    // 验证高度随内容递增长高，且实测优先于比例基准
    assert.ok(estimatedSolution.items[0].pixelHeight >= 608);
    assert.ok(measuredSolution.items[0].pixelHeight >= 750);
    assert.ok(measuredSolution.items[0].pixelHeight > baseSolution.items[0].pixelHeight);
  });
});

describe("Prompt 2: P0 Row-Tail Padding & WidgetPlanner Tests", () => {
  it("Test 1: handles [75, 50] with row-tail padding (filling to 12 or recording emptyCells)", () => {
    // 场景 A: 两个组件均允许 100% (默认情况)
    const inputsA: TileLayoutInput[] = [
      { id: "comparison", size: 75, supportedWidths: [75, 100] },
      { id: "takeaways", size: 50, supportedWidths: [50, 100] }
    ];
    const solutionA = solveTileLayout(inputsA, 12);
    assert.strictEqual(solutionA.items.length, 2);
    // 第一行: 75% 升档到 100% (colSpan 12)
    assert.strictEqual(solutionA.items[0].w, 12);
    // 第二行: 50% 升档到 100% (colSpan 12)
    assert.strictEqual(solutionA.items[1].w, 12);
    assert.strictEqual(solutionA.emptyCells, 0);

    // 场景 B: 第二个组件严格不允许 100% (例如只支持 [50])
    const inputsB: TileLayoutInput[] = [
      { id: "comparison", size: 75, supportedWidths: [75, 100] },
      { id: "takeaways", size: 50, supportedWidths: [50] }
    ];
    const solutionB = solveTileLayout(inputsB, 12);
    assert.strictEqual(solutionB.items[0].w, 12);
    assert.strictEqual(solutionB.items[1].w, 6);
    // 第二行未能填满，明确记录留白的 6 个单元格
    assert.strictEqual(solutionB.emptyCells, 6);
  });

  it("Test 2: handles [25, 75, 50] with row-tail padding (filling to 12 or recording emptyCells)", () => {
    const inputs: TileLayoutInput[] = [
      { id: "quick_facts", size: 25, supportedWidths: [25, 50] },
      { id: "image_gallery", size: 75, supportedWidths: [75] },
      { id: "takeaways", size: 50, supportedWidths: [50, 100] }
    ];
    const solution = solveTileLayout(inputs, 12);
    assert.strictEqual(solution.items.length, 3);
    // 第一行: 25% + 75% 恰好等于 100% (3 + 9 = 12)
    assert.strictEqual(solution.items[0].w + solution.items[1].w, 12);
    // 第二行: 50% 升档到 100% (colSpan 12)
    assert.strictEqual(solution.items[2].w, 12);
    assert.strictEqual(solution.emptyCells, 0);
  });

  it("Test 3: handles [50, 25, 25, 25] with row-tail padding (filling to 12 or recording emptyCells)", () => {
    // 场景 A: 最后一个 25% 支持升至 100%
    const inputsA: TileLayoutInput[] = [
      { id: "sources", size: 50, supportedWidths: [50] },
      { id: "tag_a", size: 25, supportedWidths: [25] },
      { id: "tag_b", size: 25, supportedWidths: [25] },
      { id: "tag_c", size: 25, supportedWidths: [25, 50, 75, 100] }
    ];
    const solutionA = solveTileLayout(inputsA, 12);
    assert.strictEqual(solutionA.items.length, 4);
    // 第一行: 50% + 25% + 25% = 100% (6 + 3 + 3 = 12)
    const row1Sum = solutionA.items[0].w + solutionA.items[1].w + solutionA.items[2].w;
    assert.strictEqual(row1Sum, 12);
    // 第二行: tag_c 升至 100% (12)
    assert.strictEqual(solutionA.items[3].w, 12);
    assert.strictEqual(solutionA.emptyCells, 0);

    // 场景 B: 最后一个 25% 仅支持 25%，无法填满，带出 emptyCells 计数
    const inputsB: TileLayoutInput[] = [
      { id: "sources", size: 50, supportedWidths: [50] },
      { id: "tag_a", size: 25, supportedWidths: [25] },
      { id: "tag_b", size: 25, supportedWidths: [25] },
      { id: "tag_c", size: 25, supportedWidths: [25] }
    ];
    const solutionB = solveTileLayout(inputsB, 12);
    assert.strictEqual(solutionB.items[3].w, 3);
    assert.strictEqual(solutionB.emptyCells, 9);
  });

  it("Test 4: pulls subsequent tile forward when last tile cannot upgrade", () => {
    // [50, 75, 25]：第一行放 50% 后余 6 列，75% 塞不下，50% 无法升档；
    // 从后一行提前 25%（3列），随后 25% 升档至 50% 刚好填满 12 列
    const inputs: TileLayoutInput[] = [
      { id: "fixed_50", size: 50, supportedWidths: [50], isEmphasized: true },
      { id: "wide_75", size: 75, supportedWidths: [75, 100] },
      { id: "flexible_25", size: 25, supportedWidths: [25, 50] }
    ];
    const solution = solveTileLayout(inputs, 12);
    assert.strictEqual(solution.items.length, 3);
    // 第一行由 fixed_50 与提前上来的 flexible_25 (升至50) 拼成 12 列
    assert.strictEqual(solution.items[0].id, "fixed_50");
    assert.strictEqual(solution.items[1].id, "flexible_25");
    assert.strictEqual(solution.items[0].w + solution.items[1].w, 12);
    // 第二行留下 wide_75 升至 100%
    assert.strictEqual(solution.items[2].id, "wide_75");
    assert.strictEqual(solution.items[2].w, 12);
  });

  it("Test 5: widgetPlanner filters unregistered types and downgrades strong-intent types to ai_answer with warning", () => {
    const rawCandidates = [
      "unregistered_deep_overview", // 强相关未注册组件，应降级为 ai_answer
      "sources",                    // 正常注册组件，应保留
      "unknown_random_gibberish"    // 非强相关未注册组件，应直接过滤
    ];

    const result = filterAndSanitizeWidgetTypes(rawCandidates, {
      query: "深度解释量子计算的原理",
      intent: "concept_explanation"
    });

    assert.ok(result.validTypes.includes("sources"));
    assert.ok(result.validTypes.includes("ai_answer"));
    assert.ok(!result.validTypes.includes("unknown_random_gibberish"));
    assert.ok(result.downgradedToAiAnswer);
    assert.strictEqual(result.filteredTypes.length, 2);
    assert.ok(result.warnings.length >= 2);
    assert.ok(result.warnings[0].includes("unregistered_deep_overview"));
    assert.ok(result.warnings[1].includes("unknown_random_gibberish"));
  });
});

describe("Deterministic Packing Engine (packTiles) & Spec Tests", () => {
  it("packs matching row templates exactly to 12 colSpan (e.g. 50 + 50, 75 + 25, 25 + 25 + 50)", () => {
    const inputs: PackInput[] = [
      { id: "ans", priority: 100, defaultWidth: 50, supportedWidths: [25, 50, 75, 100], minRows: 1, maxRows: 4 },
      { id: "compare", priority: 90, defaultWidth: 50, supportedWidths: [25, 50, 75, 100], minRows: 1, maxRows: 4 },
      { id: "links", priority: 80, defaultWidth: 25, supportedWidths: [25, 50], minRows: 1, maxRows: 4 },
      { id: "takeaway", priority: 70, defaultWidth: 25, supportedWidths: [25, 50], minRows: 1, maxRows: 4 },
      { id: "weather", priority: 60, defaultWidth: 50, supportedWidths: [25, 50, 75], minRows: 1, maxRows: 4 }
    ];

    const result = packTiles(inputs, { cols: 12 });
    assert.strictEqual(result.rows.length, 2);

    // 行 1: 50 + 50 -> 6 + 6 = 12
    const row1Sum = result.rows[0].tiles.reduce((acc, t) => acc + t.colSpan, 0);
    assert.strictEqual(row1Sum, 12);

    // 行 2: 25 + 25 + 50 -> 3 + 3 + 6 = 12
    const row2Sum = result.rows[1].tiles.reduce((acc, t) => acc + t.colSpan, 0);
    assert.strictEqual(row2Sum, 12);
    assert.strictEqual(result.emptyCells, 0);
  });

  it("guarantees determinism: identical inputs produce identical packed layout", () => {
    const inputs: PackInput[] = [
      { id: "w1", priority: 95, defaultWidth: 75, supportedWidths: [50, 75, 100], minRows: 1, maxRows: 4 },
      { id: "w2", priority: 85, defaultWidth: 25, supportedWidths: [25, 50], minRows: 1, maxRows: 4 },
      { id: "w3", priority: 75, defaultWidth: 50, supportedWidths: [25, 50, 75], minRows: 1, maxRows: 4 },
      { id: "w4", priority: 65, defaultWidth: 50, supportedWidths: [25, 50, 75], minRows: 1, maxRows: 4 }
    ];

    const run1 = packTiles(inputs, { cols: 12 });
    const run2 = packTiles(inputs, { cols: 12 });
    const run3 = packTiles(inputs, { cols: 12 });

    assert.deepStrictEqual(run1, run2);
    assert.deepStrictEqual(run2, run3);
  });

  it("handles responsive column mapping (12 cols desktop, 6 cols tablet, 1 col mobile)", () => {
    const inputs: PackInput[] = [
      { id: "hero", priority: 100, defaultWidth: 100, supportedWidths: [50, 75, 100], minRows: 1, maxRows: 4 },
      { id: "sub1", priority: 90, defaultWidth: 50, supportedWidths: [25, 50], minRows: 1, maxRows: 4 },
      { id: "sub2", priority: 80, defaultWidth: 50, supportedWidths: [25, 50], minRows: 1, maxRows: 4 }
    ];

    // 12 列模式
    const res12 = packTiles(inputs, { cols: 12 });
    assert.strictEqual(res12.rows[0].tiles[0].colSpan, 12);
    assert.strictEqual(res12.rows[1].tiles[0].colSpan, 6);
    assert.strictEqual(res12.rows[1].tiles[1].colSpan, 6);

    // 6 列模式 (平板)
    const res6 = packTiles(inputs, { cols: 6 });
    for (const r of res6.rows) {
      const sum = r.tiles.reduce((acc, t) => acc + t.colSpan, 0);
      assert.strictEqual(sum, 6);
    }

    // 1 列模式 (手机端)
    const res1 = packTiles(inputs, { cols: 1 });
    assert.strictEqual(res1.rows.length, 3);
    for (const r of res1.rows) {
      assert.strictEqual(r.tiles.length, 1);
      assert.strictEqual(r.tiles[0].colSpan, 1);
    }
  });

  it("stretches tail row when supported to eliminate empty cells (尾行拉伸)", () => {
    const inputs: PackInput[] = [
      { id: "w1", priority: 90, defaultWidth: 75, supportedWidths: [75, 100], minRows: 1, maxRows: 4 }
    ];

    // 单个 75% 组件在支持 100% 时，末行应被拉伸到 100% (12 colSpan)
    const res = packTiles(inputs, { cols: 12 });
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].tiles[0].colSpan, 12);
    assert.strictEqual(res.rows[0].tiles[0].width, 100);
    assert.strictEqual(res.emptyCells, 0);
  });

  it("preserves emptyCells when components cannot upgrade", () => {
    const inputs: PackInput[] = [
      { id: "locked", priority: 90, defaultWidth: 25, supportedWidths: [25], minRows: 1, maxRows: 4 }
    ];

    // 仅支持 25% 的单卡片无法补齐，记录 emptyCells: 9
    const res = packTiles(inputs, { cols: 12 });
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].tiles[0].colSpan, 3);
    assert.strictEqual(res.emptyCells, 9);
  });

  it("quantizes rowSpan and aligns tile heights equally within the same row", () => {
    const inputs: PackInput[] = [
      // ans 内容较长 (contentHeight: 320px -> ceil(320 / 120) = 3 单位)
      { id: "ans", priority: 100, defaultWidth: 50, supportedWidths: [50], minRows: 1, maxRows: 4, contentHeightPx: 320 },
      // links 内容较短 (contentHeight: 100px -> ceil(100 / 120) = 1 单位)
      { id: "links", priority: 90, defaultWidth: 50, supportedWidths: [50], minRows: 1, maxRows: 4, contentHeightPx: 100 }
    ];

    const res = packTiles(inputs, { cols: 12, rowUnit: 120 });
    assert.strictEqual(res.rows.length, 1);
    // 同排统一取最大 rowSpan: 3
    assert.strictEqual(res.rows[0].rowSpan, 3);
    assert.strictEqual(res.rows[0].tiles[0].rowSpan, 3);
    assert.strictEqual(res.rows[0].tiles[1].rowSpan, 3);
  });

  it("sanitizeManifest normalizes invalid widths, ratio, and clamps maxRows", () => {
    const raw = {
      id: "third_party_tool",
      name: "第三方工具",
      grid: {
        width: 30 as any, // 非法，应归一化为 25
        supportedWidths: [30 as any, 80 as any, 50], // 应过滤只保留 50 并补上 25
        ratio: "invalid_ratio" as any, // 应回退为 4:3
        maxRows: 10 // 超限，应夹紧为 <= 6
      }
    };

    const sanitized = sanitizeManifest(raw);
    assert.strictEqual(sanitized.grid.width, 25);
    assert.ok(sanitized.grid.supportedWidths.includes(25));
    assert.ok(sanitized.grid.supportedWidths.includes(50));
    assert.ok(!sanitized.grid.supportedWidths.includes(30 as any));
    assert.strictEqual(sanitized.grid.ratio, "4:3");
    assert.strictEqual(sanitized.grid.maxRows, 6);
  });

  it("sanitizeManifest throws clear errors when id or name is missing", () => {
    assert.throws(() => sanitizeManifest({}), /缺少必需的字符串字段 'id'/);
    assert.throws(() => sanitizeManifest({ id: "test" }), /缺少必需的字符串字段 'name'/);
  });
});


