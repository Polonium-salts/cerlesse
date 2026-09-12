import { solveDesktopModularLayout, BentoWidgetInput } from "../src/lib/bentoLayoutEngine.js";

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

console.log("=== Testing Real solveDesktopModularLayout in bentoLayoutEngine.ts ===");

let allZeroGaps = true;

for (let cols = 1; cols <= 5; cols++) {
  console.log(`\n=== Testing ${cols} Columns ===`);
  const solution = solveDesktopModularLayout(testInputs, cols);
  console.log(`Total rows: ${solution.totalRows}, Items: ${solution.items.length}, Gap count: ${solution.gapCount}`);
  if (solution.gapCount > 0) allZeroGaps = false;
  solution.items.forEach(item => {
    console.log(`  ${item.key}: w=${item.colSpan} h=${item.rowSpan} at (r=${item.rowStart}, c=${item.colStart})`);
  });
}

console.log(`\nAll tests zero gaps: ${allZeroGaps ? "YES (PASSED)" : "NO (FAILED)"}`);
