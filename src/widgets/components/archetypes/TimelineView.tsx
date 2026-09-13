import React, { useState } from "react";
import { TimelineData, TimelineMilestone } from "../../../types.js";
import { ArrowRight, Calendar, Check, Clock, ExternalLink } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { cn } from "../../../lib/utils.js";

interface TimelineViewProps {
  data: TimelineData;
  themeColor?: string;
  onUpdateData?: (updated: TimelineData) => void;
}

/**
 * 时间轴视图 (timeline)
 *
 * shadcn/ui 重做要点：
 *   · 顶部节点导航从「绿/蓝/灰三色药丸」改为 Button 三档 variant：
 *     选中 = default（primary 实心）、已完成 = secondary、其余 = ghost ——
 *     状态层级由**实心/半实心/描边**表达，不再依赖色相（单色契约）；
 *   · 竖向轴节点由圆形改为 rounded-[4px] 方角标记，与勾选框、栏目标记统一形状语汇；
 *     当前节点用 ring-2 ring-ring/30 外圈强调，替代此前的彩色投影 + scale 放大；
 *   · Milestone 卡片去掉彩色描边与阴影，统一 rounded-lg border bg-card，
 *     选中态改走 bg-muted/40 + border-foreground/30；
 *   · 日期、影响力等需比对的信息统一 font-mono + tabular-nums；
 *   · 全量移除 zinc-* / emerald-* / blue-* 硬编码色。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
export const TimelineView: React.FC<TimelineViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData: _onUpdateData
}) => {
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(() => {
    // Default to 'current' milestone if exists, or last one
    const current = data.milestones?.find(m => m.status === "current");
    return current ? current.id : (data.milestones?.[data.milestones.length - 1]?.id || null);
  });

  const milestones = data.milestones || [];

  return (
    <div className="flex flex-col gap-4">
      {/* 代际节点导航 */}
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-foreground">演进代际脉络</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            共 {milestones.length} 个关键节点
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1 overflow-x-auto py-0.5">
          {milestones.map((m, idx) => {
            const isActive = activeMilestoneId === m.id;
            return (
              <React.Fragment key={m.id}>
                <Button
                  variant={isActive ? "default" : m.status === "completed" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveMilestoneId(m.id)}
                  className="shrink-0 gap-1.5 whitespace-nowrap"
                >
                  {m.status === "completed" ? (
                    <Check />
                  ) : m.status === "current" ? (
                    <span className="size-2 animate-pulse rounded-full bg-current" />
                  ) : (
                    <Clock />
                  )}
                  {m.dateOrPeriod || `阶段 0${idx + 1}`}
                </Button>

                {idx < milestones.length - 1 && (
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 竖向时间轴 */}
      <div className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px before:bg-border">
        {milestones.map((m: TimelineMilestone) => {
          const isActive = activeMilestoneId === m.id;

          return (
            <div
              key={m.id}
              onClick={() => setActiveMilestoneId(m.id)}
              className="group relative cursor-pointer"
            >
              {/* 轴节点：方角标记，状态靠填充与描边外圈表达 */}
              <div
                className={cn(
                  "absolute -left-6 top-1 flex size-4 items-center justify-center rounded-[4px] border bg-card transition-all",
                  isActive
                    ? "border-primary ring-2 ring-ring/30"
                    : m.status === "completed"
                    ? "border-primary bg-primary text-primary-foreground"
                    : m.status === "current"
                    ? "border-primary"
                    : "border-border"
                )}
              >
                {m.status === "completed" ? (
                  <Check className="size-3" />
                ) : m.status === "current" ? (
                  <div className="size-1.5 rounded-full bg-primary" />
                ) : (
                  <div className="size-1 rounded-full bg-muted-foreground/40" />
                )}
              </div>

              {/* 节点内容 */}
              <div
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                  isActive
                    ? "border-foreground/30 bg-muted/40"
                    : "border-border bg-card hover:border-foreground/20"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="font-mono tabular-nums">
                      <Calendar />
                      {m.dateOrPeriod}
                    </Badge>
                    <span className="truncate text-sm font-medium text-foreground">{m.title}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {m.status === "current" && <Badge>当前阶段</Badge>}
                    {m.tag && <span className="text-xs text-muted-foreground">{m.tag}</span>}
                    {m.impactScore && (
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        影响力 {m.impactScore}
                      </span>
                    )}
                  </div>
                </div>

                {m.phase && (
                  <span className="block text-xs font-medium text-muted-foreground">
                    {m.phase}
                  </span>
                )}

                <p className="text-xs leading-relaxed text-muted-foreground">{m.description}</p>

                {m.sourceUrl && (
                  <a
                    href={m.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1 border-t border-border pt-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    <span>信源: {m.sourceTitle || new URL(m.sourceUrl).hostname}</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
