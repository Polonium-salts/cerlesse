import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, Globe, ShieldCheck, BrainCircuit, LayoutGrid, CheckCircle2, Clock } from "lucide-react";

export interface PlanningSkeletonProps {
  estimatedWidgets?: number[]; // 如 [100, 50, 50, 25, 25] 表示各个磁贴的预计栅格宽度
  currentStepMessage?: string;
  query?: string;
}

interface StepItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_STEPS: StepItem[] = [
  { id: "search", label: "多源并发检索", desc: "SearXNG 节点并行召回", icon: Globe },
  { id: "verify", label: "信源交叉核验", desc: "证书鉴别与权威度评估", icon: ShieldCheck },
  { id: "synthesis", label: "深度逻辑综合", desc: "结构化长研报与事实提炼", icon: BrainCircuit },
  { id: "layout", label: "12 栅格自适应排版", desc: "几何装箱拓扑求解", icon: LayoutGrid }
];

export const PlanningSkeleton: React.FC<PlanningSkeletonProps> = ({
  estimatedWidgets = [100, 50, 50, 25, 25, 50],
  currentStepMessage = "正在检索全网信源并规划小组件排版...",
  query = ""
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  // 根据耗时与消息内容自适应当前处于的执行阶段
  const currentStepIndex = React.useMemo(() => {
    const msg = (currentStepMessage || "").toLowerCase();
    if (msg.includes("排版") || msg.includes("装箱") || msg.includes("layout")) return 3;
    if (msg.includes("研报") || msg.includes("回答") || msg.includes("思考") || msg.includes("synthesis")) return 2;
    if (msg.includes("核验") || msg.includes("安全") || msg.includes("verify")) return 1;

    // 基于时间梯度的平滑进度预估
    if (elapsedMs < 2500) return 0;
    if (elapsedMs < 6000) return 1;
    if (elapsedMs < 14000) return 2;
    return 3;
  }, [currentStepMessage, elapsedMs]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 顶部动态多阶段感知器 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/20 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary shrink-0">
              <Sparkles className="size-5 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Codex 智能体研报生成中
                </span>
                {query && (
                  <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px] sm:max-w-[280px]">
                    “{query}”
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-medium text-foreground/90 mt-0.5 animate-pulse">
                {currentStepMessage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
              <Clock className="size-3.5 animate-spin" />
              <span>已用时 {elapsedSec}s</span>
            </div>
          </div>
        </div>

        {/* 动态步骤卡片流 (Step Stepper) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border/40">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all duration-300 ${
                  isCurrent
                    ? "bg-primary/10 border-primary/40 shadow-xs"
                    : isDone
                    ? "bg-muted/40 border-border/40 opacity-75"
                    : "bg-background/40 border-transparent opacity-40"
                }`}
              >
                <div
                  className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isCurrent
                      ? "bg-primary text-primary-foreground animate-pulse"
                      : isDone
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-semibold truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
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
              transition={{ delay: idx * 0.05, duration: 0.25 }}
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
