import React, { useMemo } from "react";
import { AgentStep, AgentTeamReport } from "../types.js";

interface AgentOrchestrationLoaderProps {
  steps: AgentStep[];
  query: string;
  team?: AgentTeamReport | null;
  isStreaming?: boolean;
}

/**
 * 极简搜索加载组件
 * 采用最简单、最纯粹的居中极简动效设计：
 * 微细转环、查询焦点、实时阶段字幕与纤薄进度指示
 */
export const AgentOrchestrationLoader: React.FC<AgentOrchestrationLoaderProps> = ({
  steps,
  query,
  isStreaming = true
}) => {
  // 提取当前正在执行的步骤或最新状态
  const activeStep = useMemo(() => {
    if (!steps || steps.length === 0) return null;
    return steps.find((s) => s.status === "running") || steps[steps.length - 1];
  }, [steps]);

  // 提取简洁清晰的步骤标题，剔除内部前缀标签
  const cleanStepTitle = useMemo(() => {
    if (!activeStep) return "正在检索全网信源并准备综合研报...";
    const title = activeStep.title || "";
    return title.replace(/^\[.*?\]\s*/, "").trim();
  }, [activeStep]);

  // 计算简要完成进度
  const progress = useMemo(() => {
    if (!steps || steps.length === 0) return 0;
    const completed = steps.filter((s) => s.status === "completed").length;
    const total = Math.max(steps.length, 4);
    return Math.min(Math.round((completed / total) * 100), 95);
  }, [steps]);

  const isIndeterminate = progress === 0;

  return (
    <div
      id="search-loading-container"
      className="w-full flex-1 flex flex-col items-center justify-center py-28 sm:py-36 px-4 text-center select-none"
    >
      {/* 极简动效指示器：轻盈、高对比度微细转环 */}
      <div className="relative flex items-center justify-center size-8 mb-5">
        <div className="size-8 rounded-full border-2 border-border/80 border-t-foreground animate-spin" />
        <div className="absolute size-1.5 rounded-full bg-foreground" />
      </div>

      {/* 搜索焦点与提示 */}
      <div className="max-w-md space-y-2">
        <h3 className="text-base sm:text-lg font-medium text-foreground tracking-tight">
          {query ? (
            <span>
              正在搜索 <span className="font-semibold text-foreground">“{query}”</span>
            </span>
          ) : (
            "正在检索与分析全网信源"
          )}
        </h3>

        {/* 简洁阶段字幕 */}
        <p className="text-xs sm:text-sm text-muted-foreground transition-opacity duration-300 min-h-[20px]">
          {cleanStepTitle}
        </p>
      </div>

      {/* 极细微流光进度条 */}
      <div className="w-48 sm:w-60 mt-6">
        <div className="h-[2px] w-full rounded-full bg-muted overflow-hidden relative">
          {isIndeterminate ? (
            <div className="h-full rounded-full bg-foreground/80 w-2/5 animate-indeterminate" />
          ) : (
            <div
              className="h-full rounded-full bg-foreground/80 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
