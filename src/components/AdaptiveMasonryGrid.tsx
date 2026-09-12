import React from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import {
  ResultWidgetKey,
  AdaptiveLayoutStrategy,
  LayoutAlignmentMode,
  AutoFillGapsMode
} from "../types.js";
import {
  normalizeWidthToGridClass,
  normalizeWidgetSpan,
  resolveDynamicCapabilityWidgets
} from "../lib/adaptiveLayout.js";

interface AdaptiveMasonryGridProps {
  strategy: AdaptiveLayoutStrategy;
  enabledWidgets: ResultWidgetKey[];
  isWideCanvas?: boolean;
  alignmentMode?: LayoutAlignmentMode;
  autoFillGaps?: boolean;
  autoFillMode?: AutoFillGapsMode;
  renderWidget: (key: ResultWidgetKey, isCompact?: boolean) => React.ReactNode;
  getGridClassForWidget?: (key: ResultWidgetKey, isEmphasized: boolean) => string;
}

export const AdaptiveMasonryGrid: React.FC<AdaptiveMasonryGridProps> = ({
  strategy,
  enabledWidgets,
  renderWidget
}) => {
  // Filter only widgets that are present in enabledWidgets with safe fallback
  const rawList = enabledWidgets && enabledWidgets.length > 0
    ? enabledWidgets
    : (strategy.componentOrder && strategy.componentOrder.length > 0 ? strategy.componentOrder : resolveDynamicCapabilityWidgets(strategy.intentType || "balanced"));

  const activeWidgets = rawList.filter(Boolean);

  return (
    <div className="w-full">
      {/* 12-Column CSS Grid - Robust, Native, Zero-Blank & Content-Aware */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start auto-rows-auto w-full">
        {activeWidgets.map((key) => {
          const isEmphasized = key === strategy.emphasizedWidget || key === strategy.layoutPlan?.featured;
          const placement = strategy.gridConfig?.[key];
          const semanticWidth = strategy.layoutPlan?.width?.[key] || placement?.semanticWidth;
          const rawSpan = strategy.customWidgetSpans?.[key] ?? placement?.colSpanLg;
          const normalizedSpan = normalizeWidgetSpan(rawSpan, semanticWidth);
          const spanClass = normalizeWidthToGridClass(rawSpan, semanticWidth);
          const isCompact = placement?.isCompact ?? (normalizedSpan <= 4 || semanticWidth === "compact");

          return (
            <motion.div
              key={key}
              layout="position"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={`${spanClass} flex flex-col min-w-0 self-start transition-all`}
            >
              {isEmphasized && (
                <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold tracking-tight shadow-xs">
                    <Sparkles className="w-3 h-3 text-blue-500 animate-pulse" />
                    <span>Agent 优先聚焦</span>
                  </div>
                </div>
              )}
              {renderWidget(key, isCompact)}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
