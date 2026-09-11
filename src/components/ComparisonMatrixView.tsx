import React, { useState } from "react";
import { ComparisonDimension } from "../types.js";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { ExternalLink, CheckCircle, HelpCircle, ShieldAlert, Sparkles, Filter } from "lucide-react";

interface ComparisonMatrixViewProps {
  comparisonTable: ComparisonDimension[];
  query: string;
}

export const ComparisonMatrixView: React.FC<ComparisonMatrixViewProps> = ({
  comparisonTable,
  query
}) => {
  const [selectedDimensionIndex, setSelectedDimensionIndex] = useState<number | null>(null);

  if (!comparisonTable || comparisonTable.length === 0) {
    return (
      <Card className="p-8 text-center border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
        <p className="text-sm text-zinc-500">暂无多源对比数据，请尝试开启“深度 Agent 检索”</p>
      </Card>
    );
  }

  const displayedDimensions = selectedDimensionIndex !== null
    ? [comparisonTable[selectedDimensionIndex]]
    : comparisonTable;

  return (
    <div className="space-y-6">
      {/* Overview & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>多源交叉对比矩阵</span>
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Agent 基于 SearXNG 抓取的多重独立信源，按核心维度进行观点交叉验证与冲突消解
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setSelectedDimensionIndex(null)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              selectedDimensionIndex === null
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            全维度 ({comparisonTable.length})
          </button>
          {comparisonTable.map((dim, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDimensionIndex(idx)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors truncate max-w-[140px] ${
                selectedDimensionIndex === idx
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              {dim.dimension}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Cards / Grids */}
      <div className="space-y-5">
        {displayedDimensions.map((item, dIdx) => (
          <Card
            key={dIdx}
            className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm overflow-hidden"
          >
            <CardHeader className="bg-zinc-50/70 dark:bg-zinc-900/90 border-b border-zinc-100 dark:border-zinc-800 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-emerald-500"></span>
                  <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {item.dimension}
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[11px] self-start sm:self-auto font-mono">
                  {item.sourcesBreakdown.length} 个对照来源
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-2 leading-relaxed bg-white/60 dark:bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">维度综述：</span>
                {item.summary}
              </p>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {item.sourcesBreakdown.map((src, sIdx) => {
                  const getConfidenceBadge = (conf: string) => {
                    if (conf === "高") {
                      return <Badge variant="success" className="text-[10px]">可信度 高</Badge>;
                    }
                    if (conf === "中") {
                      return <Badge variant="warning" className="text-[10px]">可信度 中</Badge>;
                    }
                    return <Badge variant="outline" className="text-[10px]">参考信息</Badge>;
                  };

                  return (
                    <div
                      key={sIdx}
                      className="flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {src.sourceType}
                          </span>
                          {getConfidenceBadge(src.confidence)}
                        </div>

                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors line-clamp-1 flex items-center gap-1.5"
                        >
                          <span className="truncate">{src.sourceTitle}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-zinc-400" />
                        </a>

                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                          {src.pointOfView}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="truncate max-w-[200px]">
                          {new URL(src.sourceUrl).hostname}
                        </span>
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium"
                        >
                          核查原文 →
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
