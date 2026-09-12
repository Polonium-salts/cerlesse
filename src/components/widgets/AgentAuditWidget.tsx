import React from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import { Workflow, CheckCircle2, ArrowRight, Zap, Bot, Search, Blocks, LayoutGrid, ShieldCheck, Crown, BookOpen } from "lucide-react";
import { AgentStep, AgentTeamReport, AgentRole, TeamMember } from "../../types.js";

interface AgentAuditWidgetProps {
  steps: AgentStep[];
  query: string;
  executionTimeMs?: number;
  modelUsed?: string;
  agentTeam?: AgentTeamReport | null;
  onViewDetails?: () => void;
}

export const AgentAuditWidget: React.FC<AgentAuditWidgetProps> = ({
  steps = [],
  query,
  executionTimeMs = 450,
  modelUsed,
  agentTeam,
  onViewDetails
}) => {
  const members: TeamMember[] = agentTeam?.members || [
    {
      id: "1",
      role: "coordinator",
      name: "主 Agent (调度总控)",
      title: "意图研判与任务派发中枢",
      isMaster: true,
      dedicatedDuty: "全局需求感知、协作图谱分解、向检索与小组件专职 Agent 派发独立任务并最终验收交付",
      avatarIcon: "Bot",
      status: "completed",
      currentTask: "任务委派完毕，检索与小组件 Agent 已完成协同",
      assignedTaskId: "TASK-MASTER",
      completedTasksCount: 2,
      totalTasksCount: 2
    },
    {
      id: "2",
      role: "retrieval",
      name: "全网检索 Agent",
      title: "信源抓取与权威官网甄别专家",
      isMaster: false,
      dedicatedDuty: "专职负责全网多源抓取、跨语言检索分词、官方权威网站甄别与垃圾杂音清洗",
      avatarIcon: "Search",
      status: "completed",
      currentTask: "TASK-RETRIEVE 专职检索完成并交付",
      assignedTaskId: "TASK-RETRIEVE",
      completedTasksCount: 2,
      totalTasksCount: 2,
      speedupMultiplier: 2.4
    },
    {
      id: "3",
      role: "widget_forge",
      name: "小组件规划与构建 Agent",
      title: "小组件能力模型与交互卡片锻造专家",
      isMaster: false,
      dedicatedDuty: "专职小组件能力规划 (WidgetPlan) 与独有业务小组件锻造 (CustomCardData)，装配交互模型并执行防重复护栏",
      avatarIcon: "Blocks",
      status: "completed",
      currentTask: "TASK-WIDGET-ARCHITECT 专属卡片构建完成并交付",
      assignedTaskId: "TASK-WIDGET-ARCHITECT",
      completedTasksCount: 2,
      totalTasksCount: 2,
      speedupMultiplier: 2.6
    }
  ];

  const speedup = agentTeam?.speedupMultiplier || 2.4;

  const renderIcon = (role: AgentRole) => {
    switch (role) {
      case "coordinator": return <Bot className="w-3.5 h-3.5 text-blue-500" />;
      case "retrieval": return <Search className="w-3.5 h-3.5 text-indigo-500" />;
      case "widget_forge": return <Blocks className="w-3.5 h-3.5 text-purple-500" />;
      default: return <Workflow className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  return (
    <IOSWidget
      id="widget-agent-team-audit"
      title="Agent 专属任务分派矩阵"
      subtitle="OpenAI Agents 架构 · 检索与小组件双核协同"
      icon={<Workflow className="w-4 h-4 text-blue-500" />}
      badge={
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-mono">
          <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500" />
          <span>加速 {speedup}x</span>
        </span>
      }
      className="w-full h-full"
    >
      <div className="flex-1 flex flex-col justify-between space-y-3">
        {/* Master Agent header callout */}
        <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/40 text-[11px] flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <span className="font-bold text-zinc-900 dark:text-zinc-100">主 Agent (调度总控)：</span>
            <span className="text-zinc-600 dark:text-zinc-300">
              精准拆解 2 项独立专职任务，分发专责指令给检索与小组件专职 Agent
            </span>
          </div>
        </div>

        {/* 4 Specialist Agents with their distinct responsibilities */}
        <div className="space-y-1.5">
          {members.filter(m => !m.isMaster).map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-600 flex items-center justify-center shrink-0">
                  {renderIcon(member.role)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-[11px] truncate">
                      {member.name}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 font-mono">
                      {member.assignedTaskId || "专职"}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                    {member.currentTask || member.title}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                {member.speedupMultiplier && (
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    ⚡{member.speedupMultiplier}x
                  </span>
                )}
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            </div>
          ))}
        </div>

        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="w-full py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Workflow className="w-3.5 h-3.5 text-blue-500" />
            <span>查看主 Agent 任务委派图谱</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </IOSWidget>
  );
};
