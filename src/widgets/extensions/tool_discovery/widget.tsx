import React, { useState } from "react";
import type { ToolDiscoveryData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { toolDiscoveryAdapter } from "./adapter.js";
import {
  Sparkles,
  Compass,
  Star,
  ExternalLink,
  ShieldCheck,
  Check,
  CheckCircle2,
  Tag,
  ArrowUpRight
} from "lucide-react";

export interface ToolDiscoveryWidgetProps {
  data?: ToolDiscoveryData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const ToolDiscoveryWidget: React.FC<ToolDiscoveryWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;

  const data: ToolDiscoveryData =
    props.data ??
    toolDiscoveryAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-cyan-500/10 via-card to-blue-500/5 rounded-2xl border border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Compass className="w-4 h-4 text-cyan-500" />
            <span className="truncate max-w-[120px]">{data.targetOrTopic} 工具</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold">
            {data.tools.length} 款推荐
          </span>
        </div>
        <div className="my-2 space-y-1">
          {data.tools.slice(0, 2).map((t) => (
            <div key={t.id} className="text-xs flex items-center justify-between text-muted-foreground">
              <span className="font-semibold text-foreground truncate">{t.name}</span>
              <span className="text-[10px] text-cyan-500 font-medium">{t.pricing}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>开源与高效矩阵</span>
          <span className="text-cyan-500">严选</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-cyan-500/10 via-card to-sky-600/5 rounded-3xl border border-cyan-500/20 shadow-xs">
      {/* 头部标题 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-xs font-bold tracking-wide flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                工具发现与替代矩阵
              </span>
              <span className="text-xs font-bold text-foreground">{data.tools.length} 款精选推荐</span>
            </div>
            <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
              {data.categoryTitle}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{data.description}</p>
          </div>
        </div>

        {/* 工具卡片 2x2 网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2">
          {data.tools.map((tool) => (
            <div
              key={tool.id}
              className={`p-3.5 rounded-2xl bg-background/80 hover:bg-background border transition-all flex flex-col justify-between ${
                tool.isBestAlternative ? "border-cyan-500/50 shadow-xs" : "border-border/60"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">{tool.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground font-medium">
                        {tool.pricing}
                      </span>
                      {tool.isBestAlternative && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold">
                          首选替代
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{tool.tagline}</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{tool.rating}</span>
                  </div>
                </div>

                {/* 亮点与优势 */}
                <div className="mt-2.5 space-y-1">
                  <div className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-500 shrink-0" />
                    <span className="truncate">{tool.highlightFeature}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {tool.pros.map((pro, pi) => (
                      <span
                        key={pi}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground"
                      >
                        ✓ {pro}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 底部直达链接 */}
              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{tool.category}</span>
                {tool.url && (
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>体验工具</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部信息 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>基于社区口碑、开源活跃度与安全合规严选</span>
        <span className="text-cyan-600 dark:text-cyan-400 font-medium">全天候持续更新</span>
      </div>
    </div>
  );
};
