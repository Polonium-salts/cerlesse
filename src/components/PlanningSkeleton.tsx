import React from "react";
import { motion } from "motion/react";
import { Sparkles, Bot, Layers, CheckCircle2 } from "lucide-react";

export interface PlanningSkeletonProps {
  estimatedWidgets?: number[]; // 如 [100, 50, 50, 25, 25] 表示各个磁贴的预计栅格宽度
  currentStepMessage?: string;
  query?: string;
}

export const PlanningSkeleton: React.FC<PlanningSkeletonProps> = ({
  estimatedWidgets = [100, 50, 50, 25, 25, 50],
  currentStepMessage = "正在检索全网信源并规划小组件排版...",
  query = ""
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 顶部加载状态微指示 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-primary/20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center size-9 rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="size-5 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Codex 智能体研报生成中
              </span>
              {query && (
                <span className="text-xs text-muted-foreground font-medium truncate max-w-[240px]">
                  “{query}”
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-foreground/80 mt-0.5 animate-pulse">
              {currentStepMessage}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground text-xs">
            <Layers className="size-3.5 text-primary" />
            <span>拓扑自适应布局预排版</span>
          </div>
        </div>
      </div>

      {/* 栅格占位形状预告 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        {estimatedWidgets.map((width, idx) => {
          const colSpanClass =
            width === 100
              ? "lg:col-span-12 min-h-[220px]"
              : width === 75
              ? "lg:col-span-9 min-h-[200px]"
              : width === 50
              ? "lg:col-span-6 min-h-[190px]"
              : "lg:col-span-3 min-h-[160px]";

          const isPrimary = idx === 0 && width === 100;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.25 }}
              className={`rounded-2xl border bg-card/60 p-4.5 flex flex-col justify-between overflow-hidden relative shadow-xs ${colSpanClass} ${
                isPrimary ? "border-primary/30 ring-1 ring-primary/10" : "border-border/60"
              }`}
            >
              {/* 卡片头部模拟 */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="size-5 rounded-lg bg-muted animate-pulse shrink-0" />
                  <div
                    className="h-4 rounded bg-muted animate-pulse"
                    style={{ width: isPrimary ? "140px" : "90px" }}
                  />
                </div>
                <div className="size-4 rounded-full bg-muted animate-pulse" />
              </div>

              {/* 卡片内部骨架条 */}
              <div className="space-y-2.5 py-3 flex-1">
                <div className="h-3.5 rounded bg-muted/80 animate-pulse w-11/12" />
                <div className="h-3.5 rounded bg-muted/60 animate-pulse w-4/5" />
                {isPrimary && (
                  <>
                    <div className="h-3.5 rounded bg-muted/70 animate-pulse w-full" />
                    <div className="h-3.5 rounded bg-muted/50 animate-pulse w-3/4" />
                    <div className="h-3.5 rounded bg-muted/60 animate-pulse w-5/6" />
                  </>
                )}
                {width >= 50 && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="h-10 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-10 rounded-lg bg-muted/40 animate-pulse" />
                  </div>
                )}
              </div>

              {/* 卡片底部模拟 */}
              <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground/60">
                <div className="h-3 rounded bg-muted/40 animate-pulse w-20" />
                <div className="h-3 rounded bg-muted/40 animate-pulse w-14" />
              </div>

              {/* 细微扫描流光 */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
