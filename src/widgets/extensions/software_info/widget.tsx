import React, { useState } from "react";
import type { SoftwareInfoData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { softwareInfoAdapter } from "./adapter.js";
import {
  AppWindow,
  ShieldCheck,
  Calendar,
  Layers,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Tag,
  Monitor,
  HardDrive
} from "lucide-react";

export interface SoftwareInfoWidgetProps {
  data?: SoftwareInfoData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const SoftwareInfoWidget: React.FC<SoftwareInfoWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [copied, setCopied] = useState(false);

  const info: SoftwareInfoData =
    props.data ??
    softwareInfoAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const handleCopy = () => {
    const text = `${info.name} ${info.version || ""} | 开发者: ${info.developer || "官方团队"} | 许可证: ${info.license || "MIT"}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-indigo-500/10 via-card to-purple-500/5 rounded-2xl border border-indigo-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <AppWindow className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{info.name}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono">
            {info.version}
          </span>
        </div>
        <div className="my-2 text-xs text-muted-foreground line-clamp-2">
          {info.description || info.tagline}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{info.license}</span>
          <span className="text-indigo-500">{info.category}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-indigo-500/10 via-card to-purple-600/5 rounded-3xl border border-indigo-500/20 shadow-xs">
      {/* 头部标题与版本 */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-xs">
            <AppWindow className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-foreground tracking-tight">{info.name}</h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-xs font-mono font-bold">
                {info.version}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                官方已认证
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{info.tagline || info.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl bg-background/80 hover:bg-background border border-border/60 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 text-xs"
            title="复制软件规格摘要"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "已复制" : "复制"}</span>
          </button>
          {info.officialUrl && (
            <a
              href={info.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1 text-xs font-semibold shadow-xs"
            >
              <span>主页</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* 核心规格属性 4 格矩阵 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground">开发者 / 团队</div>
            <div className="text-xs font-bold text-foreground truncate">{info.developer}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground">开源许可证</div>
            <div className="text-xs font-bold text-foreground truncate">{info.license}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground">最新发布日期</div>
            <div className="text-xs font-bold text-foreground truncate">{info.releaseDate}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <HardDrive className="w-4 h-4 text-purple-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground">安装包体积</div>
            <div className="text-xs font-bold text-foreground truncate">{info.size}</div>
          </div>
        </div>
      </div>

      {/* 支持平台与特性标签 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Monitor className="w-3.5 h-3.5 text-indigo-500" />
            支持平台:
          </span>
          {info.platforms?.map((p, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-lg bg-background/70 border border-border/60 text-[11px] font-medium text-foreground"
            >
              {p.name}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {info.tags?.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
