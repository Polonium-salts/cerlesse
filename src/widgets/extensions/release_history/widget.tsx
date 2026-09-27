import React, { useState } from "react";
import type { ReleaseHistoryData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { releaseHistoryAdapter } from "./adapter.js";
import {
  History,
  GitCommit,
  Tag,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers
} from "lucide-react";

export interface ReleaseHistoryWidgetProps {
  data?: ReleaseHistoryData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const ReleaseHistoryWidget: React.FC<ReleaseHistoryWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [activeVersion, setActiveVersion] = useState<string>("v2.4.0");

  const data: ReleaseHistoryData =
    props.data ??
    releaseHistoryAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const activeRelease =
    data.releases.find((r) => r.version === activeVersion) || data.releases[0];

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-violet-500/10 via-card to-purple-500/5 rounded-2xl border border-violet-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <History className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{data.projectName} 演进</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 font-mono">
            {data.latestVersion}
          </span>
        </div>
        <div className="my-2">
          <div className="text-xs font-bold text-foreground truncate">{activeRelease?.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
            {activeRelease?.highlights?.[0]}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>共 {data.releases.length} 个重点里程碑</span>
          <span className="text-violet-500">{activeRelease?.date}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-violet-500/10 via-card to-purple-600/5 rounded-3xl border border-violet-500/20 shadow-xs">
      {/* 头部标题与 Changelog 外链 */}
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-xs font-bold tracking-wide flex items-center gap-1">
              <History className="w-3.5 h-3.5" />
              版本更新记录
            </span>
            <span className="text-xs font-mono font-bold text-foreground">最新: {data.latestVersion}</span>
            <span className="text-xs text-muted-foreground">· 累计 {data.totalReleases || data.releases.length} 次迭代</span>
          </div>
          <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
            {data.projectName}
            <span className="text-sm font-normal text-muted-foreground">· Changelog & 里程碑</span>
          </h2>
        </div>

        {data.changelogUrl && (
          <a
            href={data.changelogUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-all flex items-center gap-1.5 text-xs font-semibold shadow-xs"
          >
            <span>完整更新日志</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* 主体分栏：左侧版本轴 / 右侧详细变动 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-1">
        {/* 左侧版本快速切换 */}
        <div className="flex flex-col gap-1.5 md:border-r md:border-border/60 md:pr-3">
          {data.releases.map((rel) => {
            const isSelected = rel.version === (activeRelease?.version || data.releases[0].version);
            return (
              <button
                key={rel.version}
                onClick={() => setActiveVersion(rel.version)}
                className={`p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2 border ${
                  isSelected
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300 shadow-xs"
                    : "bg-background/60 hover:bg-background border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-foreground">{rel.version}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground">
                      {rel.tag}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{rel.date}</div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "translate-x-0.5 text-violet-500" : "opacity-40"}`} />
              </button>
            );
          })}
        </div>

        {/* 右侧选定版本的详细变动 */}
        <div className="md:col-span-2 p-3.5 rounded-2xl bg-background/80 border border-border/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/50 pb-2">
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  {activeRelease?.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  发布于 {activeRelease?.date} · 维护者 @{activeRelease?.author || "core"}
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold">
                {activeRelease?.version}
              </span>
            </div>

            {/* 新特性亮点列表 */}
            <div className="mt-3 space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground">✨ 新增与改进特性:</div>
              <ul className="space-y-1.5">
                {activeRelease?.highlights.map((item, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 破坏性改动提示 (若有) */}
            {activeRelease?.breakingChanges && activeRelease.breakingChanges.length > 0 && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                <div className="text-[11px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  注意：存在破坏性变更 (Breaking Changes)
                </div>
                <ul className="mt-1 space-y-1 text-xs">
                  {activeRelease.breakingChanges.map((bc, i) => (
                    <li key={i} className="leading-snug">• {bc}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部信息 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>语义化版本规范遵循 SemVer 2.0.0</span>
        <span className="text-violet-500 font-medium">支持自动化平滑迁移</span>
      </div>
    </div>
  );
};
