import { calculateAdaptiveBinPacking } from "../src/lib/adaptiveLayout.js";
import { ResultWidgetKey, AutoFillGapsMode } from "../src/types.js";

const sampleOrder: ResultWidgetKey[] = [
  "ai_overview",
  "mindmap",
  "quick_answer",
  "metrics_telemetry",
  "takeaways"
];

console.log("=== Testing Real calculateAdaptiveBinPacking in adaptiveLayout.ts ===");

let passed = true;

(["off", "stretch", "dense"] as AutoFillGapsMode[]).forEach(mode => {
  console.log(`\n--- Mode: ${mode} ---`);
  const result = calculateAdaptiveBinPacking(sampleOrder, {
    autoFillGaps: mode !== "off",
    autoFillMode: mode,
    enabledWidgets: sampleOrder
  });
  console.log(`Total rows: ${result.totalRows}, filledGapsCount: ${result.filledGapsCount}`);
  if (mode !== "off" && result.filledGapsCount === 0) {
    passed = false;
  }
  Object.entries(result.gridConfig).forEach(([key, cfg]) => {
    console.log(`  ${key}: row=${cfg.rowIndex}, colSpanLg=${cfg.colSpanLg}, autoFilled=${cfg.isAutoFilled}`);
  });
});

console.log(`\nAll packing tests passed: ${passed ? "YES (PASSED)" : "NO (FAILED)"}`);
