import React, { useState } from "react";
import { ComparisonDimension } from "../types.js";
import { IOSWidget } from "./ui/IOSWidget.js";
import { Scale, ExternalLink, Globe } from "lucide-react";

interface ComparisonMatrixWidgetProps {
  comparisonTable: ComparisonDimension[];
  query: string;
}

export const ComparisonMatrixWidget: React.FC<ComparisonMatrixWidgetProps> = ({
  comparisonTable,
  query
}) => {
  const [selectedDimensionIndex, setSelectedDimensionIndex] = useState<number | null>(null);

  if (!comparisonTable || comparisonTable.length === 0) {
    return null;
  }

  const displayedDimensions = selectedDimensionIndex !== null
    ? [comparisonTable[selectedDimensionIndex]]
    : comparisonTable;

  return (
    <IOSWidget
      id="widget-comparison-matrix"
      title="多源交叉对比矩阵"
      subtitle="多维比对 · 观点交叉验证与消解"
      icon={<Scale className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
      badge={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
          {comparisonTable.length} 个维度
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedDimensionIndex(null)}
            className={`px-2 py-1 rounded-xl text-xs font-semibold transition-colors ${
              selectedDimensionIndex === null
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            全部
          </button>
          {comparisonTable.slice(0, 3).map((dim, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedDimensionIndex(idx)}
              className={`px-2 py-1 rounded-xl text-xs font-semibold transition-colors truncate max-w-[100px] ${
                selectedDimensionIndex === idx
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              {dim.dimension}
            </button>
          ))}
        </div>
      }
      className="w-full"
    >
      <div className="space-y-4">
        {displayedDimensions.map((item, dIdx) => (
          <div
            key={dIdx}
            className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/80 space-y-3"
          >
            {/* Dimension Title */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-600 shadow-2xs">
                {item.dimension}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                信源拆解分析
              </span>
            </div>

            {item.summary && (
              <p className="text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed font-normal bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                {item.summary}
              </p>
            )}

            {/* Individual Source Perspectives Grid */}
            {item.sourcesBreakdown && item.sourcesBreakdown.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {item.sourcesBreakdown.map((p, pIdx) => {
                  let domain = "";
                  try {
                    domain = new URL(p.sourceUrl).hostname;
                  } catch {
                    domain = p.sourceTitle;
                  }

                  return (
                    <div
                      key={pIdx}
                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200/60 dark:border-zinc-700/70 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1 text-[11px]">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {p.sourceTitle}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0 font-medium">
                            {p.sourceType}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug">
                          {p.pointOfView}
                        </p>
                      </div>

                      {p.sourceUrl && (
                        <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-700/60 flex items-center justify-between text-[10px] text-zinc-400">
                          <span className="truncate">{domain}</span>
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </IOSWidget>
  );
};
