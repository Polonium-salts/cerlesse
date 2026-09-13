import React, { useState } from "react";
import { ProsConsData, ProsConsItem } from "../../../types.js";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Lightbulb,
  ShieldAlert,
  ThumbsUp
} from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { cn } from "../../../lib/utils.js";

interface ProsConsViewProps {
  data: ProsConsData;
  themeColor?: string;
  onUpdateData?: (updated: ProsConsData) => void;
}

/**
 * 优劣对照视图 (pros_cons)
 *
 * shadcn/ui 重做要点：
 *   · 权衡比例条由「绿→青 + 琥珀→玫红双向渐变」改为**单色双段轨道**：
 *     优势段走 bg-primary、局限段走 bg-foreground/25，靠明度差而非色相区分。
 *     渐变色在此是纯装饰，且破坏了项目的单色契约；
 *   · 两栏的识别标记由彩色圆点改为方角小标记（size-1.5 rounded-[2px]），
 *     方形是 shadcn 的形状语汇，圆形属于 iOS 语汇；
 *   · 优势/局限卡片去掉「emerald-100 / amber-100 描边」与阴影，
 *     统一 rounded-lg border bg-card，hover 时只加深描边；
 *   · 赞誉数与影响力标签改用 Badge，点赞按钮走 Button ghost + font-mono 数字对齐；
 *   · 化解方案抽屉的展开指示由「收起/展开」文字下划线改为 ChevronDown 旋转，
 *     点击目标铺满整行。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
export const ProsConsView: React.FC<ProsConsViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData
}) => {
  const [upvotes, setUpvotes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    data.pros.forEach(p => {
      initial[p.id] = p.upvotes || 0;
    });
    return initial;
  });

  const [expandedMitigations, setExpandedMitigations] = useState<Record<string, boolean>>(() => {
    // Expand first con's mitigation by default
    const initial: Record<string, boolean> = {};
    if (data.cons.length > 0) {
      initial[data.cons[0].id] = true;
    }
    return initial;
  });

  const handleUpvote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCount = (upvotes[id] || 0) + 1;
    setUpvotes(prev => ({ ...prev, [id]: nextCount }));
    if (onUpdateData) {
      const nextPros = data.pros.map(p => p.id === id ? { ...p, upvotes: nextCount } : p);
      onUpdateData({ ...data, pros: nextPros });
    }
  };

  const toggleMitigation = (id: string) => {
    setExpandedMitigations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const proPercent = data.balanceRatio?.proPercent ?? 65;
  const conPercent = data.balanceRatio?.conPercent ?? 35;

  return (
    <div className="flex flex-col gap-3">
      {/* 权衡比例 */}
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-foreground">
            <CheckCircle2 className="size-3.5 text-muted-foreground" />
            优势评级
            <span className="font-mono tabular-nums">{proPercent}%</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            局限与避坑
            <span className="font-mono tabular-nums">{conPercent}%</span>
            <AlertTriangle className="size-3.5" />
          </span>
        </div>

        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="bg-primary transition-all duration-500"
            style={{ width: `${proPercent}%` }}
          />
          <div
            className="bg-foreground/25 transition-all duration-500"
            style={{ width: `${conPercent}%` }}
          />
        </div>

        {data.tradeoffVerdict && (
          <div className="mt-2.5 flex items-start gap-1.5 rounded-md border bg-background p-2 text-xs leading-relaxed text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">权衡决策：</span>
              {data.tradeoffVerdict}
            </span>
          </div>
        )}
      </div>

      {/* 两栏对照 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* 优势栏 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span className="size-1.5 rounded-[2px] bg-primary" />
              核心优势 {data.pros.length}
            </span>
            <span className="font-mono text-xs text-muted-foreground">多源正向验证</span>
          </div>

          {data.pros.map((pro: ProsConsItem) => (
            <div
              key={pro.id}
              className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{pro.title}</span>
                  {pro.category && <span className="text-xs text-muted-foreground">{pro.category}</span>}
                  {pro.impact === "high" && <Badge variant="secondary">核心收益</Badge>}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleUpvote(pro.id, e)}
                  title="认可此优势"
                  className="h-6 shrink-0 gap-1 px-1.5 font-mono text-xs tabular-nums"
                >
                  <ThumbsUp />
                  {upvotes[pro.id] || 0}
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">{pro.description}</p>

              {pro.sourceUrl && (
                <a
                  href={pro.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 border-t border-border pt-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  <span>信源: {pro.sourceTitle || new URL(pro.sourceUrl).hostname}</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* 局限栏 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span className="size-1.5 rounded-[2px] bg-foreground/30" />
              局限与避坑 {data.cons.length}
            </span>
            <span className="font-mono text-xs text-muted-foreground">附应对方案</span>
          </div>

          {data.cons.map((con: ProsConsItem) => {
            const isMitigationOpen = expandedMitigations[con.id];
            return (
              <div
                key={con.id}
                className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{con.title}</span>
                  {con.severity && (
                    <Badge variant={con.severity === "critical" ? "destructive" : "outline"}>
                      {con.severity === "critical" ? "高风险" : "需留意"}
                    </Badge>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">{con.description}</p>

                {con.mitigation && (
                  <div className="border-t border-border pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMitigation(con.id)}
                      className="w-full justify-between px-0 text-xs font-medium"
                    >
                      <span className="flex items-center gap-1">
                        <ShieldAlert />
                        推荐化解与应对方案
                      </span>
                      <ChevronDown
                        className={cn("transition-transform", isMitigationOpen && "rotate-180")}
                      />
                    </Button>

                    {isMitigationOpen && (
                      <div className="mt-1.5 rounded-md border bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground">
                        {con.mitigation}
                      </div>
                    )}
                  </div>
                )}

                {con.sourceUrl && (
                  <a
                    href={con.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1 border-t border-border pt-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    <span>信源: {con.sourceTitle || new URL(con.sourceUrl).hostname}</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
