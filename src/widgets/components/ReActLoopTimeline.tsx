import React, { useMemo, useState } from "react";
import {
  Brain,
  Wrench,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BrainCircuit
} from "lucide-react";
import {
  buildReActTrace,
  formatReActSummary,
  type ReActPhaseKind,
  type ReActTraceNode
} from "../../lib/reActTrace.js";
import type { AgentStep } from "../../types.js";
import { getUiStrings } from "../../lib/appLanguage.js";

export interface ReActLoopTimelineProps {
  /** 真实执行步骤（来自 eventBridge / agentSteps） */
  steps?: AgentStep[];
  /** 受控展开态；不传则内部自管理 */
  defaultExpanded?: boolean;
  isStreaming?: boolean;
  /** 全局语言设置（settings.language）；不传则按 auto（中文）渲染 */
  language?: string;
  className?: string;
}

const PHASE_META: Record<
  ReActPhaseKind,
  { label: string; icon: React.ReactNode; accent: string; chip: string }
> = {
  thought: {
    label: "Thought",
    icon: <Brain className="size-3" />,
    accent: "text-violet-500",
    chip: "bg-violet-500/10 border-violet-500/25 text-violet-600 dark:text-violet-300"
  },
  act: {
    label: "Act",
    icon: <Wrench className="size-3" />,
    accent: "text-amber-500",
    chip: "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-300"
  },
  read: {
    label: "Read",
    icon: <BookOpenCheck className="size-3" />,
    accent: "text-emerald-500",
    chip: "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-300"
  }
};

function StatusDot({ status }: { status: string }) {
  if (status === "running") {
    return <Loader2 className="size-3 text-amber-500 animate-spin shrink-0" />;
  }
  if (status === "error") {
    return <AlertCircle className="size-3 text-destructive shrink-0" />;
  }
  return <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />;
}

/**
 * ReAct-Read 循环思维链（可折叠时间线）
 * ========================================================================
 * 折叠态为一行摘要；展开后按真实发生顺序逐条展示 Thought / Act / Read。
 *
 * 严格只渲染 `AgentStep` 中真实存在的记录：没有工具调用就没有 Act，
 * 没有观测结果就没有 Read —— 不为「看起来像推理」而伪造节点
 * （对应 AGENTS.md：Do not claim a tool was executed unless a real tool result exists）。
 */
export const ReActLoopTimeline: React.FC<ReActLoopTimelineProps> = ({
  steps,
  defaultExpanded = false,
  isStreaming = false,
  language,
  className = ""
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const t = getUiStrings(language);
  const trace = useMemo(() => buildReActTrace(steps, language), [steps, language]);
  const summary = useMemo(() => formatReActSummary(trace, language), [trace, language]);

  // 无任何真实步骤时完全隐藏：空态本身就是噪音，且会暗示「没有推理」
  if (trace.isEmpty) return null;

  return (
    <div
      className={`rounded-xl border border-border/70 bg-muted/25 overflow-hidden shrink-0 ${className}`}
      data-testid="react-loop-timeline"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/45 transition-colors cursor-pointer text-left"
        title={expanded ? t.reactCollapse : t.reactExpand}
      >
        <BrainCircuit
          className={`size-3.5 shrink-0 ${trace.isRunning ? "text-amber-500 animate-pulse" : "text-primary"}`}
        />
        <span className="text-xs font-medium text-foreground shrink-0">{t.reactHeader}</span>

        <span className="text-xs text-muted-foreground truncate flex-1">{summary}</span>

        {trace.isRunning && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium shrink-0 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
            {t.reactRunning}
          </span>
        )}
        {!trace.isRunning && isStreaming && (
          <span className="text-[10px] text-muted-foreground shrink-0">{t.reactSynthesizing}</span>
        )}

        {expanded ? (
          <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-4 py-3.5 space-y-3 max-h-[260px] overflow-y-auto scrollbar-thin">
          {trace.nodes.map((node, idx) => {
            const meta = PHASE_META[node.kind];
            return (
              <div key={node.id} className="flex gap-3 items-start">
                {/* 轨道 + 节点圆点 */}
                <div className="flex flex-col items-center shrink-0 pt-0.5">
                  <span
                    className={`size-4 rounded-full border flex items-center justify-center ${meta.chip}`}
                  >
                    {meta.icon}
                  </span>
                  {idx < trace.nodes.length - 1 && (
                    <span className="w-px flex-1 min-h-[14px] bg-border/80 mt-0.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {meta.label}
                    </span>
                    <span className="text-xs font-medium text-foreground break-words">
                      {node.title}
                    </span>
                    <StatusDot status={node.status} />
                  </div>
                  {node.detail && (
                    <p className="text-xs text-muted-foreground leading-6 break-words mt-1">
                      {node.detail}
                    </p>
                  )}
                  {node.details && node.details.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {node.details.map((d, di) => (
                        <span
                          key={di}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-background/70 border border-border/60 text-muted-foreground"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReActLoopTimeline;
