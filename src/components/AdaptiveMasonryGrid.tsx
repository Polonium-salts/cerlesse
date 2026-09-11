import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { Sparkles, Puzzle } from "lucide-react";
import {
  ResultWidgetKey,
  AdaptiveLayoutStrategy,
  LayoutAlignmentMode,
  AutoFillGapsMode
} from "../types.js";

interface AdaptiveMasonryGridProps {
  strategy: AdaptiveLayoutStrategy;
  enabledWidgets: ResultWidgetKey[];
  isWideCanvas: boolean;
  alignmentMode: LayoutAlignmentMode;
  autoFillGaps?: boolean;
  autoFillMode?: AutoFillGapsMode;
  renderWidget: (key: ResultWidgetKey, isCompact?: boolean) => React.ReactNode;
  getGridClassForWidget: (key: ResultWidgetKey, isEmphasized: boolean) => string;
}

// Estimated default heights in pixels to prevent initial layout shift before DOM measurement
const ESTIMATED_HEIGHTS: Record<ResultWidgetKey, number> = {
  quick_answer: 260,
  takeaways: 260,
  official_portal: 190,
  metrics_telemetry: 210,
  actions_toolbox: 180,
  analytics_trend: 190,
  verification_checklist: 220,
  fast_chat: 240,
  mobile_qr: 180,
  topic_digest: 300,
  mindmap: 480,
  comparison: 420,
  sources: 380,
  followup: 200,
  agent_workflow: 240,
  ai_overview: 400,
  custom_cards: 280
};

interface WidgetPosition {
  left: number;
  top: number;
  width: number;
  height: number;
  itemCols: number;
  isAutoFilled: boolean;
}

export const AdaptiveMasonryGrid: React.FC<AdaptiveMasonryGridProps> = ({
  strategy,
  enabledWidgets,
  isWideCanvas: _isWideCanvas,
  alignmentMode = "masonry",
  autoFillGaps = true,
  autoFillMode = "dense",
  renderWidget,
  getGridClassForWidget: _getGridClassForWidget
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Measured container width
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth > 1280 ? 1200 : window.innerWidth > 768 ? 720 : 360;
    }
    return 1200;
  });

  // Measured card heights from real DOM nodes
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  // 1. Setup ResizeObserver to track container width and individual card heights
  useEffect(() => {
    if (!containerRef.current) return;

    // Immediately record current container clientWidth
    if (containerRef.current.clientWidth > 0) {
      setContainerWidth(containerRef.current.clientWidth);
    }

    const observer = new ResizeObserver((entries) => {
      let nextWidth: number | null = null;
      const heightUpdates: Record<string, number> = {};

      for (const entry of entries) {
        if (entry.target === containerRef.current) {
          const w = Math.round(entry.contentRect.width);
          if (w > 0) {
            nextWidth = w;
          }
        } else {
          const key = (entry.target as HTMLElement).dataset.widgetKey as ResultWidgetKey;
          if (key) {
            const h = Math.round(entry.contentRect.height);
            if (h > 0) {
              heightUpdates[key] = h;
            }
          }
        }
      }

      if (nextWidth !== null) {
        setContainerWidth((prev) => (Math.abs(prev - nextWidth!) >= 4 ? nextWidth! : prev));
      }

      if (Object.keys(heightUpdates).length > 0) {
        setMeasuredHeights((prev) => {
          let hasDiff = false;
          const next = { ...prev };
          for (const [k, h] of Object.entries(heightUpdates)) {
            if (Math.abs((prev[k] || 0) - h) >= 3) {
              next[k] = h;
              hasDiff = true;
            }
          }
          return hasDiff ? next : prev;
        });
      }
    });

    observer.observe(containerRef.current);

    // Observe all currently registered card elements
    Object.entries(cardElementsRef.current).forEach(([_key, el]) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [enabledWidgets]);

  // 2. Compute column count and geometry
  // Breakpoints: Mobile < 640px (1 col), Tablet 640-1023px (2 cols), Desktop >= 1024px (4 cols)
  const numCols = useMemo(() => {
    if (containerWidth < 640) return 1;
    if (containerWidth < 1024) return 2;
    return 4;
  }, [containerWidth]);

  const GAP = 16; // 16px gap (matches Tailwind gap-4)
  const colWidth = useMemo(() => {
    return Math.max(1, (containerWidth - (numCols - 1) * GAP) / numCols);
  }, [containerWidth, numCols]);

  // 3. True Fluid Masonry Dynamic-Height Bin Packing Calculation
  // This completely eliminates the "unified horizontal line" constraint:
  // Each card is placed into the lowest available column(s) based on actual heights.
  const { positions, totalHeight } = useMemo(() => {
    const posMap: Record<ResultWidgetKey, WidgetPosition> = {} as any;
    const colHeights = new Array(numCols).fill(0);

    // Queue of widgets to position
    const pending = [...enabledWidgets];
    const isAutoFillEnabled = autoFillGaps && autoFillMode !== "off";

    while (pending.length > 0) {
      // Helper to compute column span for current screen width
      const getSpanForWidget = (key: ResultWidgetKey): number => {
        const placement = strategy.gridConfig?.[key];
        const span12 = placement?.colSpanLg || 3;
        if (numCols === 1) return 1;
        if (numCols === 2) return span12 <= 6 ? 1 : 2;
        // 4 cols
        if (span12 <= 3) return 1;
        if (span12 <= 6) return 2;
        if (span12 <= 9) return 3;
        return 4;
      };

      let selectedIndex = 0;
      let isAutoFilledGap = false;

      // 🎯 DENSE VALLEY AUTO-FILL:
      // If there is a deep vertical valley (gap) among columns, and the head card
      // is too wide to fit in the valley without jumping to a higher baseline,
      // look ahead in the queue for a single-column card that can immediately
      // fill the valley from the bottom!
      if (isAutoFillEnabled && autoFillMode === "dense" && pending.length > 1 && numCols > 1) {
        const minH = Math.min(...colHeights);
        const maxH = Math.max(...colHeights);
        const valleyDepth = maxH - minH;

        const headSpan = getSpanForWidget(pending[0]);

        // If the head card is multi-column (> 1) and there's a valley > 60px:
        if (headSpan > 1 && valleyDepth > 60) {
          // Find the column index of the valley
          const valleyCol = colHeights.indexOf(minH);
          // Check if adjacent columns are also low enough; if not, a 1-column card is ideal
          const lookaheadIdx = pending.findIndex((k, idx) => idx > 0 && getSpanForWidget(k) === 1);
          if (lookaheadIdx !== -1) {
            selectedIndex = lookaheadIdx;
            isAutoFilledGap = true;
          }
        }
      }

      const [key] = pending.splice(selectedIndex, 1);
      const itemCols = Math.min(getSpanForWidget(key), numCols);

      // Find the starting column that yields the MINIMUM top position (highest available slot)
      let bestStartCol = 0;
      let minCandidateTop = Infinity;

      for (let c = 0; c <= numCols - itemCols; c++) {
        const candidateTop = Math.max(...colHeights.slice(c, c + itemCols));
        if (candidateTop < minCandidateTop) {
          minCandidateTop = candidateTop;
          bestStartCol = c;
        }
      }

      const cardLeft = Math.round(bestStartCol * (colWidth + GAP));
      const cardTop = Math.round(minCandidateTop);
      const cardWidth = Math.round(itemCols * colWidth + (itemCols - 1) * GAP);
      const cardHeight = measuredHeights[key] || ESTIMATED_HEIGHTS[key] || 240;

      // Update the tracked heights of the occupied columns
      for (let c = bestStartCol; c < bestStartCol + itemCols; c++) {
        colHeights[c] = cardTop + cardHeight + GAP;
      }

      posMap[key] = {
        left: cardLeft,
        top: cardTop,
        width: cardWidth,
        height: cardHeight,
        itemCols,
        isAutoFilled: isAutoFilledGap || Boolean(strategy.gridConfig?.[key]?.isAutoFilled)
      };
    }

    const maxColHeight = Math.max(...colHeights, 320);

    return {
      positions: posMap,
      totalHeight: maxColHeight
    };
  }, [enabledWidgets, numCols, colWidth, measuredHeights, strategy, autoFillGaps, autoFillMode]);

  // Callback to register each card DOM element for height measurement
  const registerCardRef = useCallback((key: ResultWidgetKey) => {
    return (el: HTMLDivElement | null) => {
      cardElementsRef.current[key] = el;
    };
  }, []);

  // -------------------------------------------------------------
  // MODE 1: Standard CSS Grid (When user explicitly chooses "grid" mode)
  // Cards are aligned along standard horizontal row lines.
  // -------------------------------------------------------------
  if (alignmentMode === "grid") {
    return (
      <div
        ref={containerRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start auto-rows-auto w-full"
      >
        {enabledWidgets.map((key) => {
          const isEmphasized = key === strategy.emphasizedWidget;
          const placement = strategy.gridConfig?.[key];
          const span = placement?.colSpanLg || 3;

          let fourColSpanClass = "col-span-1";
          if (span <= 3) {
            fourColSpanClass = "col-span-1";
          } else if (span <= 6) {
            fourColSpanClass = "col-span-1 sm:col-span-2 lg:col-span-2";
          } else if (span <= 9) {
            fourColSpanClass = "col-span-1 sm:col-span-2 lg:col-span-3";
          } else {
            fourColSpanClass = "col-span-1 sm:col-span-2 lg:col-span-4";
          }

          return (
            <motion.div
              key={key}
              layout="position"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className={`${fourColSpanClass} flex flex-col min-w-0 self-start transition-all`}
            >
              {isEmphasized && (
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold w-fit shrink-0">
                    <Sparkles className="w-3 h-3 text-blue-500 animate-pulse" />
                    <span>Agent 优先聚焦</span>
                  </div>
                </div>
              )}
              {renderWidget(key, placement?.isCompact ?? (span <= 4))}
            </motion.div>
          );
        })}
      </div>
    );
  }

  // -------------------------------------------------------------
  // MODE 2: True Fluid Masonry (Default "masonry" mode)
  // Completely removes the unified horizontal line constraint:
  // Each card floats upwards into the lowest vertical gap independently!
  // -------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height: `${totalHeight}px`,
        minHeight: "400px"
      }}
      className="w-full transition-[height] duration-300 ease-out"
    >
      {enabledWidgets.map((key) => {
        const isEmphasized = key === strategy.emphasizedWidget;
        const pos = positions[key];
        const placement = strategy.gridConfig?.[key];

        if (!pos) return null;

        return (
          <motion.div
            key={key}
            ref={registerCardRef(key)}
            data-widget-key={key}
            initial={false}
            animate={{
              x: pos.left,
              y: pos.top,
              width: pos.width,
              opacity: 1
            }}
            transition={{
              duration: 0.32,
              ease: [0.16, 1, 0.3, 1]
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${pos.width}px`
            }}
            className="flex flex-col min-w-0"
          >
            {/* Header Badges: Emphasized & True Gap-Filled Indicators */}
            {(isEmphasized || pos.isAutoFilled) && (
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {isEmphasized && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold w-fit shrink-0 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-blue-500 animate-pulse" />
                    <span>Agent 优先聚焦</span>
                  </div>
                )}
                {pos.isAutoFilled && (
                  <div
                    title="此卡片突破统一水平线限制，自动紧贴上方较短卡片探底补位，彻底消除垂直与横向空白"
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium w-fit shrink-0 shadow-2xs"
                  >
                    <Puzzle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>智能探底补位</span>
                  </div>
                )}
              </div>
            )}

            {renderWidget(key, placement?.isCompact ?? (pos.itemCols <= 1))}
          </motion.div>
        );
      })}
    </div>
  );
};
