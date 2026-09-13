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
  ArrowRight,
  Workflow,
  GitFork
} from "lucide-react";
import { IOSWidget } from "./ui/IOSWidget.js";
import { Badge } from "./ui/badge.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

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
    const hasLayoutDone = steps.some(s => s.id === "layout_plan" && s.status === "completed");

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
        currentTask: hasPlanDone ? "任务委派完毕，检索、小组件构建与排版 Agent 正在协同作业" : isPlanRunning ? "剖析意图并分发专职任务" : "待命统筹",
        completedTasksCount: hasPlanDone ? 3 : 0,
        totalTasksCount: 3,
        outputSummary: "完成原词与多维检索规划，向全网检索 Agent、小组件构建 Agent 与小组件排版 Agent 派发独立任务"
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
        outputSummary: "规划小组件能力模型并自主锻造独有交互式业务卡片"
      },
      {
        id: "agent-layout",
        role: "layout",
        name: "小组件排版 Agent",
        title: "12 栅格小组件排版编排专家",
        isMaster: false,
        dedicatedDuty: "专职决定小组件的上桌启停、阅读序、板块栅格跨度与视觉焦点，执行稠密装箱补位，把组件清单翻译成零留白的 12 栅格桌面",
        avatarIcon: "LayoutGrid",
        status: hasLayoutDone ? "completed" : isConcurrentTeamActive ? "running" : "idle",
        currentTask: hasLayoutDone ? "TASK-LAYOUT 排版编排完成并交付" : isConcurrentTeamActive ? "正在编排 12 栅格桌面排版" : "等待主 Agent 派发排版任务",
        completedTasksCount: hasLayoutDone ? 2 : 0,
        totalTasksCount: 2,
        outputSummary: "完成小组件启停、阅读序、栅格跨度与视觉焦点编排，并执行行带对齐装箱"
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
    const hasLayoutDone = steps.some(s => s.id === "layout_plan" && s.status === "completed");

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
      },
      {
        id: "TASK-LAYOUT",
        assignedToRole: "layout",
        assignedAgentName: "小组件排版 Agent",
        taskName: "12 栅格小组件排版编排与视觉焦点规划",
        mandate: "专职接收 WidgetPlan 与既有组件清单，裁决组件的上桌启停、主阅读序、每张卡片的 12 栅格跨度与视觉焦点组件，并执行稠密装箱补位，输出可直接渲染的排版决策单。",
        status: hasLayoutDone ? "completed" : isConcurrentTeamActive ? "running" : "pending",
        deliverables: hasLayoutDone ? ["排版意图与阅读主序已固化", "栅格跨度与视觉焦点已提权", "稠密装箱补位已消除栅格断层"] : undefined
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

  // 加速比只呈现真实测量值：编排内核报告「各阶段耗时之和 ÷ 实际墙钟」。
  // 旧实现在没有测量数据时硬编码一个 2.6/2.2 展示给用户，属于凭空捏造的指标，已移除。
  const orchestration = agentTeam?.orchestration;
  const speedup: number | null = orchestration?.speedup ?? agentTeam?.speedupMultiplier ?? null;
  const savedMs: number | null = orchestration
    ? Math.max(agentTeam?.totalSavedTimeMs ?? 0, orchestration.estimatedSequentialMs - orchestration.totalDurationMs)
    : (agentTeam?.totalSavedTimeMs ?? null);
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
      case "layout":
        return <LayoutGrid className={className} />;
      default:
        return <Workflow className={className} />;
    }
  };

  return (
    <IOSWidget
      id="widget-agent-team"
      title="AgentTeam 三核智能体协作中枢"
      subtitle={
        isComplete
          ? `主 Agent 统筹验收交付 · 耗时 ${((executionTimeMs || 0) / 1000).toFixed(1)} 秒 · 检索、小组件构建与排版 Agent 协同已闭环`
          : `主 Agent 正在统筹调度：${runningMembers} 位专职智能体正在执行独立任务...`
      }
      icon={<Workflow />}
      badge={
        <Badge
          variant="secondary"
          className={`font-mono${orchestration ? " cursor-help" : ""}`}
          title={orchestration
            ? [
              `声明式编排实测剖面（加速比 = 各阶段耗时之和 ÷ 实际墙钟）`,
              ...orchestration.stages.map(
                (s) => `· ${s.name}：执行 ${s.durationMs}ms，启动于 +${s.waitMs}ms（${s.status}）`
              ),
              `峰值并发 ${orchestration.maxConcurrency} 个阶段`,
              orchestration.degradedCount > 0 ? `${orchestration.degradedCount} 个阶段已降级兜底` : "无降级"
            ].join("\n")
            : "编排实测数据将在流水线完成后给出"}
        >
          协同加速 {speedup !== null ? `${speedup}x` : "测量中"}
        </Badge>
      }
      actions={
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "matrix" | "team" | "timeline")}
        >
          <TabsList>
            <TabsTrigger value="matrix">委派图谱</TabsTrigger>
            <TabsTrigger value="team">专家成员</TabsTrigger>
            <TabsTrigger value="timeline">协作流水</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      className="w-full"
    >
      {/* Master-Worker 委派机制说明 */}
      <div className="mb-4 p-4 rounded-xl border border-border bg-muted/40">
        <div className="flex items-start gap-3">
          <Workflow className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-medium text-foreground">
              主 Agent 任务分派与专职协同机制
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              由<strong className="text-foreground">主 Agent（调度总控）</strong>研判意图并下达《专属任务委派书》，<strong className="text-foreground">全网检索 Agent、小组件规划构建 Agent 与小组件排版 Agent</strong> 各自专注负责专属领域（全网信源嗅探、业务小组件架构与锻造、12 栅格排版编排），互不重叠并在最后交付主 Agent 验收。
            </p>
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              实测：协同提速 {speedup !== null ? `${speedup}x` : "—"}
              {savedMs !== null && savedMs > 0 ? ` · 缩短延迟 ~${savedMs}ms` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MASTER AGENT TASK DELEGATION MATRIX (主 Agent 任务委派图谱) */}
      {/* ========================================================================= */}
      {viewMode === "matrix" && (
        <div className="space-y-4">
          {/* 主 Agent 调度中枢 */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Bot className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-sm text-foreground">
                    {masterAgent.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {masterAgent.title} · 当前研判输入：“{query}”
                  </p>
                </div>
              </div>

              <span className="text-xs text-muted-foreground">
                已向 {tasks.length} 位专长 Agent 派发独立委派单
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
              <span className="font-medium text-foreground">主 Agent 调度指令：</span>{" "}
              {masterAgent.mandateSummary}
            </div>
          </div>

          {/* 主 Agent 向下派发 */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs py-0.5">
            <span className="w-12 h-px bg-border" />
            <GitFork className="size-3.5" />
            <span>主 Agent 任务派发与专职执行矩阵</span>
            <span className="w-12 h-px bg-border" />
          </div>

          {/* 专职委派任务 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map((task) => {
              const assignedMember = members.find(m => m.role === task.assignedToRole);
              const isCompleted = task.status === "completed";
              const isRunning = task.status === "running";

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isRunning
                      ? "bg-card border-foreground/20"
                      : isCompleted
                      ? "bg-card border-border"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <div>
                    {/* 任务名与承接智能体 */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="min-w-0">
                        <span className="font-medium text-sm text-foreground truncate block">
                          {task.taskName}
                        </span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          承接智能体：
                          <span className="text-foreground">{task.assignedAgentName}</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isRunning && (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="size-3 animate-spin" />
                            执行中
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="size-3" />
                            已交付
                          </Badge>
                        )}
                        {task.status === "pending" && (
                          <Badge variant="ghost">待命</Badge>
                        )}
                      </div>
                    </div>

                    {/* 该 Agent 的专属职责 */}
                    <div className="mb-2.5 p-2.5 rounded-lg bg-muted/60 text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">专属职责：</span>
                      <span>{assignedMember?.dedicatedDuty}</span>
                    </div>

                    {/* 主 Agent 派发指令 */}
                    <div className="mb-2.5 text-xs text-muted-foreground pl-2.5 border-l-2 border-border">
                      <span className="font-medium text-foreground">主 Agent 派发指令：</span>
                      <p className="mt-0.5">{task.mandate}</p>
                    </div>

                    {/* 交付物 */}
                    {task.deliverables && task.deliverables.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-border">
                        <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                          向主 Agent 提交的专职交付物
                        </span>
                        <div className="space-y-1">
                          {task.deliverables.map((item, idx) => (
                            <div
                              key={idx}
                              className="text-xs flex items-center gap-1.5 text-muted-foreground"
                            >
                              <CheckCircle2 className="size-3.5 shrink-0" />
                              <span className="truncate">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {task.executionTimeMs && (
                    <div className="mt-2.5 pt-2.5 border-t border-border text-xs text-muted-foreground font-mono">
                      耗时 {task.executionTimeMs}ms
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
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    isSelected
                      ? "ring-2 ring-foreground/30 border-border bg-muted/40"
                      : isRunning
                      ? "bg-card border-foreground/20"
                      : isDone
                      ? "bg-card border-border hover:bg-accent"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  {/* 状态与角色 */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="text-muted-foreground">
                      {renderAgentIcon(member.role, "size-4")}
                    </span>

                    <div className="flex items-center gap-1">
                      {member.isMaster && (
                        <Badge variant="outline">主 Agent</Badge>
                      )}
                      {isRunning && (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="size-3 animate-spin" />
                          运行中
                        </Badge>
                      )}
                      {isDone && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="size-3" />
                          就绪
                        </Badge>
                      )}
                      {isIdle && (
                        <Badge variant="ghost">待命</Badge>
                      )}
                    </div>
                  </div>

                  {/* 名称与职责 */}
                  <div className="mb-2">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {member.name}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {member.title}
                    </p>
                  </div>

                  {/* 当前任务 */}
                  <div className="pt-2 border-t border-border text-xs">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span>当前指派任务</span>
                      <span className="font-mono">
                        {member.completedTasksCount}/{member.totalTasksCount}
                      </span>
                    </div>
                    <p className={`leading-relaxed line-clamp-2 ${
                      isRunning ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}>
                      {member.currentTask}
                    </p>

                    {member.executionTimeMs && (
                      <div className="mt-1.5 flex items-center justify-between text-muted-foreground font-mono">
                        <span>耗时 {member.executionTimeMs}ms</span>
                        {member.speedupMultiplier && (
                          <span>{member.speedupMultiplier}x</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 选中成员的交付报告 */}
          {selectedAgentRole && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs">
              {(() => {
                const target = members.find(m => m.role === selectedAgentRole);
                if (!target) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        {renderAgentIcon(target.role, "size-4 text-muted-foreground")}
                        <span>{target.name} 专属职责与交付报告</span>
                      </div>
                      <span className="text-muted-foreground font-mono">
                        {target.completedTasksCount} / {target.totalTasksCount} 任务完成
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-card border border-border">
                      <div className="font-medium text-foreground mb-0.5">
                        独立负责的专业领域
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {target.dedicatedDuty}
                      </p>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">向主 Agent 的交付汇报：</strong>{" "}
                      {target.outputSummary || "该智能体已完成专职任务交付，输出已被主 Agent 验收。"}
                    </p>

                    {target.deliverables && target.deliverables.length > 0 && (
                      <div className="mt-1 pt-2 border-t border-border">
                        <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                          具体交付成果物清单
                        </span>
                        <div className="space-y-1">
                          {target.deliverables.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-muted-foreground text-xs">
                              <CheckCircle2 className="size-3.5 shrink-0" />
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
                className="p-4 rounded-xl bg-card border border-border"
              >
                <div
                  onClick={() => hasDetails && toggleExpand(step.id)}
                  className={`flex items-center justify-between gap-3 ${hasDetails ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 text-muted-foreground">
                      {step.status === "completed" && (
                        <CheckCircle2 className="size-4" />
                      )}
                      {step.status === "running" && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      {step.status === "error" && (
                        <AlertCircle className="size-4 text-destructive" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      {step.agentRole && (
                        <Badge variant="secondary" className="gap-1">
                          {renderAgentIcon(step.agentRole, "size-3")}
                          <span>{step.agentName || "Agent"}</span>
                        </Badge>
                      )}
                      <span className="text-sm font-medium text-foreground truncate">
                        {step.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {step.speedupFactor && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {step.speedupFactor}
                      </span>
                    )}
                    {step.timestamp && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                    {hasDetails && (
                      <span className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-muted-foreground pl-6.5 leading-relaxed">
                  {step.description}
                </p>

                {/* 展开的步骤明细 */}
                {isExpanded && hasDetails && (
                  <div className="mt-3 pl-6.5 pt-3 border-t border-border space-y-1.5">
                    {step.details?.map((detail, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-mono text-muted-foreground flex items-start gap-2 bg-muted/40 p-2 rounded-lg"
                      >
                        <ArrowRight className="size-3.5 shrink-0 mt-0.5" />
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
