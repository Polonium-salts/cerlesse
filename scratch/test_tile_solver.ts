import { solveTileLayout, TileLayoutInput } from "../src/lib/tileLayoutEngine.js";

const testTileInputs: TileLayoutInput[] = [
  { id: "ai_overview", size: "large", priority: 120, isEmphasized: true },
  { id: "quick_answer", size: "medium", priority: 110 },
  { id: "custom_cards", size: "medium", priority: 105 },
  { id: "takeaways", size: "medium", priority: 100 },
  { id: "actions_toolbox", size: "wide", priority: 95 },
  { id: "metrics_telemetry", size: "small", priority: 90 },
  { id: "followup", size: "small", priority: 85 },
  { id: "sources", size: "full", priority: 80 }
];

console.log("=== Testing Real solveTileLayout in tileLayoutEngine.ts ===");

let allZero = true;
[12, 6, 4].forEach(cols => {
  const res = solveTileLayout(testTileInputs, cols);
  console.log(`Cols=${cols}: rows=${res.totalRows}, items=${res.items.length}, gapCount=${res.gapCount}`);
  if (res.gapCount > 0) allZero = false;
  res.items.forEach(item => {
    console.log(`  ${item.id}: w=${item.w} h=${item.h} at (x=${item.x}, y=${item.y})`);
  });
});

console.log(`\nAll Tile solver tests zero gaps: ${allZero ? "YES (PASSED)" : "NO (FAILED)"}`);
