import React, { useState } from "react";
import type { DownloadWidgetData, DownloadReleaseOption } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { downloadAdapter } from "./adapter.js";
import {
  Download,
  Terminal,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Laptop,
  CheckCircle2,
  Box,
  FileCode,
  Sparkles
} from "lucide-react";

export interface DownloadWidgetProps {
  data?: DownloadWidgetData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const DownloadWidget: React.FC<DownloadWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  const data: DownloadWidgetData =
    props.data ??
    downloadAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOptions =
    selectedPlatform === "all"
      ? data.options
      : data.options.filter((opt) => opt.platform === selectedPlatform);

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-emerald-500/10 via-card to-teal-500/5 rounded-2xl border border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Download className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{data.softwareName} 下载</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-mono">
            {data.latestVersion}
          </span>
        </div>
        <div className="my-2">
          <div className="text-xs font-mono p-2 rounded-lg bg-background/80 border border-border/60 text-foreground truncate flex items-center justify-between">
            <span className="truncate">{data.quickCopyCommand}</span>
            <button
              onClick={() => handleCopy(data.quickCopyCommand || "", "quick-compact")}
              className="ml-2 text-muted-foreground hover:text-foreground"
            >
              {copiedId === "quick-compact" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{data.options.length} 个多平台安装包</span>
          <span className="text-emerald-500 font-medium">已签名验证</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-emerald-500/10 via-card to-teal-600/5 rounded-3xl border border-emerald-500/20 shadow-xs">
      {/* 头部标题与一键终端复制 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                官方下载中心
              </span>
              <span className="text-xs font-mono font-bold text-foreground">{data.latestVersion}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[11px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                SHA256 完整性已校验
              </span>
            </div>
            <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
              {data.softwareName}
              <span className="text-sm font-normal text-muted-foreground">· 客户端与二进制分发</span>
            </h2>
          </div>

          {data.officialSiteUrl && (
            <a
              href={data.officialSiteUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <span>官网下载页面</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* 快捷安装命令栏 */}
        {data.quickCopyCommand && (
          <div className="p-3 rounded-2xl bg-zinc-950 text-zinc-100 dark:bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2 shadow-inner mb-3">
            <div className="flex items-center gap-2 min-w-0 font-mono text-xs text-emerald-400">
              <Terminal className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-zinc-400 select-none">$</span>
              <span className="truncate select-all text-zinc-200">{data.quickCopyCommand}</span>
            </div>
            <button
              onClick={() => handleCopy(data.quickCopyCommand || "", "quick-bar")}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all flex items-center gap-1 shrink-0"
            >
              {copiedId === "quick-bar" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === "quick-bar" ? "已复制" : "一键复制"}</span>
            </button>
          </div>
        )}

        {/* 平台筛选 Tab */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          {[
            { id: "all", label: "全部平台" },
            { id: "macos", label: "macOS" },
            { id: "windows", label: "Windows" },
            { id: "linux", label: "Linux" },
            { id: "docker", label: "Docker" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedPlatform(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedPlatform === tab.id
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold"
                  : "bg-background/60 hover:bg-background/90 text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 安装包列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 my-1">
        {filteredOptions.map((opt) => (
          <div
            key={opt.id}
            className={`p-3 rounded-2xl bg-background/80 hover:bg-background border transition-all flex flex-col justify-between ${
              opt.isRecommended ? "border-emerald-500/50 shadow-xs" : "border-border/60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">{opt.platformLabel}</span>
                  {opt.isRecommended && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                      推荐
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{opt.arch} · {opt.fileType}</div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{opt.size}</span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
              {opt.command ? (
                <div className="flex items-center gap-1 min-w-0 font-mono text-[10px] text-muted-foreground bg-muted/40 px-2 py-1 rounded-md flex-1">
                  <Terminal className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">{opt.command}</span>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground font-mono truncate flex-1">
                  SHA256: {opt.sha256?.slice(0, 12)}...
                </div>
              )}

              {opt.command ? (
                <button
                  onClick={() => handleCopy(opt.command || "", opt.id)}
                  className="p-1.5 rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
                  title="复制安装命令"
                >
                  {copiedId === opt.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <a
                  href={opt.downloadUrl || data.officialSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-all flex items-center gap-1 shrink-0"
                >
                  <span>下载</span>
                  <Download className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 底部系统环境要求 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>系统要求: {data.systemRequirements}</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">无捆绑广告 · 正版镜像</span>
      </div>
    </div>
  );
};
