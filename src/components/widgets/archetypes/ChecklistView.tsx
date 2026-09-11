import React, { useState } from "react";
import { ActionChecklistData, ChecklistTaskItem } from "../../../types.js";
import { 
  CheckCircle2, 
  Circle, 
  Copy, 
  Check, 
  Terminal, 
  Clock, 
  ExternalLink,
  RotateCcw
} from "lucide-react";

interface ChecklistViewProps {
  data: ActionChecklistData;
  themeColor?: string;
  onUpdateData?: (updated: ActionChecklistData) => void;
}

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
    <div className="space-y-3.5">
      {/* Interactive Progress & Actions Header */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              执行进度: {completedCount}/{totalCount} 步完成
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded-md">
              {progressPercent}%
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetAll}
              title="重置所有检查项"
              className="px-2 py-0.5 rounded text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              重置
            </button>
            <button
              onClick={handleCompleteAll}
              title="全部标记为完成"
              className="px-2 py-0.5 rounded text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 flex items-center gap-1 transition-colors"
            >
              <Check className="w-2.5 h-2.5" />
              全选
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <div 
            className="h-full bg-linear-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-400 mr-1">过滤视图:</span>
          {(["all", "pending", "done"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                filterMode === mode
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {mode === "all" ? `全部 (${totalCount})` : mode === "pending" ? `待执行 (${totalCount - completedCount})` : `已完成 (${completedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {displayedTasks.map((task: ChecklistTaskItem) => {
          const isChecked = task.checked;
          const isCopied = copiedCodeId === task.id;

          return (
            <div
              key={task.id}
              className={`group p-3 rounded-xl border transition-all ${
                isChecked
                  ? "bg-zinc-50/50 dark:bg-zinc-850/40 border-zinc-200/60 dark:border-zinc-800/50 opacity-80"
                  : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-2xs"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Step Number & Checkbox Button */}
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="mt-0.5 shrink-0 flex items-center justify-center cursor-pointer text-zinc-400 hover:text-emerald-500 transition-colors"
                  title={isChecked ? "标记为未完成" : "标记为已完成"}
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.2 rounded">
                      STEP {String(task.stepNumber).padStart(2, "0")}
                    </span>

                    <span className={`text-xs font-semibold text-zinc-900 dark:text-zinc-100 ${isChecked ? "line-through text-zinc-400 dark:text-zinc-500" : ""}`}>
                      {task.title}
                    </span>

                    {task.priority === "critical" && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-medium">
                        必须执行
                      </span>
                    )}

                    {task.estimatedTime && (
                      <span className="text-[10px] text-zinc-400 flex items-center gap-0.5 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {task.estimatedTime}
                      </span>
                    )}

                    {task.difficulty && (
                      <span className="text-[10px] px-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {task.difficulty === "easy" ? "简单" : task.difficulty === "medium" ? "中等" : "复杂"}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5 leading-relaxed">
                    {task.instruction}
                  </p>

                  {/* Interactive Command or Code Block */}
                  {task.commandOrCode && (
                    <div className="mt-2 p-2 rounded-lg bg-zinc-900 text-zinc-200 dark:bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2 font-mono text-[11px] overflow-x-auto">
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        <Terminal className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="select-all whitespace-pre font-mono">{task.commandOrCode}</span>
                      </div>

                      <button
                        onClick={() => handleCopyCode(task.id, task.commandOrCode!)}
                        className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                        title="复制命令"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-sans">已复制</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="font-sans">复制</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {task.sourceUrl && (
                    <div className="mt-2 flex items-center">
                      <a
                        href={task.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-600 font-mono transition-colors"
                      >
                        <span>出处: {task.sourceTitle || new URL(task.sourceUrl).hostname}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {displayedTasks.length === 0 && (
          <div className="text-center py-6 text-xs text-zinc-400">
            没有符合当前过滤条件的检查项
          </div>
        )}
      </div>
    </div>
  );
};
