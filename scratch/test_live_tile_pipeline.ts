import { runAgentTeam } from "../server/agentTeam.js";
import { solveTileLayout, TileLayoutInput } from "../src/lib/tileLayoutEngine.js";

async function testFullDesktopFlow() {
  console.log("=== Testing AgentTeam to Live Tile Desktop Packing Pipeline ===");
  const t0 = Date.now();

  const result = await runAgentTeam({
    query: "Sora 视频大模型架构与扩散变换器技术解析",
    enableDeepSearch: false,
    onStepProgress: (currentStep) => {
      console.log(`[Step] ${currentStep.id}: ${currentStep.status}`);
    }
  });

  const duration = Date.now() - t0;
  console.log(`\nPipeline completed in ${duration}ms!`);
  console.log("Summary length:", result.summary?.length);
  console.log("Custom cards generated:", result.customCards?.length);
  console.log("Widget plan items:", result.widgetPlan?.widgets?.length);

  // 模拟桌面排版输入
  const activeKeys: string[] = result.layoutStrategy?.componentOrder || [
    "ai_overview",
    "quick_answer",
    "sources",
    "mindmap",
    "actions_toolbox",
    "metrics_telemetry"
  ];

  const inputs: TileLayoutInput[] = [];

  // 解构专属卡片为桌面磁贴
  if (result.customCards && result.customCards.length > 0) {
    result.customCards.forEach((card: any, idx: number) => {
      inputs.push({
        id: `custom_card__${card.id}`,
        size: card.archetype === "timeline" ? "large" : "medium",
        priority: 110 - idx * 5,
        isEmphasized: idx === 0
      });
    });
  }

  // 映射官方组件
  activeKeys.forEach((k: string) => {
    const planned = result.widgetPlan?.widgets?.find((w: any) => w.type === k);
    inputs.push({
      id: k,
      size: (planned?.size as any) || (k === "ai_overview" ? "large" : (k === "metrics_telemetry" ? "small" : "medium")),
      priority: planned?.priority ?? 50,
      isEmphasized: k === result.layoutStrategy?.emphasizedWidget
    });
  });

  console.log(`\nSolving 12-Column Live Tile Layout for ${inputs.length} widgets...`);
  const solution = solveTileLayout(inputs, 12);
  console.log(`Total rows occupied: ${solution.totalRows}`);
  console.log(`Internal gaps: ${solution.gapCount}`);

  solution.items.forEach(t => {
    console.log(`- [${t.id.padEnd(25)}] size=${t.size.padEnd(6)} x=${t.x} y=${t.y} w=${t.w} h=${t.h} CSS='${t.gridStyle.gridColumn}', '${t.gridStyle.gridRow}'`);
  });

  // 严格碰撞校验
  const grid: string[][] = Array.from({ length: solution.totalRows }, () => Array(12).fill("."));
  let collisions = 0;
  for (const t of solution.items) {
    for (let r = 0; r < t.h; r++) {
      for (let c = 0; c < t.w; c++) {
        const y = t.y + r;
        const x = t.x + c;
        if (grid[y][x] !== ".") {
          collisions++;
        }
        grid[y][x] = t.id.slice(0, 3);
      }
    }
  }

  console.log("\nGrid footprint visualization:");
  grid.slice(0, 10).forEach((row, i) => {
    console.log(`Row ${i.toString().padStart(2, "0")}: |` + row.map(c => c.padEnd(4, " ")).join("|") + "|");
  });

  if (collisions === 0) {
    console.log("\n>>> SUCCESS: 0 collisions! Live Tile Desktop packing algorithm verified! <<<");
  } else {
    console.error(`\n>>> FAILURE: ${collisions} collisions detected!`);
    process.exit(1);
  }
}

testFullDesktopFlow().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
