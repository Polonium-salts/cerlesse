import React, { useState, useEffect, FormEvent } from "react";
import { Search, X, Sparkles, Zap, ArrowRight, CornerDownLeft } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string, deep: boolean) => void;
  isLoading: boolean;
  initialQuery?: string;
  isHomeView?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  initialQuery = "",
  isHomeView = true
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [deepSearch, setDeepSearch] = useState(true);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch(query.trim(), deepSearch);
  };

  if (!isHomeView) {
    // Compact Header Search Bar for Results View (iOS Spotlight Bar)
    return (
      <form
        onSubmit={handleSubmit}
        className="w-full flex items-center h-10 px-3.5 rounded-2xl border border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100/90 dark:bg-zinc-800/80 focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:shadow-xs transition-all"
      >
        <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 mr-2.5" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="在 Cerlesse 中搜索任何内容..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
        />

        {query && !isLoading && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors mr-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="w-7 h-7 rounded-xl flex items-center justify-center bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 disabled:opacity-30 transition-all cursor-pointer shrink-0 ml-1"
          title="执行搜索"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
        </button>
      </form>
    );
  }

  // Large Spotlight Search Widget for Home View
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e] shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-2 sm:p-2.5 flex items-center gap-3 transition-all focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:shadow-[0_6px_28px_rgba(0,0,0,0.08)]"
      >
        {/* iOS squircle search icon */}
        <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
          <Search className="w-5 h-5" />
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="检索技术架构、方案选型、官方网站或复杂问题..."
          disabled={isLoading}
          autoFocus
          className="w-full bg-transparent text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none disabled:opacity-50"
        />

        {/* Clear Button */}
        {query && !isLoading && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Submit Action Button */}
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="h-10 px-4 rounded-2xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-40 shadow-xs cursor-pointer active:scale-95"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>搜索中</span>
            </>
          ) : (
            <>
              <span>搜索</span>
              <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
            </>
          )}
        </button>
      </form>

      {/* iOS Segmented Mode Switcher & Quick Tags */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <div className="p-1 rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDeepSearch(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              deepSearch
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>深度 Agent (导图+对比)</span>
          </button>

          <button
            type="button"
            onClick={() => setDeepSearch(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              !deepSearch
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>极速直答</span>
          </button>
        </div>
      </div>

      {/* Instant Task Scenarios Discovery Chips */}
      <div className="mt-6 w-full flex flex-col items-center">
        <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-2.5 tracking-wide">
          快速体验智能自适应任务布局
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
          {[
            { label: "🛠️ 在线 PDF 转换免安装工具", query: "pdf 转 word 在线免安装工具" },
            { label: "💻 Docker 安装教程与国内镜像", query: "docker 安装教程与国内镜像源配置" },
            { label: "✈️ 成都三日游精选路线与避坑", query: "成都三日游路线攻略与避坑指南" },
            { label: "⚠️ npm install 报错 EACCES 解决", query: "npm install 报错 EACCES 权限问题解决办法" },
            { label: "⚖️ DeepSeek R1 对比 Claude 3.5", query: "DeepSeek R1 vs Claude 3.5 Sonnet 模型对比" }
          ].map((item) => (
            <button
              key={item.query}
              type="button"
              onClick={() => {
                setQuery(item.query);
                onSearch(item.query, deepSearch);
              }}
              className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 border border-zinc-200/90 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 shadow-2xs transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
