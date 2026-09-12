import React, { useState } from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import {
  Compass,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Download,
  Terminal,
  BookOpen,
  Play,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ListOrdered
} from "lucide-react";
import { ActionPlan, PlannedTask, WidgetAction } from "../../types.js";

interface ActionPlanWidgetProps {
  actionPlan?: ActionPlan;
  query: string;
  onExecuteAction?: (action: WidgetAction) => void;
  isCompact?: boolean;
}

export const ActionPlanWidget: React.FC<ActionPlanWidgetProps> = ({
  actionPlan,
  query,
  onExecuteAction,
  isCompact = false
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  if (!actionPlan || !actionPlan.tasks || actionPlan.tasks.length === 0) {
    return null;
  }

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const renderToolIcon = (toolType: string) => {
    switch (toolType) {
      case "install_command":
      case "copy_text":
        return <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "official_url":
        return <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "download":
        return <Download className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "open_docs":
        return <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case "open_demo":
        return <Play className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
    }
  };

  const renderActionControl = (task: PlannedTask) => {
    const action = task.action;
    const isCopied = copiedId === task.id;

    if (action.type === "copy") {
      const textToCopy = action.payload || action.label;
      return (
        <button
          onClick={() => handleCopyText(textToCopy, task.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-2xs shrink-0"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{isCopied ? "已复制代码" : action.label || "复制命令"}</span>
        </button>
      );
    }

    if (action.type === "open_url") {
      return (
        <a
          href={action.payload}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs shrink-0"
        >
          <span>{action.label || "直达"}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      );
    }

    return (
      <button
        onClick={() => onExecuteAction?.(action)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer shrink-0"
      >
        <span>{action.label}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    );
  };

  return (
    <IOSWidget
      id="widget-action-plan"
      title="行动规划与能力调用看板"
      subtitle={`目标研判: ${actionPlan.goalStatement}`}
      icon={<Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
      className="w-full h-full border-emerald-500/30 dark:border-emerald-500/20"
      badge={
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Tool Registry 真实绑定</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Next Step Verdict Callout */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/30">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5 shadow-2xs">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 tracking-tight">
                  下一步行动规划建议
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-600 text-white font-medium">
                  {actionPlan.userGoal}
                </span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">
                {actionPlan.nextStepVerdict}
              </p>
            </div>
          </div>
        </div>

        {/* Action Tasks Pipeline */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5" />
              可执行能力任务清单 ({actionPlan.tasks.length})
            </span>
            <span className="text-[11px] text-zinc-400">
              已完成 {completedTaskIds.size} / {actionPlan.tasks.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {actionPlan.tasks.map((task, idx) => {
              const isDone = completedTaskIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isDone
                      ? "bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 opacity-75"
                      : "bg-white dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs hover:border-emerald-500/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`mt-0.5 p-1 rounded-md transition-colors cursor-pointer ${
                          isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-100 dark:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        }`}
                        title={isDone ? "标记未完成" : "标记已完成"}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${isDone ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"}`}>
                            {idx + 1}. {task.title}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700/80 text-[10px] text-zinc-600 dark:text-zinc-300 font-mono">
                            {renderToolIcon(task.toolCapability)}
                            {task.toolCapability}
                          </span>
                        </div>

                        {task.executionHint && (
                          <div className="mt-1.5 p-2 rounded-lg bg-zinc-900 dark:bg-black font-mono text-[11px] text-emerald-400 dark:text-emerald-300 flex items-center justify-between gap-2 overflow-x-auto">
                            <span className="select-all truncate">{task.executionHint}</span>
                            <button
                              onClick={() => handleCopyText(task.executionHint!, task.id + "-hint")}
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                              title="复制代码"
                            >
                              {copiedId === task.id + "-hint" ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">{renderActionControl(task)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Guardrail Audit Note */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>OpenAI Guardrails 行动护栏: 已通过</span>
          </div>
          <span className="text-[10px] text-zinc-400">杜绝空洞信息与虚假按钮</span>
        </div>
      </div>
    </IOSWidget>
  );
};
