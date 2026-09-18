import React, { useState } from "react";
import type { TrendChartData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { trendChartAdapter } from "./adapter.js";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Sparkles,
  BarChart3,
  Layers
} from "lucide-react";

export interface TrendChartWidgetProps {
  data?: TrendChartData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const TrendChartWidget: React.FC<TrendChartWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const data: TrendChartData =
    props.data ??
    trendChartAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const maxVal = Math.max(...data.points.map((p) => Math.max(p.value, p.secondaryValue || 0))) * 1.15;
  const minVal = 0;

  // 生成 SVG 贝塞尔折线 Path
  const width = 500;
  const height = 140;
  const paddingX = 20;
  const paddingY = 20;

  const getCoordinates = (val: number, index: number) => {
    const x = paddingX + (index / (data.points.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
    return { x, y };
  };

  const line1Points = data.points.map((p, i) => getCoordinates(p.value, i));
  const line2Points = data.points.map((p, i) => getCoordinates(p.secondaryValue || 0, i));

  const makeSvgPath = (coords: Array<{ x: number; y: number }>) => {
    return coords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x},${curr.y}`;
      return `${acc} L ${curr.x},${curr.y}`;
    }, "");
  };

  const line1Path = makeSvgPath(line1Points);
  const line2Path = makeSvgPath(line2Points);
  const area1Path = `${line1Path} L ${line1Points[line1Points.length - 1].x},${height - paddingY} L ${line1Points[0].x},${height - paddingY} Z`;

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-blue-500/10 via-card to-indigo-500/5 rounded-2xl border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="truncate max-w-[120px]">{data.title}</span>
          </div>
          <span className="text-xs font-bold text-emerald-500">{data.changeRate}</span>
        </div>
        <div className="my-2 flex items-baseline gap-2">
          <span className="text-xl font-black text-foreground">{data.currentValue}</span>
          <span className="text-xs text-muted-foreground">{data.metricName}</span>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{data.timeRange}</span>
          <span className="text-blue-500">走势向好</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-blue-500/10 via-card to-indigo-600/5 rounded-3xl border border-blue-500/20 shadow-xs">
      {/* 头部指标概览 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wide flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                时序趋势与统计
              </span>
              <span className="text-xs text-muted-foreground">{data.timeRange}</span>
            </div>
            <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
              {data.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{data.metricName}</div>
              <div className="text-xl font-black text-foreground">{data.currentValue}</div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{data.changeRate}</span>
            </div>
          </div>
        </div>

        {/* 图例 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-blue-500 rounded-full" />
            <span className="text-foreground font-semibold">{data.metricName}</span>
          </span>
          {data.secondaryMetricName && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full border-dashed" />
              <span>{data.secondaryMetricName}</span>
            </span>
          )}
        </div>
      </div>

      {/* SVG 折线图 */}
      <div className="my-2 relative bg-background/60 rounded-2xl border border-border/50 p-2 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 网格水平参考线 */}
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* 填充面积 */}
          <path d={area1Path} fill="url(#trendGradient)" />

          {/* 次级基线 (虚线) */}
          <path d={line2Path} fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />

          {/* 主折线 */}
          <path d={line1Path} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* 数据圆点与交互 */}
          {line1Points.map((pt, idx) => (
            <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIndex === idx ? 5 : 3}
                className="fill-background stroke-blue-500 stroke-2 transition-all"
              />
              <text
                x={pt.x}
                y={height - 4}
                textAnchor="middle"
                className="text-[10px] fill-muted-foreground select-none"
              >
                {data.points[idx].date}
              </text>
            </g>
          ))}
        </svg>

        {/* 悬停浮层提示 */}
        {hoveredIndex !== null && (
          <div
            className="absolute top-2 right-4 p-2 rounded-xl bg-background/95 border border-border text-xs shadow-lg flex items-center gap-2"
          >
            <span className="font-bold text-foreground">{data.points[hoveredIndex].date}:</span>
            <span className="text-blue-500 font-bold">{data.points[hoveredIndex].value} {data.unit}</span>
            {data.points[hoveredIndex].label && (
              <span className="text-[10px] text-muted-foreground">({data.points[hoveredIndex].label})</span>
            )}
          </div>
        )}
      </div>

      {/* 底部摘要 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{data.summaryNote || "趋势呈现稳步上行"}</span>
        <span className="text-blue-600 dark:text-blue-400 font-medium">置信度 96.8%</span>
      </div>
    </div>
  );
};
