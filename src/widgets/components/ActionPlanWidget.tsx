import React, { useState } from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  ListOrdered,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal
} from "lucide-react";
import { Badge } from "../../components/ui/badge.js";
import { Button, buttonVariants } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { ActionPlan, PlannedTask, WidgetAction } from "../../types.js";

interface ActionPlanWidgetProps {
  actionPlan?: ActionPlan;
  query: string;
  onExecuteAction?: (action: WidgetAction) => void;
  isCompact?: boolean;
}

/**
 * 行动规划与能力调用看板 (action_plan)
 *
 * shadcn/ui 重做要点：
 *   · 下一步建议区由「翠绿→青绿渐变底 + 实心绿图标块 + 翠绿标题」改为
 *     muted 信息块 + muted 图标盒：渐变是纯装饰，且在单色主题下必然失效；
 *   · 任务完成标记由「实心绿方块 + 白勾」改为 shadcn Checkbox 形状
 *     （size-4 / rounded-[4px] / 达成态 bg-primary），与清单视图同源；
 *   · 能力标签（toolCapability）改为 bg-muted + font-mono 的中性标签：
 *     这里列的是**能力标识符**，等宽可读性优先；六种工具类型不再各自上色，
 *     类型识别交给图标形状（Terminal / ExternalLink / Download / BookOpen / Play）；
 *   · 执行提示由「近黑终端块 + 翠绿文字」改为 bg-muted/50 中性代码块；
 *   · 动作控件统一走 Button / buttonVariants，主次仅由 default / outline 区分。
 *
 * query 与 isCompact 入参保留（调用侧仍会传入，组件内部不消费）。
 */
export const ActionPlanWidget: React.FC<ActionPlanWidgetProps> = ({
  actionPlan,
  query: _query,
  onExecuteAction,
  isCompact: _isCompact = false
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

  /** 工具类型图标：只做形状识别，不携带颜色 */
  const renderToolIcon = (toolType: string) => {
    switch (toolType) {
      case "install_command":
      case "copy_text":
        return <Terminal className="size-3" />;
      case "official_url":
        return <ExternalLink className="size-3" />;
      case "download":
        return <Download className="size-3" />;
      case "open_docs":
        return <BookOpen className="size-3" />;
      case "open_demo":
        return <Play className="size-3" />;
      default:
        return <Sparkles className="size-3" />;
    }
  };

  const renderActionControl = (task: PlannedTask) => {
    const action = task.action;
    const isCopied = copiedId === task.id;

    if (action.type === "copy") {
      const textToCopy = action.payload || action.label;
      return (
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => handleCopyText(textToCopy, task.id)}
        >
          {isCopied ? <Check /> : <Copy />}
          <span>{isCopied ? "已复制代码" : action.label || "复制命令"}</span>
        </Button>
      );
    }

    if (action.type === "open_url") {
      return (
        <a
          href={action.payload}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "sm", className: "shrink-0" })}
        >
          <span>{action.label || "直达"}</span>
          <ExternalLink />
        </a>
      );
    }

    return (
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => onExecuteAction?.(action)}
      >
        <span>{action.label}</span>
        <ArrowRight />
      </Button>
    );
  };

  return (
    <IOSWidget
      id="widget-action-plan"
      title="行动规划与能力调用看板"
      subtitle={`目标研判: ${actionPlan.goalStatement}`}
      icon={<Compass className="size-4" />}
      className="w-full h-full"
      badge={
        <Badge variant="outline">
          <ShieldCheck />
          Tool Registry 真实绑定
        </Badge>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 下一步行动建议 */}
        <div className="rounded-lg border bg-muted/40 p-3.5">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0 rounded-md bg-muted p-1.5 text-muted-foreground">
              <Compass className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium tracking-tight text-foreground">
                  下一步行动规划建议
                </span>
                <Badge variant="secondary">{actionPlan.userGoal}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {actionPlan.nextStepVerdict}
              </p>
            </div>
          </div>
        </div>

        {/* 可执行能力任务清单 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ListOrdered className="size-3.5" />
              可执行能力任务清单
              <span className="font-mono tabular-nums">{actionPlan.tasks.length}</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              已完成 {completedTaskIds.size} / {actionPlan.tasks.length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {actionPlan.tasks.map((task, idx) => {
              const isDone = completedTaskIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    isDone
                      ? "border-border bg-muted/40 opacity-75"
                      : "border-border bg-card hover:border-foreground/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      {/* 完成标记：与清单视图同款 shadcn Checkbox 形状 */}
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        aria-pressed={isDone}
                        title={isDone ? "标记未完成" : "标记已完成"}
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border transition-colors",
                          isDone
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:border-foreground/40"
                        )}
                      >
                        {isDone && <Check className="size-3" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isDone ? "text-muted-foreground line-through" : "text-foreground"
                            )}
                          >
                            {idx + 1}. {task.title}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {renderToolIcon(task.toolCapability)}
                            {task.toolCapability}
                          </span>
                        </div>

                        {task.executionHint && (
                          <div className="mt-1.5 flex items-center justify-between gap-2 overflow-x-auto rounded-md border bg-muted/50 px-2 py-1.5">
                            <code className="select-all truncate font-mono text-xs text-foreground">
                              {task.executionHint}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCopyText(task.executionHint!, task.id + "-hint")}
                              title="复制代码"
                              aria-label="复制代码"
                              className="shrink-0"
                            >
                              {copiedId === task.id + "-hint" ? <Check /> : <Copy />}
                            </Button>
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

        {/* 护栏审计 */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            <span>OpenAI Guardrails 行动护栏: 已通过</span>
          </div>
          <span>杜绝空洞信息与虚假按钮</span>
        </div>
      </div>
    </IOSWidget>
  );
};
