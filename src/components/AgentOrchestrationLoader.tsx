import React, { useEffect, useMemo, useState } from "react";
import { AgentStep, AgentTeamReport, AgentRole } from "../types.js";
import { Bot, Search, Blocks, LayoutGrid, Check, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge.js";

type NodeStatus = "idle" | "running" | "done";

interface AgentOrchestrationLoaderProps {
  steps: AgentStep[];
  query: string;
  team?: AgentTeamReport | null;
}

/** 主 Agent 相位对应的步骤 ID（不同链路历史命名均已覆盖） */
const CORE_STEP_IDS = ["plan", "plan_intent", "intent"];
const CORE_MEMBER_ROLE: AgentRole = "coordinator";

/** 三位专职卫星智能体：轨道位置由 120° 均分计算 */
const SATELLITES: {
  role: AgentRole;
  short: string;
  name: string;
  duty: string;
  stepIds: string[];
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    role: "retrieval",
    short: "检索",
    name: "全网检索 Agent",
    duty: "多路召回与权威信源甄别",
    stepIds: ["search_main", "search", "search_deep", "search_cross_lingual", "search_expand"],
    Icon: Search
  },
  {
    role: "widget_forge",
    short: "组件",
    name: "小组件构建 Agent",
    duty: "能力建模与专属卡片锻造",
    stepIds: ["forge_unique_widget", "widget_plan", "plan_widgets", "widget_architect"],
    Icon: Blocks
  },
  {
    role: "layout",
    short: "排版",
    name: "小组件排版 Agent",
    duty: "12 栅格编排与视觉焦点裁决",
    stepIds: ["layout_plan", "layout", "layout_solve"],
    Icon: LayoutGrid
  }
];

const ORBIT_RADIUS_PCT = 37;

/**
 * AgentTeam 专属编排加载动画
 *
 * 以「主 Agent 核心 + 三核专职卫星」的轨道编排隐喻呈现智能体协作过程：
 * 同心环持续自转，卫星节点随对应专职 Agent 的实时状态依次点亮（运行中/已交付），
 * 并同步展示阶段文案、整体交付进度与最新流水，替代原先冗长的日志卡片。
 */
export const AgentOrchestrationLoader: React.FC<AgentOrchestrationLoaderProps> = ({
  steps,
  query,
  team
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((prev) => prev + 0.1), 100);
    return () => clearInterval(timer);
  }, []);

  const nodes = useMemo(
    () =>
      SATELLITES.map((satellite, index) => {
        const angle = ((-90 + index * 120) * Math.PI) / 180;
        return {
          ...satellite,
          x: 50 + ORBIT_RADIUS_PCT * Math.cos(angle),
          y: 50 + ORBIT_RADIUS_PCT * Math.sin(angle)
        };
      }),
    []
  );

  /** 依据实时流水判定相位状态（流水比团队快照更细粒度，优先采信） */
  const statusFromSteps = (ids: string[]): NodeStatus | null => {
    const matched = steps.filter((step) => ids.includes(step.id));
    if (matched.length === 0) return null;
    if (matched.some((step) => step.status === "completed")) return "done";
    if (matched.some((step) => step.status === "running")) return "running";
    return "idle";
  };

  const statusFromTeam = (role: AgentRole): NodeStatus | null => {
    const member = team?.members?.find((item) => item.role === role);
    if (!member) return null;
    if (member.status === "completed") return "done";
    if (member.status === "running") return "running";
    return "idle";
  };

  const resolveStatus = (role: AgentRole, ids: string[]): NodeStatus =>
    statusFromSteps(ids) ?? statusFromTeam(role) ?? "idle";

  const coreStatus = resolveStatus(CORE_MEMBER_ROLE, CORE_STEP_IDS);
  const satelliteStatuses = nodes.map((node) => ({
    ...node,
    status: resolveStatus(node.role, node.stepIds)
  }));

  const allStatuses: NodeStatus[] = [coreStatus, ...satelliteStatuses.map((n) => n.status)];
  const deliveredCount = allStatuses.filter((status) => status === "done").length;
  const progress = Math.round((deliveredCount / allStatuses.length) * 100);

  const runningSatellite = satelliteStatuses.find((node) => node.status === "running");
  const allSatellitesDone = satelliteStatuses.every((node) => node.status === "done");

  const phaseText = (() => {
    if (coreStatus === "idle" && !runningSatellite) return "正在唤醒 AgentTeam 并研判检索意图";
    if (runningSatellite) return `${runningSatellite.name} 正在${runningSatellite.duty}`;
    if (coreStatus === "running") return "主 Agent 正在拆解任务并向专职智能体派发指令";
    if (allSatellitesDone) return "主 Agent 正在汇总验收并生成检索研报";
    return "主 Agent 正在统筹调度专职智能体协同作业";
  })();

  /** 取最新一条流水作为实时字幕（优先展示运行中步骤） */
  const liveStep = useMemo(() => {
    if (steps.length === 0) return null;
    return steps.find((step) => step.status === "running") ?? steps[steps.length - 1];
  }, [steps]);

  const statusStyles = (status: NodeStatus) => {
    if (status === "done") {
      return {
        ring: "border-foreground/30",
        body: "bg-foreground text-background",
        text: "text-foreground"
      };
    }
    if (status === "running") {
      return {
        ring: "border-foreground/60",
        body: "bg-foreground text-background",
        text: "text-foreground"
      };
    }
    return {
      ring: "border-border",
      body: "bg-muted text-muted-foreground",
      text: "text-muted-foreground"
    };
  };

  const coreTheme = statusStyles(coreStatus);

  return (
    <div className="w-full flex flex-col items-center px-4 py-6 sm:py-8">
      {/* 顶部状态 */}
      <Badge variant="secondary" className="gap-1.5">
        <span className="relative flex items-center justify-center size-2">
          <span className="absolute inline-flex w-full h-full rounded-full bg-foreground/40 agent-dot" />
          <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
        </span>
        AgentTeam 协同编排中
      </Badge>

      {query && (
        <p className="mt-2.5 text-sm text-muted-foreground max-w-md text-center truncate">
          正在为「<span className="text-foreground font-medium">{query}</span>」构建研报
        </p>
      )}

      {/* 轨道编排舞台 */}
      <div className="relative w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] mt-6 shrink-0">
        {/* 同心环 */}
        <div className="absolute inset-0 rounded-full border border-dashed border-border agent-orbit-slow" />
        <div className="absolute inset-[26px] rounded-full border border-dashed border-border agent-orbit-reverse" />
        <div className="absolute inset-[54px] rounded-full border border-border" />

        {/* 旋转扫描光带 */}
        <div
          className="absolute inset-[6px] rounded-full agent-orbit pointer-events-none"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(160,160,160,0.22), rgba(160,160,160,0.04) 22%, transparent 42%, transparent 100%)",
            maskImage: "radial-gradient(circle, transparent 56%, #000 58%)",
            WebkitMaskImage: "radial-gradient(circle, transparent 56%, #000 58%)"
          }}
        />

        {/* 核心 → 卫星 连接辐条 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
          {satelliteStatuses.map((node) => (
            <line
              key={`spoke-${node.role}`}
              x1={50}
              y1={50}
              x2={node.x}
              y2={node.y}
              strokeWidth={node.status === "running" ? 0.9 : 0.5}
              strokeLinecap="round"
              className={
                node.status === "running"
                  ? "stroke-foreground/50 agent-spoke"
                  : node.status === "done"
                    ? "stroke-foreground/25"
                    : "stroke-border"
              }
            />
          ))}
        </svg>

        {/* 主 Agent 核心 */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex items-center justify-center">
            {coreStatus === "running" && (
              <>
                <span className="absolute w-[86px] h-[86px] rounded-full bg-foreground/10 agent-halo" />
                <span
                  className="absolute w-[86px] h-[86px] rounded-full bg-foreground/10 agent-halo"
                  style={{ animationDelay: "0.9s" }}
                />
              </>
            )}
            <div
              className={`agent-core relative w-[74px] h-[74px] sm:w-[80px] sm:h-[80px] rounded-xl flex flex-col items-center justify-center border-2 ${coreTheme.ring} ${coreTheme.body} transition-colors duration-300`}
            >
              {coreStatus === "done" ? <Check className="w-7 h-7" /> : <Bot className="w-7 h-7" />}
              <span className="mt-0.5 text-xs font-medium tracking-wide opacity-90">主 Agent</span>
            </div>
          </div>
        </div>

        {/* 三核专职卫星节点 */}
        {satelliteStatuses.map((node) => {
          const theme = statusStyles(node.status);
          return (
            <div
              key={node.role}
              className="absolute agent-node-in"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              title={`${node.name} · ${node.duty}`}
            >
              <div className="relative flex flex-col items-center">
                {node.status === "running" && (
                  <span className="absolute top-0 w-[60px] h-[60px] rounded-full bg-foreground/10 agent-halo" />
                )}
                <div
                  className={`relative w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-xl flex flex-col items-center justify-center border-2 ${theme.ring} ${theme.body} transition-colors duration-300`}
                >
                  {node.status === "done" ? (
                    <Check className="w-[18px] h-[18px]" />
                  ) : (
                    <node.Icon className="w-[18px] h-[18px]" />
                  )}
                  <span className="mt-0.5 text-xs font-medium tracking-wide opacity-90">{node.short}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 阶段文案 */}
      <div className="mt-6 flex items-center gap-2 min-h-[20px]">
        {!allSatellitesDone && (
          <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0" />
        )}
        <p key={phaseText} className="text-sm font-medium text-foreground text-center agent-fade-up">
          {phaseText}
        </p>
      </div>

      {/* 交付进度 */}
      <div className="mt-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
          <span>
            {deliveredCount}/{allStatuses.length} 专职智能体已交付
          </span>
          <span className="font-mono tabular-nums">
            {progress}% · {elapsed.toFixed(1)}s
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden agent-sheen-host">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
      </div>

      {/* 实时流水字幕 */}
      {liveStep ? (
        <div
          key={liveStep.id}
          className="mt-4 w-full max-w-md flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border agent-fade-up"
        >
          <span
            className={`shrink-0 size-1.5 rounded-full ${
              liveStep.status === "running"
                ? "bg-foreground animate-pulse"
                : liveStep.status === "error"
                  ? "bg-destructive"
                  : "bg-muted-foreground"
            }`}
          />
          <span className="text-xs text-muted-foreground shrink-0">
            {liveStep.agentName || "Agent"}
          </span>
          <span className="text-xs text-foreground truncate">{liveStep.title}</span>
        </div>
      ) : (
        <div className="mt-4 w-full max-w-md flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
          <span className="shrink-0 size-1.5 rounded-full bg-muted-foreground animate-pulse" />
          <span className="text-xs text-muted-foreground">
            正在建立检索通道并加载专职智能体…
          </span>
        </div>
      )}
    </div>
  );
};
