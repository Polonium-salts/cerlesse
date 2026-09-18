import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  solveTileLayout,
  normalizeTileWidth,
  TILE_WIDTHS,
  type TileLayoutInput,
  type TileWidth
} from "../../../src/lib/tileLayoutEngine.js";

describe("Tile Matrix Layout Engine", () => {
  it("should normalize diverse legacy widths to standard 4-tier ladder (25%, 50%, 75%, 100%)", () => {
    assert.equal(normalizeTileWidth(25), 25);
    assert.equal(normalizeTileWidth(50), 50);
    assert.equal(normalizeTileWidth(75), 75);
    assert.equal(normalizeTileWidth(100), 100);

    // Legacy names
    assert.equal(normalizeTileWidth("small"), 25);
    assert.equal(normalizeTileWidth("medium"), 25);
    assert.equal(normalizeTileWidth("half"), 50);
    assert.equal(normalizeTileWidth("large"), 50);
    assert.equal(normalizeTileWidth("wide"), 75);
    assert.equal(normalizeTileWidth("full"), 100);

    // Fallbacks
    assert.equal(normalizeTileWidth(null), 50);
    assert.equal(normalizeTileWidth(undefined), 50);
  });

  it("should solve a packed 12-column grid for combinations of 25%, 50%, 75%, 100% tiles without overlapping", () => {
    const inputs: TileLayoutInput[] = [
      { id: "hero", size: 100, ratio: "16:9" },
      { id: "tileA", size: 50, ratio: "4:3" },
      { id: "tileB", size: 50, ratio: "4:3" },
      { id: "tileC", size: 25, ratio: "1:1" },
      { id: "tileD", size: 75, ratio: "3:2" }
    ];

    const solution = solveTileLayout(inputs, {
      totalColumns: 12,
      containerWidth: 1200,
      columnGap: 16,
      rowGap: 16
    });

    assert.equal(solution.items.length, 5);

    // Every tile should have valid positive coordinates and spans
    for (const tile of solution.items) {
      assert.ok(tile.x >= 0 && tile.x < 12, `Column ${tile.x} should be within 0..11`);
      assert.ok(tile.w >= 1 && tile.w <= 12, `Span ${tile.w} should be within 1..12`);
      assert.ok(tile.x + tile.w <= 12, `Column + span should not exceed totalColumns`);
      assert.ok(tile.y >= 0, `y must be non-negative`);
      assert.ok(tile.pixelWidth > 0, `pixelWidth must be positive`);
      assert.ok(tile.pixelHeight > 0, `pixelHeight must be positive`);
    }

    // Check no overlap: for any two tiles sharing column range, vertical ranges must not overlap
    for (let i = 0; i < solution.items.length; i++) {
      for (let j = i + 1; j < solution.items.length; j++) {
        const a = solution.items[i];
        const b = solution.items[j];

        const colOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
        if (colOverlap) {
          const yOverlap = a.y < b.y + b.pixelHeight && a.y + a.pixelHeight > b.y;
          assert.ok(
            !yOverlap,
            `Tiles ${a.id} and ${b.id} must not overlap in same columns: cols [${a.x}..${a.x+a.w}]/[${b.x}..${b.x+b.w}], y [${a.y}..${a.y+a.pixelHeight}]/[${b.y}..${b.y+b.pixelHeight}]`
          );
        }
      }
    }
  });

  it("should support responsive column counts (6-col tablet and 4-col mobile)", () => {
    const inputs: TileLayoutInput[] = [
      { id: "tile1", size: 50, ratio: "4:3" },
      { id: "tile2", size: 50, ratio: "4:3" }
    ];

    // 6 columns
    const sol6 = solveTileLayout(inputs, { totalColumns: 6, containerWidth: 768 });
    assert.equal(sol6.items.length, 2);
    for (const t of sol6.items) {
      assert.ok(t.x + t.w <= 6);
    }

    // 4 columns
    const sol4 = solveTileLayout(inputs, { totalColumns: 4, containerWidth: 480 });
    assert.equal(sol4.items.length, 2);
    for (const t of sol4.items) {
      assert.ok(t.x + t.w <= 4);
    }
  });
});
