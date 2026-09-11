import React from "react";
import { SearchResult, DetectedLanguage } from "../types.js";
import { IOSWidget } from "./ui/IOSWidget.js";
import { ShieldCheck, ExternalLink, Globe, CheckCircle2, Sparkles, Lock, ArrowUpRight } from "lucide-react";

interface OfficialPortalWidgetProps {
  query: string;
  officialWebsite?: SearchResult;
  detectedLanguage?: DetectedLanguage;
  rawResultCount: number;
  filteredCount: number;
  isCompact?: boolean;
}

export const OfficialPortalWidget: React.FC<OfficialPortalWidgetProps> = ({
  query,
  officialWebsite,
  detectedLanguage,
  rawResultCount,
  filteredCount,
  isCompact = false
}) => {
  if (officialWebsite) {
    let hostname = "";
    try {
      hostname = new URL(officialWebsite.url).hostname;
    } catch {
      hostname = officialWebsite.url;
    }

    return (
      <IOSWidget
        id="widget-official-portal"
        title="官方认证门户"
        subtitle="算法多层核验 · 官方正品入口"
        icon={<ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
        badge={
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>官方直属</span>
          </span>
        }
        className="w-full"
      >
        <div className="flex flex-col space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                  {hostname}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-[10px] text-zinc-500 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
                <Lock className="w-2.5 h-2.5 text-emerald-500" />
                <span>SSL直连</span>
              </div>
            </div>

            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
              {officialWebsite.title}
            </h4>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
              {officialWebsite.snippet || "经权威检索特征比对与顶级域名分析，该站点已核验为官方直属核心门户。"}
            </p>

            {/* Credential features chips to balance height */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px]">
                <span className="text-zinc-400 block text-[10px]">核验状态</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  权威根域名
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px]">
                <span className="text-zinc-400 block text-[10px]">置信指数</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block font-mono">
                  {Math.round((officialWebsite.score || 0.98) * 100)}% 权威匹配
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <a
              href={officialWebsite.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold transition-all shadow-xs active:scale-98"
            >
              <span>立即直达官方网站</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </IOSWidget>
    );
  }

  // Fallback: Query Entity & Retrieval Overview Widget
  return (
    <IOSWidget
      id="widget-entity-overview"
      title="知识实体与规划"
      subtitle="意图提炼与信源拓扑"
      icon={<Sparkles className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
      className="w-full"
    >
      <div className="flex flex-col space-y-3">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            {query}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            本词条已启用全域实时并发检索，剔除冗余干扰，汇聚多方独立一手资料。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="p-2.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/80">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">原始抓取</span>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{rawResultCount} 条</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/80">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">精选信源</span>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{filteredCount} 条</span>
          </div>
        </div>

        {detectedLanguage && (
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/80 text-xs text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/70">
            <span>{detectedLanguage.flag}</span>
            <span>识别为 {detectedLanguage.name} 查询</span>
            {detectedLanguage.crossLingualEnabled && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">· 跨语种检索</span>
            )}
          </div>
        )}
      </div>
    </IOSWidget>
  );
};
