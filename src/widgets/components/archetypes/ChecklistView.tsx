import React, { useState } from "react";
import { ActionChecklistData, ChecklistTaskItem } from "../../../types.js";
import { Check, Clock, Copy, ExternalLink, RotateCcw, Terminal } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Progress } from "../../../components/ui/progress.js";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import { WuEmpty } from "../../../components/ui/widget-composites.js";
import { cn } from "../../../lib/utils.js";

interface ChecklistViewProps {
  data: ActionChecklistData;
  themeColor?: string;
  onUpdateData?: (updated: ActionChecklistData) => void;
}

/**
 * 行动清单视图 (action_checklist)
 *
 * shadcn/ui 重做要点：
 *   · 顶部统计区从「灰底圆角块 + 蓝绿渐变进度条 + 药丸 chip」改为 shadcn 三件套：
 *     muted 信息条 + Progress + Tabs 分段控件 —— 渐变与药丸都不属于 shadcn 语汇；
 *   · 勾选框由圆形描边图标改为 shadcn Checkbox 形状（size-4 / rounded-[4px] /
 *     达成态 bg-primary + 前景色对勾），达成与否从形状本身即可辨认；
 *   · 任务行不再各自套一层白底描边卡（卡片套卡片），改为同一容器内的行式列表，
 *     靠 border-border 与留白建立层级；
 *   · STEP / 耗时沿用 font-mono + tabular-nums：这两处是**要对齐比对的编码信息**，
 *     等宽不是装饰；
 *   · 全量移除 zinc-* / emerald-* / blue-* 硬编码色与多档大圆角，
 *     命令块收敛为 bg-muted + font-mono 的中性代码块。
 *
 * themeColor 入参保留但不再参与渲染：锻造侧仍会下发该字段（数据契约不动），
 * 而项目已收敛为纯单色，主题键位只是历史遗留。
 */
export const ChecklistView: React.FC<ChecklistViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "done">("all");

  const tasks = data.tasks || [];
  const completedCount = tasks.filter(t => t.checked).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggleTask = (id: string) => {
    const nextTasks = tasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    if (onUpdateData) {
      onUpdateData({ ...data, tasks: nextTasks });
    }
  };

  const handleResetAll = () => {
    const nextTasks = tasks.map(t => ({ ...t, checked: false }));
    if (onUpdateData) {
      onUpdateData({ ...data, tasks: nextTasks });
    }
  };

  const handleCompleteAll = () => {
    const nextTasks = tasks.map(t => ({ ...t, checked: true }));
    if (onUpdateData) {
      onUpdateData({ ...data, tasks: nextTasks });
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const displayedTasks = tasks.filter(t => {
    if (filterMode === "pending") return !t.checked;
    if (filterMode === "done") return t.checked;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* 进度与过滤：全部收在一张 muted 信息条内，不再用灰底大圆角块 */}
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              执行进度 {completedCount}/{totalCount}
            </span>
            <Badge variant="outline" className="shrink-0 font-mono tabular-nums">
              {progressPercent}%
            </Badge>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAll}
              title="重置所有检查项"
            >
              <RotateCcw />
              重置
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCompleteAll}
              title="全部标记为完成"
            >
              <Check />
              全选
            </Button>
          </div>
        </div>

        <Progress value={progressPercent} className="mt-2.5 h-1.5" />

        <Tabs
          value={filterMode}
          onValueChange={value => setFilterMode(value as "all" | "pending" | "done")}
          className="mt-2.5"
        >
          <TabsList className="w-full">
            <TabsTrigger value="all">全部 {totalCount}</TabsTrigger>
            <TabsTrigger value="pending">待执行 {totalCount - completedCount}</TabsTrigger>
            <TabsTrigger value="done">已完成 {completedCount}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 任务列表 */}
      <div className="flex flex-col gap-2">
        {displayedTasks.map((task: ChecklistTaskItem) => {
          const isChecked = task.checked;
          const isCopied = copiedCodeId === task.id;

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                isChecked
                  ? "border-border bg-muted/40 opacity-70"
                  : "border-border bg-card hover:border-foreground/20"
              )}
            >
              {/* shadcn Checkbox 形状：方角勾选框，达成态整块反色 */}
              <button
                type="button"
                onClick={() => handleToggleTask(task.id)}
                title={isChecked ? "标记为未完成" : "标记为已完成"}
                aria-pressed={isChecked}
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border transition-colors",
                  isChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:border-foreground/40"
                )}
              >
                {isChecked && <Check className="size-3" />}
              </button>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-muted-foreground">
                    STEP {String(task.stepNumber).padStart(2, "0")}
                  </span>

                  <span
                    className={cn(
                      "text-sm font-medium text-foreground",
                      isChecked && "text-muted-foreground line-through"
                    )}
                  >
                    {task.title}
                  </span>

                  {task.priority === "critical" && (
                    <Badge variant="destructive">必须执行</Badge>
                  )}

                  {task.estimatedTime && (
                    <span className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {task.estimatedTime}
                    </span>
                  )}

                  {task.difficulty && (
                    <span className="text-xs text-muted-foreground">
                      {task.difficulty === "easy" ? "简单" : task.difficulty === "medium" ? "中等" : "复杂"}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {task.instruction}
                </p>

                {/* 可执行命令：中性代码块 + 图标型复制按钮 */}
                {task.commandOrCode && (
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 p-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                      <Terminal className="size-3 shrink-0 text-muted-foreground" />
                      <code className="select-all whitespace-pre font-mono text-xs text-foreground">
                        {task.commandOrCode}
                      </code>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleCopyCode(task.id, task.commandOrCode!)}
                      title={isCopied ? "已复制" : "复制命令"}
                      aria-label="复制命令"
                      className="shrink-0"
                    >
                      {isCopied ? <Check /> : <Copy />}
                    </Button>
                  </div>
                )}

                {task.sourceUrl && (
                  <a
                    href={task.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    <span>出处: {task.sourceTitle || new URL(task.sourceUrl).hostname}</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {displayedTasks.length === 0 && (
          <WuEmpty>没有符合当前过滤条件的检查项</WuEmpty>
        )}
      </div>
    </div>
  );
};
