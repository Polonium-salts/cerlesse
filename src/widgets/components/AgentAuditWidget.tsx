import React from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Button } from "../../components/ui/button.js";
import { Workflow, CheckCircle2, ArrowRight, Bot, Search, Blocks } from "lucide-react";
import { AgentStep, AgentTeamReport, AgentRole, TeamMember } from "../../types.js";

interface AgentAuditWidgetProps {
  steps: AgentStep[];
  query: string;
  executionTimeMs?: number;
  modelUsed?: string;
  agentTeam?: AgentTeamReport | null;
  onViewDetails?: () => void;
}

/**
 * Agent 协作审计 (agent_workflow)
 *
 * shadcn/ui 重做要点：
 *   · 每个专职 Agent 一行，换用 shadcn 菜单行语汇（rounded-md + hover:bg-accent）；
 *   · 角色图标底座改为 shadcn 的 bg-muted 方形图标位（size-7 rounded-md），
 *     取代此前的 zinc 手写底色；
 *   · 「查看任务委派详情」换用 shadcn Button（default / 通栏）。
 */
export const AgentAuditWidget: React.FC<AgentAuditWidgetProps> = ({
  steps = [],
  query,
  executionTimeMs = 450,
  modelUsed,
  agentTeam,
  onViewDetails
}) => {
  const members: TeamMember[] = agentTeam?.members || [
    { id: "1", role: "coordinator", name: "主 Agent", title: "意图研判与任务派发", isMaster: true, avatarIcon: "Bot", status: "completed", currentTask: "已完成任务委派" },
    { id: "2", role: "retrieval", name: "检索 Agent", title: "多源抓取与官网甄别", isMaster: false, avatarIcon: "Search", status: "completed", currentTask: "已完成检索交付" },
    { id: "3", role: "widget_forge", name: "小组件 Agent", title: "能力规划与卡片锻造", isMaster: false, avatarIcon: "Blocks", status: "completed", currentTask: "已完成卡片交付" }
  ] as TeamMember[];

  const specialists = members.filter((m) => !m.isMaster);

  const renderIcon = (role: AgentRole) => {
    switch (role) {
      case "coordinator":
        return <Bot className="size-3.5" />;
      case "retrieval":
        return <Search className="size-3.5" />;
      case "widget_forge":
        return <Blocks className="size-3.5" />;
      default:
        return <Workflow className="size-3.5" />;
    }
  };

  return (
    <IOSWidget
      id="widget-agent-team-audit"
      title="Agent 任务分派"
      icon={<Workflow className="size-4" />}
      badge={
        <span className="text-xs text-muted-foreground">{specialists.length} 个专职 Agent</span>
      }
      className="w-full h-full"
    >
      <div className="flex flex-1 flex-col justify-between gap-3">
        <div className="flex flex-col gap-1">
          {specialists.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {renderIcon(member.role)}
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {member.name}
                  </span>
                  <div className="truncate text-xs text-muted-foreground">
                    {member.currentTask || member.title}
                  </div>
                </div>
              </div>

              <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>

        {onViewDetails && (
          <Button onClick={onViewDetails} className="w-full">
            <span>查看任务委派详情</span>
            <ArrowRight />
          </Button>
        )}
      </div>
    </IOSWidget>
  );
};
