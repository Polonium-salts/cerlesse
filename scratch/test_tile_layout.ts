import { solveTileLayout, TileLayoutInput } from "../src/lib/tileLayoutEngine.js";

const mockInputs: TileLayoutInput[] = [
  { id: "ai_overview", size: "large", priority: 100, isEmphasized: true },
  { id: "weather", size: "small", priority: 80 },
  { id: "stock", size: "small", priority: 70 },
  { id: "calendar", size: "medium", priority: 85 },
  { id: "music", size: "wide", priority: 75 },
  { id: "news", size: "small", priority: 60 },
  { id: "photo", size: "large", priority: 65 }
];

console.log("=== Testing 12-Column Desktop Tile Layout ===");
const sol12 = solveTileLayout(mockInputs, 12);
console.log(`Placed ${sol12.items.length} tiles across ${sol12.totalRows} rows, gapCount: ${sol12.gapCount}`);
sol12.items.forEach(t => {
  console.log(`- [${t.id}] size=${t.size}, x=${t.x}, y=${t.y}, w=${t.w}, h=${t.h}, gridCol='${t.gridStyle.gridColumn}', gridRow='${t.gridStyle.gridRow}'`);
});

// Collision check
const grid: string[][] = Array.from({ length: sol12.totalRows }, () => Array(12).fill("."));
let collisions = 0;
for (const t of sol12.items) {
  for (let r = 0; r < t.h; r++) {
    for (let c = 0; c < t.w; c++) {
      const y = t.y + r;
      const x = t.x + c;
      if (grid[y][x] !== ".") {
        console.error(`COLLISION at (${x}, ${y}) between ${grid[y][x]} and ${t.id}!`);
        collisions++;
      }
      grid[y][x] = t.id.slice(0, 3);
    }
  }
}

console.log("\nGrid map:");
grid.forEach((row, i) => {
  console.log(`Row ${i.toString().padStart(2, "0")}: |` + row.map(cell => cell.padEnd(4, " ")).join("|") + "|");
});

if (collisions === 0) {
  console.log("\n>>> PASS: 0 collisions detected! Flawless 12-column packing.");
} else {
  console.error(`\n>>> FAIL: ${collisions} collisions detected!`);
  process.exit(1);
}
