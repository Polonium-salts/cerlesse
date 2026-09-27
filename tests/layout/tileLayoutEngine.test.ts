import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { solveTileLayout, TileLayoutInput, TileWidth, normalizeTileWidth } from "../../src/lib/tileLayoutEngine.js";
import { solveLayoutTool } from "../../server/tools/layoutTool.js";
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
