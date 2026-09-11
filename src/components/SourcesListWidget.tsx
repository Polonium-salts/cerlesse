import React, { useState } from "react";
import { SearchResult } from "../types.js";
import { IOSWidget } from "./ui/IOSWidget.js";
import { Database, Globe, ExternalLink, ShieldCheck, Search, X, Sparkles } from "lucide-react";

interface SourcesListWidgetProps {
  results: SearchResult[];
  rawResultCount: number;
  isCompact?: boolean;
  onForgeCardFromSource?: (sourceId: string) => void;
  onOpenForgeModal?: () => void;
}

export const SourcesListWidget: React.FC<SourcesListWidgetProps> = ({
  results,
  rawResultCount,
  isCompact = false,
  onForgeCardFromSource,
  onOpenForgeModal
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<string>("all");

  const engines = Array.from(new Set(results.map(r => r.engine || "web"))).filter(Boolean);

  const filtered = results.filter(item => {
    const matchesSearch = filterQuery === "" || 
      item.title.toLowerCase().includes(filterQuery.toLowerCase()) || 
      item.snippet.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(filterQuery.toLowerCase());

    const matchesEngine = selectedEngine === "all" || (item.engine || "web") === selectedEngine;

    return matchesSearch && matchesEngine;
  });

  return (
    <IOSWidget
      id="widget-sources-list"
      title="高权重文献与信源库"
      subtitle={`原始抓取 ${rawResultCount} 条 · 去重清洗后保留 ${results.length} 条有效信源`}
      icon={<Database className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
      badge={
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {filtered.length} 条
          </span>
          {onOpenForgeModal && (
            <button
              onClick={onOpenForgeModal}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px] font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
              title="根据搜索信源生成专属卡片组件"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>创建独有卡片</span>
            </button>
          )}
        </div>
      }
      className="w-full"
    >
      <div className="flex flex-col space-y-3">
        {/* Filter Bar inside Widget */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-700/80">
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px] px-2">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="按标题或域名二次筛选..."
              className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
            />
            {filterQuery && (
              <button onClick={() => setFilterQuery("")} className="p-0.5 text-zinc-400 hover:text-zinc-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedEngine("all")}
              className={`px-2 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
                selectedEngine === "all"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              全部
            </button>
            {engines.map((eng) => (
              <button
                key={eng}
                onClick={() => setSelectedEngine(eng)}
                className={`px-2 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
                  selectedEngine === eng
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {eng}
              </button>
            ))}
          </div>
        </div>

        {/* Source Cards Grid: adapts naturally based on count and width */}
        <div className={`grid grid-cols-1 ${isCompact ? "sm:grid-cols-1" : "sm:grid-cols-2"} gap-3 ${filtered.length > 4 ? (isCompact ? "max-h-[380px]" : "max-h-[440px]") : ""} overflow-y-auto pr-1 custom-scrollbar`}>
          {filtered.map((item, idx) => {
            let host = "";
            try {
              host = new URL(item.url).hostname;
            } catch {
              host = item.url;
            }

            return (
              <div
                key={item.id || idx}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between group ${
                  item.isOfficial
                    ? "bg-zinc-100/90 dark:bg-zinc-800/90 border-zinc-300 dark:border-zinc-700"
                    : "bg-white dark:bg-zinc-800/70 border-zinc-200/80 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-2xs"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 min-w-0">
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono truncate">{host}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.isOfficial && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                          官网
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {item.engine || "web"}
                      </span>
                    </div>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <h5 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-2 leading-snug">
                      {item.title}
                    </h5>
                  </a>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {item.snippet}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>置信度 {item.score ? Math.round(item.score * 100) : 90}%</span>
                  <div className="flex items-center gap-2">
                    {onForgeCardFromSource && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onForgeCardFromSource(item.id);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        title="以本条信源为核心创建独有卡片"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>生成独有卡片</span>
                      </button>
                    )}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </IOSWidget>
  );
};
