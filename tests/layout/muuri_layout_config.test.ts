import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getMuuriCrossLayoutOptions, getMuuriItemWidthPercent } from "../../src/layout/muuriLayoutConfig.js";

describe("Muuri cross-packing layout configuration", () => {
  it("uses Muuri gap filling by default and disables pixel rounding gaps", () => {
    assert.deepEqual(getMuuriCrossLayoutOptions(), { fillGaps: true, rounding: false });
  });

  it("allows gap filling to be explicitly disabled", () => {
    assert.deepEqual(getMuuriCrossLayoutOptions(false), { fillGaps: false, rounding: false });
  });

  it("maps canonical tile widths to the active responsive grid instead of wrapping full-width items", () => {
    assert.equal(getMuuriItemWidthPercent(25, 12), 25);
    assert.equal(getMuuriItemWidthPercent(75, 12), 75);
    assert.equal(getMuuriItemWidthPercent(25, 6), 100 / 3);
    assert.equal(getMuuriItemWidthPercent(75, 6), 200 / 3);
    assert.equal(getMuuriItemWidthPercent(25, 4), 50);
  });
});
