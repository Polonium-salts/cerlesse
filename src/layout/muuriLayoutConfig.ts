import type { TileWidth } from "../lib/tileLayoutEngine.js";

export interface MuuriCrossLayoutOptions {
  fillGaps: boolean;
  rounding: boolean;
}

/** Muuri's native fillGaps packing is the canonical cross-interleaving algorithm. */
export function getMuuriCrossLayoutOptions(fillGaps = true): MuuriCrossLayoutOptions {
  return { fillGaps, rounding: false };
}

/** Match the desktop's canonical spans while keeping tablet/mobile cards readable. */
export function getMuuriItemWidthPercent(size: TileWidth, totalColumns: number): number {
  if (totalColumns <= 4) {
    if (size === 25) return 50;
    if (size === 75) return 75;
    return 100;
  }
  if (totalColumns <= 6) {
    if (size === 25) return 100 / 3;
    if (size === 50) return 50;
    if (size === 75) return 200 / 3;
    return 100;
  }
  return size;
}
