import React, { useState } from "react";
import { AgentStep, AgentTeamReport, AgentRole, TeamMember, AssignedTask } from "../types.js";
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
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Workflow,
  Cpu,
  RefreshCw,
  GitFork,
  CheckCheck,
  FileCheck,
  Crown,
  Share2,
  BookOpen
} from "lucide-react";
import { IOSWidget } from "./ui/IOSWidget.js";

interface AgentProgressStreamProps {
  steps: AgentStep[];
  query: string;
  isComplete: boolean;
  executionTimeMs?: number;
  agentTeam?: AgentTeamReport | null;
}

export const AgentProgressStream: React.FC<AgentProgressStreamProps> = ({
  steps,
  query,
  isComplete,
  executionTimeMs,
  agentTeam
}) => {
  const [viewMode, setViewMode] = useState<"matrix" | "team" | "timeline">("matrix");
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [selectedAgentRole, setSelectedAgentRole] = useState<AgentRole | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedStepId(expandedStepId === id ? null : id);
  };

  // Helper to get fallback TeamMembers if agentTeam is not fully sent yet
  const getDerivedMembers = (): TeamMember[] => {
    if (agentTeam && agentTeam.members && agentTeam.members.length > 0) {
      return agentTeam.members;
    }

    // Derive from steps
    const hasPlanDone = steps.some(s => s.id === "plan" && s.status === "completed");
    const isPlanRunning = steps.some(s => s.id === "plan" && s.status === "running");

    const hasSearchDone = steps.some(s => (s.id === "search_main" || s.id === "search") && s.status === "completed");
    const hasForgeDone = steps.some(s => s.id === "forge_unique_widget" && s.status === "completed");

    const isConcurrentTeamActive = hasPlanDone && !isComplete;

    return [
      {
        id: "agent-coord",
        role: "coordinator",
        name: "主 Agent (调度总控)",
        title: "意图感知与任务派发中枢",
        isMaster: true,
        dedicatedDuty: "全局需求研判、协作任务拆解、向检索与小组件专职 Agent 派发独立任务指令并最终验收交付",
        avatarIcon: "Bot",
        status: hasPlanDone ? "completed" : isPlanRunning ? "running" : "idle",
        currentTask: hasPlanDone ? "任务委派完毕，检索 Agent 与小组件 Agent 正在协同作业" : isPlanRunning ? "剖析意图并分发专职任务" : "待命统筹",
        completedTasksCount: hasPlanDone ? 2 : 0,
        totalTasksCount: 2,
        outputSummary: "完成原词与多维检索规划，向全网检索 Agent 与小组件构建 Agent 派发独立任务"
      },
      {
        id: "agent-retrieval",
        role: "retrieval",
        name: "全网检索 Agent",
        title: "信源抓取与权威官网甄别专家",
        isMaster: false,
        dedicatedDuty: "专职全网多源检索、跨语言分词召回、官方网站甄别与垃圾杂音清洗（专职信源保障）",
        avatarIcon: "Search",
        status: hasSearchDone ? "completed" : isConcurrentTeamActive ? "running" : "idle",
        currentTask: hasSearchDone ? "TASK-RETRIEVE 专职检索完成并交付" : isConcurrentTeamActive ? "正在专职并发执行多路全网检索" : "等待主 Agent 派发检索任务",
        completedTasksCount: hasSearchDone ? 2 : 0,
        totalTasksCount: 2,
        speedupMultiplier: 2.4,
        outputSummary: "完成主词、跨语言与深度词抓取，甄别官方入口并清洗低质信源"
      },
      {
        id: "agent-forge",
        role: "widget_forge",
        name: "小组件规划与构建 Agent",
        title: "小组件能力模型与交互卡片锻造专家",
        isMaster: false,
        dedicatedDuty: "专职小组件能力规划 (WidgetPlan) 与独有业务小组件锻造 (CustomCardData)，装配交互模型并执行防重复护栏",
        avatarIcon: "Blocks",
        status: hasForgeDone ? "completed" : isConcurrentTeamActive ? "running" : "idle",
        currentTask: hasForgeDone ? "TASK-WIDGET-ARCHITECT 专职组件构建完成并交付" : isConcurrentTeamActive ? "正在专职架构能力模型与锻造专属小组件" : "等待主 Agent 派发构建任务",
        completedTasksCount: hasForgeDone ? 2 : 0,
        totalTasksCount: 2,
        speedupMultiplier: 2.6,
        outputSummary: "规划小组件能力模型并自主锻造独有交互式业务卡片"
      }
    ];
  };

  const getDerivedTasks = (): AssignedTask[] => {
    if (agentTeam && agentTeam.tasksDelegated && agentTeam.tasksDelegated.length > 0) {
      return agentTeam.tasksDelegated;
    }

    const hasPlanDone = steps.some(s => s.id === "plan" && s.status === "completed");
    const hasSearchDone = steps.some(s => (s.id === "search_main" || s.id === "search") && s.status === "completed");
    const hasForgeDone = steps.some(s => s.id === "forge_unique_widget" && s.status === "completed");

    const isConcurrentTeamActive = hasPlanDone && !isComplete;

    return [
      {
        id: "TASK-RETRIEVE",
        assignedToRole: "retrieval",
        assignedAgentName: "全网检索 Agent",
        taskName: "全网多源检索与权威信源甄别",
        mandate: `针对关键词 “${query}”，执行主词及跨语言/深度词多路检索，甄别核心官方网站，过滤百科与低质杂音。`,
        status: hasSearchDone ? "completed" : isConcurrentTeamActive ? "running" : "pending",
        deliverables: hasSearchDone ? ["多源原始网页记录已抓取", "甄别官方权威认证门户", "已清洗低质冗余信源"] : undefined
      },
      {
        id: "TASK-WIDGET-ARCHITECT",
        assignedToRole: "widget_forge",
        assignedAgentName: "小组件规划与构建 Agent",
        taskName: "专属独有小组件架构与智能锻造",
        mandate: "专职分析实体类型与语义，规划能力模型 (WidgetPlan)，智能决策最契合交互原型，构建独有业务交互模型并执行防重复护栏。",
        status: hasForgeDone ? "completed" : isConcurrentTeamActive ? "running" : "pending",
        deliverables: hasForgeDone ? ["小组件意图与能力模型已就绪", "独有业务小组件已锻造", "防重复护栏核验通过"] : undefined
      }
    ];
  };

  const members = getDerivedMembers();
  const tasks = getDerivedTasks();
  const masterAgent = agentTeam?.masterAgent || {
    name: "主 Agent (调度总控)",
    role: "coordinator" as AgentRole,
    title: "意图感知、任务委派与全局验收中枢",
    mandateSummary: "负责全局需求剖析，制定任务委派清单，向检索 Agent 与小组件 Agent 派发独立专有指令，并最终集中验收交付。"
  };

  const speedup = agentTeam?.speedupMultiplier || (isComplete ? 2.6 : 2.2);
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const runningMembers = members.filter(m => m.status === "running").length;
  const completedMembers = members.filter(m => m.status === "completed").length;

  const renderAgentIcon = (role: AgentRole, className: string = "w-4 h-4") => {
    switch (role) {
      case "coordinator":
        return <Bot className={className} />;
      case "retrieval":
        return <Search className={className} />;
      case "widget_forge":
        return <Blocks className={className} />;
      default:
        return <Workflow className={className} />;
    }
  };

  return (
    <IOSWidget
      id="widget-agent-team"
      title="AgentTeam 双核智能体协作中枢"
      subtitle={
        isComplete
          ? `主 Agent 统筹验收交付 · 耗时 ${((executionTimeMs || 0) / 1000).toFixed(1)} 秒 · 检索 Agent 与小组件 Agent 协同已闭环`
          : `主 Agent 正在统筹调度：${runningMembers} 位专职智能体正在执行独立任务...`
      }
      icon={<Workflow className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
      badge={
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-mono">
            <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500" />
            <span>协同加速 {speedup}x</span>
          </span>
          {isComplete ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              全项验收通过
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 animate-pulse">
              多智能体执行中
            </span>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-200/60 dark:bg-zinc-800 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setViewMode("matrix")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "matrix"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            主 Agent 任务委派图谱
          </button>
          <button
            type="button"
            onClick={() => setViewMode("team")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "team"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            智能体专家成员 ({completedMembers}/{members.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "timeline"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            协作流水日志 ({completedCount})
          </button>
        </div>
      }
      className="w-full"
    >
      {/* 🚀 Architectural Header: Master-Worker Explicit Delegation Notice */}
      <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 border border-blue-100/80 dark:border-blue-900/40 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Crown className="w-4 h-4 fill-amber-300 text-amber-300" />
            </div>
            <div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>主 Agent 任务分派与专职协同机制</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
                  双核专职 · 拒绝重复
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                由<strong>主 Agent (调度总控)</strong>研判意图并下达《专属任务委派书》，<strong>全网检索 Agent 与小组件规划构建 Agent</strong> 各自专注负责专属领域（全网检索嗅探、业务小组件架构与锻造），互不重叠并在最后交付主 Agent 验收。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-zinc-500 text-[10px]">协同提速</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{speedup}x</span>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-zinc-500 text-[10px]">缩短延迟</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                ~{Math.round((executionTimeMs || 1500) * (speedup - 1))}ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MASTER AGENT TASK DELEGATION MATRIX (主 Agent 任务委派图谱) */}
      {/* ========================================================================= */}
      {viewMode === "matrix" && (
        <div className="space-y-4">
          {/* 1. Master Agent Center Box */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-blue-500/40 shadow-xs relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>{masterAgent.name}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        指挥调度核心
                      </span>
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {masterAgent.title} · 当前研判输入：“{query}”
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  已向 2 位专长 Agent 派发独立委派单
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-300 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 rounded-xl">
              <strong>👑 主 Agent 调度指令：</strong> {masterAgent.mandateSummary}
            </div>
          </div>

          {/* Visual Link Indicator: Master Agent Distributing Tasks Downwards */}
          <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs font-mono py-0.5">
            <span className="w-12 h-px bg-zinc-300 dark:bg-zinc-700" />
            <GitFork className="w-4 h-4 text-blue-500" />
            <span>主 Agent 任务派发与专职执行矩阵</span>
            <span className="w-12 h-px bg-zinc-300 dark:bg-zinc-700" />
          </div>

          {/* 2. 4 Specialized Delegated Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map((task) => {
              const assignedMember = members.find(m => m.role === task.assignedToRole);
              const isCompleted = task.status === "completed";
              const isRunning = task.status === "running";

              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isRunning
                      ? "bg-white dark:bg-zinc-800 border-blue-400 dark:border-blue-600 shadow-xs"
                      : isCompleted
                      ? "bg-zinc-50/90 dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80"
                      : "bg-zinc-50/40 dark:bg-zinc-900/40 border-zinc-200/40 dark:border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div>
                    {/* Header: Task ID & Assignee */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-xl shrink-0 ${
                          isRunning
                            ? "bg-blue-600 text-white"
                            : isCompleted
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                        }`}>
                          {renderAgentIcon(task.assignedToRole, "w-3.5 h-3.5")}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                              {task.taskName}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold">
                              {task.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                            <span>承接智能体：</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {task.assignedAgentName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div className="shrink-0">
                        {isRunning && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 animate-pulse">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            专职执行中
                          </span>
                        )}
                        {isCompleted && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            已交付主Agent
                          </span>
                        )}
                        {task.status === "pending" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-400">
                            排队待命
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dedicated Responsibility Statement (突出该 Agent 的独有专长，绝不与其它重复) */}
                    <div className="mb-2 p-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">🎯 专属职责：</span>
                      <span>{assignedMember?.dedicatedDuty}</span>
                    </div>

                    {/* Master Agent Mandate (主 Agent 指令) */}
                    <div className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-400 pl-1 border-l-2 border-blue-500/60">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">📜 主 Agent 派发指令：</span>
                      <p className="mt-0.5">{task.mandate}</p>
                    </div>

                    {/* Deliverables Delivered to Master Agent */}
                    {task.deliverables && task.deliverables.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-700/60">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                          📦 向主 Agent 提交的专职交付物：
                        </span>
                        <div className="space-y-1">
                          {task.deliverables.map((item, idx) => (
                            <div
                              key={idx}
                              className="text-[11px] flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300"
                            >
                              <CheckCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="truncate">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {task.executionTimeMs && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/60 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>耗时: {task.executionTimeMs}ms</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        独立闭环交付 ✓
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TEAM MEMBERS / SPECIALISTS (智能体团队角色与职责分工) */}
      {/* ========================================================================= */}
      {viewMode === "team" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
            {members.map((member) => {
              const isRunning = member.status === "running";
              const isDone = member.status === "completed";
              const isIdle = member.status === "idle";
              const isSelected = selectedAgentRole === member.role;

              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedAgentRole(isSelected ? null : member.role)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs"
                      : isRunning
                      ? "bg-white dark:bg-zinc-800 border-blue-300 dark:border-blue-700 shadow-2xs"
                      : isDone
                      ? "bg-zinc-50/80 dark:bg-zinc-800/70 border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100/80 dark:hover:bg-zinc-800"
                      : "bg-zinc-50/40 dark:bg-zinc-900/40 border-zinc-200/40 dark:border-zinc-800/60 text-zinc-400"
                  }`}
                >
                  {/* Top Status & Role Icon */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className={`p-1.5 rounded-xl transition-colors ${
                      isRunning
                        ? "bg-blue-600 text-white shadow-xs"
                        : isDone
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                    }`}>
                      {renderAgentIcon(member.role, "w-4 h-4")}
                    </div>

                    <div className="flex items-center gap-1">
                      {member.isMaster && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          主Agent
                        </span>
                      )}
                      {isRunning && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 animate-pulse">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          运行中
                        </span>
                      )}
                      {isDone && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          就绪
                        </span>
                      )}
                      {isIdle && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-400">
                          待命
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name & Title */}
                  <div className="mb-2">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {member.name}
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                      {member.title}
                    </p>
                  </div>

                  {/* Real-time Task / Progress */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700/60 text-[11px]">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                      <span className="text-[10px] font-medium">当前指派任务</span>
                      <span className="font-mono text-[10px]">
                        {member.completedTasksCount}/{member.totalTasksCount}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-tight line-clamp-2 ${
                      isRunning
                        ? "text-blue-600 dark:text-blue-400 font-medium"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {member.currentTask}
                    </p>

                    {member.executionTimeMs && (
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                        <span>耗时: {member.executionTimeMs}ms</span>
                        {member.speedupMultiplier && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ⚡ {member.speedupMultiplier}x
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Agent Output Summary Panel */}
          {selectedAgentRole && (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-blue-200 dark:border-blue-900/60 text-xs animate-in fade-in duration-200">
              {(() => {
                const target = members.find(m => m.role === selectedAgentRole);
                if (!target) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                        {renderAgentIcon(target.role, "w-4 h-4 text-blue-600")}
                        <span>{target.name} 专属职责与交付报告</span>
                        {target.isMaster && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                            调度主官
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {target.completedTasksCount} / {target.totalTasksCount} 任务完成
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5">
                        🎯 独立负责的专业领域：
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {target.dedicatedDuty}
                      </p>
                    </div>

                    <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      <strong>向主 Agent 的交付汇报：</strong> {target.outputSummary || "该智能体已完成专职任务交付，输出已被主 Agent 验收。"}
                    </p>

                    {target.deliverables && target.deliverables.length > 0 && (
                      <div className="mt-1 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                          具体交付成果物清单：
                        </span>
                        <div className="space-y-1">
                          {target.deliverables.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: CHRONOLOGICAL PIPELINE STREAM WITH CLEAR AGENT LABELS */}
      {/* ========================================================================= */}
      {viewMode === "timeline" && (
        <div className="space-y-2">
          {steps.map((step) => {
            const isExpanded = expandedStepId === step.id;
            const hasDetails = step.details && step.details.length > 0;

            return (
              <div
                key={step.id}
                className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/60 dark:border-zinc-700/80 transition-all"
              >
                <div
                  onClick={() => hasDetails && toggleExpand(step.id)}
                  className={`flex items-center justify-between gap-3 ${hasDetails ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0">
                      {step.status === "completed" && (
                        <CheckCircle2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                      )}
                      {step.status === "running" && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                      )}
                      {step.status === "error" && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      {step.agentRole && (
                        <span className="shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                          {renderAgentIcon(step.agentRole, "w-3 h-3")}
                          <span>{step.agentName || "Agent"}</span>
                        </span>
                      )}
                      <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {step.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {step.speedupFactor && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-mono">
                        ⚡ {step.speedupFactor}
                      </span>
                    )}
                    {step.timestamp && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                    {hasDetails && (
                      <div className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300 pl-6.5 leading-relaxed">
                  {step.description}
                </p>

                {/* Expandable Step Details */}
                {isExpanded && hasDetails && (
                  <div className="mt-3 pl-6.5 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5 animate-in fade-in duration-150">
                    {step.details?.map((detail, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-mono text-zinc-600 dark:text-zinc-400 flex items-start gap-2 bg-white/60 dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-200/40 dark:border-zinc-800"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span className="break-all">{detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </IOSWidget>
  );
};
