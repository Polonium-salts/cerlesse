/**
 * 响应式栅格断点与重排器 (Responsive Layout Reflow)
 * 适配 Desktop (12 列), Tablet (8 列), Mobile (4 列)
 */

export type ResponsiveDeviceTier = "desktop" | "tablet" | "mobile";

export interface ResponsiveConfig {
  tier: ResponsiveDeviceTier;
  columns: number;
  rowUnitPx: number;
  gapPx: number;
}

export function getResponsiveConfig(containerWidth: number): ResponsiveConfig {
  if (containerWidth < 640) {
    return {
      tier: "mobile",
      columns: 4,
      rowUnitPx: 56,
      gapPx: 12
    };
  } else if (containerWidth < 1024) {
    return {
      tier: "tablet",
      columns: 8,
      rowUnitPx: 60,
      gapPx: 14
    };
  } else {
    return {
      tier: "desktop",
      columns: 12,
      rowUnitPx: 64,
      gapPx: 16
    };
  }
}
