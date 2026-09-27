import React, { useMemo } from "react";
import { AgentStep, AgentTeamReport } from "../types.js";
import { PlanningSkeleton } from "./PlanningSkeleton.js";

interface AgentOrchestrationLoaderProps {
  steps: AgentStep[];
  query: string;
  team?: AgentTeamReport | null;
  isStreaming?: boolean;
}

/**
 * 极简搜索加载与拓扑栅格预告骨架组件
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

  // 提取简洁清晰的步骤标题
  const cleanStepTitle = useMemo(() => {
    if (!activeStep) return "正在检索全网信源并规划小组件排版...";
    const title = activeStep.title || "";
    return title.replace(/^\[.*?\]\s*/, "").trim();
  }, [activeStep]);

  return (
    <div id="search-loading-container" className="w-full flex-1 flex flex-col py-6">
      <PlanningSkeleton
        query={query}
        currentStepMessage={cleanStepTitle}
        estimatedWidgets={[100, 50, 50, 25, 25, 50]}
      />
    </div>
  );
};
