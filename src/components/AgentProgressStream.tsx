import React, { useState } from "react";
import { AgentStep } from "../types.js";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Bot,
  Search,
  Blocks,
  LayoutGrid,
  ArrowRight,
  Sparkles,
  Zap,
  Activity
} from "lucide-react";
import { IOSWidget } from "./ui/IOSWidget.js";
import { Badge } from "./ui/badge.js";

interface AgentProgressStreamProps {
  steps: AgentStep[];
  query: string;
  isComplete: boolean;
  executionTimeMs?: number;
}

export const AgentProgressStream: React.FC<AgentProgressStreamProps> = ({
  steps,
  query,
  isComplete,
  executionTimeMs
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedStepId(expandedStepId === id ? null : id);
  };

  const getStepIcon = (id: string) => {
    switch (id) {
      case "plan":
        return <Bot className="size-4 text-primary" />;
      case "search":
      case "search_main":
        return <Search className="size-4 text-blue-500" />;
      case "filter":
        return <CheckCircle2 className="size-4 text-emerald-500" />;
      case "widget_selection":
      case "forge_unique_widget":
        return <Blocks className="size-4 text-violet-500" />;
      case "synthesize":
        return <Sparkles className="size-4 text-amber-500" />;
      case "layout":
      case "layout_plan":
        return <LayoutGrid className="size-4 text-cyan-500" />;
      default:
        return <Activity className="size-4 text-muted-foreground" />;
    }
  };

  const runningStep = steps.find(s => s.status === "running");

  return (
    <IOSWidget
      id="widget-search-agent-progress"
      title="智能搜索 Agent 执行流"
      subtitle={
        isComplete
          ? `搜索 Agent 已完成全网检索与小组件选型 · 耗时 ${((executionTimeMs || 0) / 1000).toFixed(1)} 秒 · AI 智能回答与专属组件已就绪`
          : runningStep
          ? `搜索 Agent 正在处理：${runningStep.title} — ${runningStep.description}`
          : "搜索 Agent 正在感知意图并检索全网数据..."
      }
      icon={<Bot className="size-4 text-primary" />}
      badge={
        <Badge variant={isComplete ? "secondary" : "outline"} className="gap-1 font-mono text-xs">
          {isComplete ? (
            <>
              <CheckCircle2 className="size-3 text-emerald-500" />
              已完成交付
            </>
          ) : (
            <>
              <Loader2 className="size-3 animate-spin text-primary" />
              Agent 思考与检索中
            </>
          )}
        </Badge>
      }
      className="w-full bg-card"
    >
      <div className="space-y-3">
        {/* 当前检索目标提示条 */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-muted/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground truncate">
              当前检索词：<strong className="text-foreground font-medium">“{query}”</strong>
            </span>
          </div>
          <div className="text-muted-foreground shrink-0 text-[11px] font-mono">
            步骤：{steps.filter(s => s.status === "completed").length} / {Math.max(steps.length, 5)}
          </div>
        </div>

        {/* 步骤时间轴列表 */}
        <div className="space-y-2.5">
          {steps.map((step, idx) => {
            const isExpanded = expandedStepId === step.id;
            const isCompleted = step.status === "completed";
            const isRunning = step.status === "running";
            const isError = step.status === "error";

            return (
              <div
                key={step.id || idx}
                className={`rounded-xl border transition-all ${
                  isRunning
                    ? "bg-primary/5 border-primary/30 shadow-xs"
                    : isCompleted
                    ? "bg-card border-border/70 hover:border-border"
                    : isError
                    ? "bg-rose-500/5 border-rose-500/30"
                    : "bg-muted/20 border-border/40 text-muted-foreground"
                }`}
              >
                <div
                  onClick={() => step.details && step.details.length > 0 && toggleExpand(step.id)}
                  className={`p-3 sm:p-3.5 flex items-start justify-between gap-3 ${
                    step.details && step.details.length > 0 ? "cursor-pointer select-none" : ""
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {isRunning ? (
                        <Loader2 className="size-4 text-primary animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : isError ? (
                        <AlertCircle className="size-4 text-rose-500" />
                      ) : (
                        getStepIcon(step.id)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs sm:text-sm text-foreground truncate">
                          {step.title}
                        </span>
                        {isRunning && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                            运行中
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {step.details && step.details.length > 0 && (
                      <button
                        type="button"
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                        title={isExpanded ? "收起详情" : "展开详情"}
                      >
                        {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* 详情展开区 */}
                {isExpanded && step.details && step.details.length > 0 && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-border/50 text-xs text-muted-foreground space-y-1.5 bg-background/40 rounded-b-xl">
                    {step.details.map((detail, dIdx) => (
                      <div key={dIdx} className="flex items-start gap-1.5 font-mono text-[11px] leading-relaxed">
                        <span className="text-primary shrink-0">•</span>
                        <span className="break-all">{detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </IOSWidget>
  );
};
