import React from "react";
import { cn } from "../../lib/utils.js";
import { Label } from "./label.js";

/**
 * 小组件专用的复合件层 (Widget Composites)
 * ============================================================
 * shadcn/ui 官方组件（src/components/ui/*.tsx，由 CLI 生成）覆盖了
 * Card / Button / Badge / Tabs / Table / Alert 等通用语汇。
 * 本文件只保留 **shadcn 没有对应物** 的几件小组件专用复合件，
 * 全部沿用语义令牌（bg-card / text-muted-foreground / border-border …）。
 */

/* ================================================================== */
/* Field：shadcn Form 的字段骨架（label + 控件 + 可选 hint）            */
/* ================================================================== */

export const WuField: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, children, className }) => (
  <div className={cn("grid gap-2", className)}>
    <div className="flex items-baseline justify-between">
      <Label className="text-sm">{label}</Label>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
    {children}
  </div>
);

/* ================================================================== */
/* Stat / 指标                                                        */
/* ================================================================== */

export const WuStat: React.FC<{
  label?: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}> = ({ label, value, hint, className }) => (
  <div className={cn("flex flex-col gap-1", className)}>
    {label && <span className="text-muted-foreground text-xs">{label}</span>}
    <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</span>
    {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
  </div>
);

/* ================================================================== */
/* 单色图表：柱状 / 面积                                               */
/* ================================================================== */

export const WuBars: React.FC<{
  data: number[];
  labels?: string[];
  highlightIndex?: number;
  className?: string;
}> = ({ data, labels, highlightIndex, className }) => {
  const max = Math.max(...data, 1);
  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-1.5", className)}>
      <div className="flex flex-1 items-end gap-1.5">
        {data.map((v, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-sm transition-colors",
              i === highlightIndex ? "bg-foreground/80" : "bg-foreground/25"
            )}
            style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      {labels && (
        <div className="flex gap-1.5">
          {labels.map((l, i) => (
            <span key={i} className="text-muted-foreground flex-1 truncate text-center text-xs">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** 单色面积折线（保持 viewBox 无损缩放） */
export const WuArea: React.FC<{ data: number[]; className?: string }> = ({ data, className }) => {
  if (data.length < 2) return null;
  const w = 100;
  const h = 36;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = points.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height: h }}
    >
      <polygon points={area} className="fill-foreground/10" />
      <polyline
        points={line}
        fill="none"
        className="stroke-foreground/60"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/* ================================================================== */
/* Empty：空态占位                                                     */
/* ================================================================== */

export const WuEmpty: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children
}) => (
  <div
    className={cn(
      "text-muted-foreground flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-sm text-center",
      className
    )}
  >
    {children}
  </div>
);
