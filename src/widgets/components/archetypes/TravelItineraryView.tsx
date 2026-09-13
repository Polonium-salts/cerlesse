import React, { useState } from "react";
import { TravelItineraryData } from "../../../types.js";
import { Calendar, Clock, Compass, DollarSign, ExternalLink, Luggage, Navigation, Sparkles, Ticket } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { buttonVariants } from "../../../components/ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";

interface TravelItineraryViewProps {
  data: TravelItineraryData;
  themeColor?: string;
  onExecuteAction?: (action: any) => void;
}

/**
 * 行程规划视图 (travel_itinerary)
 *
 * shadcn/ui 重做要点：
 *   · 概览三格由「蓝/绿/琥珀三色透明图标底 + 彩色描边」改为统一 muted 图标盒 +
 *     border 容器：目的地、周期、预算是三类**对等**信息，没有主次之分，
 *     用三种色相分别编码反而制造了虚假层级；
 *   · 日切换由药丸改为 Tabs 分段控件（日序是序号枚举，正是分段控件的语义场景）；
 *   · 景点序号由圆形改为 rounded-[4px] 方角，与时间轴、名次徽标统一形状语汇；
 *   · 避坑贴士去掉琥珀色，改由 Sparkles 图标 + muted 文字承担提示语义；
 *   · 购票 / 票务平台入口统一走 buttonVariants（<a> 复用按钮外观），
 *     不再各自拼一套描边样式；
 *   · 全量移除 zinc-* / blue-* / emerald-* / amber-* 硬编码色。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
export const TravelItineraryView: React.FC<TravelItineraryViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onExecuteAction
}) => {
  const [activeDay, setActiveDay] = useState<number>(1);

  const days = data.days || [];
  const currentDayPlan = days.find(d => d.day === activeDay) || days[0];

  return (
    <div className="flex flex-col gap-4">
      {/* 概览指标 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <OverviewCell
          icon={<Compass className="size-4" />}
          label="目的路线"
          value={data.destination}
        />
        <OverviewCell
          icon={<Calendar className="size-4" />}
          label="建议游玩周期"
          value={data.suggestedDuration || `${days.length} 天深度游`}
        />
        <OverviewCell
          icon={<DollarSign className="size-4" />}
          label="预估人均预算"
          value={data.estimatedBudget || "¥2000-4500 / 人"}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* 日切换 */}
      {days.length > 0 && (
        <Tabs value={String(activeDay)} onValueChange={value => setActiveDay(Number(value))}>
          <TabsList>
            {days.map(d => (
              <TabsTrigger key={d.day} value={String(d.day)} className="shrink-0">
                <span>第 {d.day} 天</span>
                <span className="max-w-[80px] truncate text-xs font-normal opacity-80">
                  {d.title}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* 当日行程 */}
      {currentDayPlan && (
        <div className="flex flex-col gap-3.5 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
            <h4 className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <Badge variant="secondary" className="font-mono tabular-nums">
                Day {currentDayPlan.day}
              </Badge>
              <span className="truncate">{currentDayPlan.title}</span>
            </h4>
            {currentDayPlan.transportation && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Navigation className="size-3" />
                交通：{currentDayPlan.transportation}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {currentDayPlan.spots.map((spot, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-primary font-mono text-xs font-semibold tabular-nums text-primary-foreground">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground">{spot.name}</span>
                    {spot.suggestedDuration && (
                      <span className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {spot.suggestedDuration}
                      </span>
                    )}
                  </div>

                  <p className="pl-7 text-xs leading-relaxed text-muted-foreground">
                    {spot.description}
                  </p>

                  {spot.tips && (
                    <div className="flex items-center gap-1 pl-7 text-xs font-medium text-muted-foreground">
                      <Sparkles className="size-3 shrink-0" />
                      <span>避坑贴士：{spot.tips}</span>
                    </div>
                  )}
                </div>

                {spot.ticketUrl && (
                  <a
                    href={spot.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}
                  >
                    <Ticket />
                    <span>购票/预约</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 行前清单与票务平台 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.essentialTips && data.essentialTips.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Luggage className="size-3.5 text-muted-foreground" />
              <span>行前必备与避坑清单</span>
            </div>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {data.essentialTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="shrink-0 text-muted-foreground">·</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.bookingLinks && data.bookingLinks.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Ticket className="size-3.5 text-muted-foreground" />
              <span>正版票务与交通平台</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {data.bookingLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1" })}
                >
                  <span>{link.label}</span>
                  <ExternalLink />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** 概览单元：统一 muted 图标盒 + 弱化标签 + 单行值 */
const OverviewCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}> = ({ icon, label, value, className }) => (
  <div
    className={`flex items-center gap-2.5 rounded-lg border bg-muted/40 p-3 ${className || ""}`}
  >
    <div className="shrink-0 rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  </div>
);
