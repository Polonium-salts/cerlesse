import React from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Progress } from "../../components/ui/progress.js";
import { TrendingUp } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";

interface AnalyticsTrendWidgetProps {
  result: SearchSynthesisResult;
}

/**
 * 信源相关度分布 (analytics_trend)
 *
 * shadcn/ui 重做要点：
 *   · 自绘进度条改为 shadcn Progress（bg-primary/20 轨道 + bg-primary 指示条）；
 *   · 移除此前"逐条递减透明度"的伪层级 —— shadcn 不用透明度表达排序，
 *     顺序本身（自上而下降序）已是排序信号；
 *   · 标题 text-xs text-foreground，分值 font-mono tabular-nums text-muted-foreground。
 *
 * 数据一律来自真实 relevanceScore（见 server/retrievalRanker.ts），无编造指标。
 */
export const AnalyticsTrendWidget: React.FC<AnalyticsTrendWidgetProps> = ({ result }) => {
  const ranked = (result.filteredResults || [])
    .map((item) => ({ title: item.title, score: Math.round(item.score ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (ranked.length === 0) return null;

  return (
    <IOSWidget
      id="widget-analytics-trend"
      title="信源相关度分布"
      icon={<TrendingUp className="size-4" />}
      className="w-full h-full"
    >
      <div className="flex flex-col gap-3">
        {ranked.map((item, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs text-foreground">{item.title}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {item.score}
              </span>
            </div>
            <Progress value={item.score} className="h-1.5" />
          </div>
        ))}
      </div>
    </IOSWidget>
  );
};
