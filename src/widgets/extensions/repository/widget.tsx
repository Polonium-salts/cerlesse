import React, { useState } from "react";
import type { RepositoryData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { repositoryAdapter } from "./adapter.js";
import {
  GitFork,
  Star,
  Eye,
  AlertCircle,
  GitBranch,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Terminal,
  ShieldCheck,
  Clock
} from "lucide-react";

export interface RepositoryWidgetProps {
  data?: RepositoryData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const RepositoryWidget: React.FC<RepositoryWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [copiedType, setCopiedType] = useState<"https" | "ssh" | null>(null);

  const data: RepositoryData =
    props.data ??
    repositoryAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const handleCopy = (text: string, type: "https" | "ssh") => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return String(num);
  };

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-zinc-500/10 via-card to-slate-600/5 rounded-2xl border border-zinc-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Code2 className="w-4 h-4 text-blue-500" />
            <span className="truncate max-w-[120px]">{data.fullName}</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-mono text-amber-500 font-bold">
            <Star className="w-3 h-3 fill-amber-500" />
            {formatNumber(data.stars)}
          </span>
        </div>
        <div className="my-2 text-xs text-muted-foreground line-clamp-2">
          {data.description}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{data.primaryLanguage}</span>
          <span>{data.lastCommitDate}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-slate-500/10 via-card to-zinc-600/5 rounded-3xl border border-slate-500/20 shadow-xs">
      {/* 头部仓库名称与主页跳转 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-foreground/5 border border-border/60 flex items-center justify-center shrink-0">
              <Code2 className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{data.owner} /</span>
                <h2 className="text-xl font-black text-foreground tracking-tight">{data.repoName}</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Public
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.description}</p>
            </div>
          </div>

          <a
            href={data.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-foreground text-background hover:opacity-90 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-xs"
          >
            <span>GitHub 仓库</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 仓库关键指标 4 格 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">Stars</div>
              <div className="text-xs font-bold text-foreground">{formatNumber(data.stars)}</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
            <GitFork className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">Forks</div>
              <div className="text-xs font-bold text-foreground">{formatNumber(data.forks)}</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">Open Issues</div>
              <div className="text-xs font-bold text-foreground">{data.openIssues}</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">最新提交</div>
              <div className="text-xs font-bold text-foreground">{data.lastCommitDate}</div>
            </div>
          </div>
        </div>

        {/* Git Clone 复制栏 */}
        <div className="p-2.5 rounded-2xl bg-zinc-950 text-zinc-100 dark:bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2 shadow-inner mb-3">
          <div className="flex items-center gap-2 min-w-0 font-mono text-xs text-zinc-300">
            <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-zinc-500 select-none">git clone</span>
            <span className="truncate select-all text-zinc-200">{data.cloneUrl}</span>
          </div>
          <button
            onClick={() => handleCopy(`git clone ${data.cloneUrl}`, "https")}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all flex items-center gap-1 shrink-0"
          >
            {copiedType === "https" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedType === "https" ? "已复制" : "复制"}</span>
          </button>
        </div>
      </div>

      {/* 语言比例条与主题标签 */}
      <div className="pt-2 border-t border-border/60">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-foreground">语言构成</span>
          <div className="flex items-center gap-3">
            {data.languages?.map((l) => (
              <span key={l.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name} <span className="font-mono">{l.percentage}%</span>
              </span>
            ))}
          </div>
        </div>

        {/* 语言比例条 */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
          {data.languages?.map((l) => (
            <div
              key={l.name}
              style={{ width: `${l.percentage}%`, backgroundColor: l.color }}
              className="h-full"
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {data.topics?.slice(0, 5).map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
