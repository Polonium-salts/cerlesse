import React, { useState, useEffect, FormEvent } from "react";
import { Search, X, Sparkles, ArrowRight, CornerDownLeft, Loader2 } from "lucide-react";
import { Button } from "./ui/button.js";
import { motion, AnimatePresence } from "motion/react";

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
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 640;
  });

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch(query.trim(), deepSearch);
  };

  if (!isHomeView) {
    // 结果页顶栏内的紧凑检索框
    return (
      <form
        onSubmit={handleSubmit}
        className={`w-full flex items-center h-10 px-3.5 rounded-full border bg-muted/40 transition-all duration-200 ${
          deepSearch
            ? "border-primary/40 focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20 bg-primary/[0.02]"
            : "border-border focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/30"
        }`}
      >
        <div className="relative mr-2 shrink-0 flex items-center">
          {deepSearch ? (
            <Sparkles className="size-4 text-primary animate-pulse" />
          ) : (
            <Search className="size-4 text-muted-foreground" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={deepSearch ? (isNarrow ? "向 AI 智能体提问..." : "在 Cerlesse 中向 AI 智能体提问...") : "快速搜索网页与链接..."}
          disabled={isLoading}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none truncate"
        />

        {query && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setQuery("")}
            title="清空"
            className="rounded-full"
          >
            <X />
          </Button>
        )}

        <Button
          type="submit"
          size="icon-sm"
          disabled={!query.trim() || isLoading}
          title="执行搜索"
          className="rounded-full shrink-0 ml-1"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        </Button>
      </form>
    );
  }

  // 首页居中检索
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      <form
        onSubmit={handleSubmit}
        className={`w-full rounded-2xl sm:rounded-full border bg-card shadow-sm p-2 pl-4 sm:pl-5 flex items-center gap-2.5 transition-all duration-300 ${
          deepSearch
            ? "border-primary/40 ring-2 ring-primary/15 shadow-md shadow-primary/5 focus-within:ring-4 focus-within:ring-primary/25"
            : "border-border focus-within:ring-2 focus-within:ring-ring/30"
        }`}
      >
        <div className="relative flex items-center shrink-0 ml-1">
          <AnimatePresence mode="wait">
            {deepSearch ? (
              <motion.div
                key="sparkles"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Sparkles className="size-5 text-primary" />
              </motion.div>
            ) : (
              <motion.div
                key="search"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Search className="size-5 text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            deepSearch
              ? (isNarrow ? "向 Codex 智能体提问..." : "向 Codex 智能体提问技术架构、深度对比...")
              : (isNarrow ? "搜索网页或网址..." : "检索网页链接、官方网站与即时资讯...")
          }
          disabled={isLoading}
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 truncate"
        />

        {query && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setQuery("")}
            title="清空"
            className="rounded-full shrink-0"
          >
            <X />
          </Button>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!query.trim() || isLoading}
          className={`rounded-full px-3 sm:px-5 shrink-0 whitespace-nowrap transition-all text-xs sm:text-sm h-9 sm:h-11 ${
            deepSearch ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs" : ""
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin size-3.5 sm:size-4" />
              <span>搜索中</span>
            </>
          ) : (
            <>
              <span className="whitespace-nowrap">{deepSearch ? "AI 研报" : "搜索"}</span>
              <CornerDownLeft className="opacity-60 size-3.5 sm:size-4 hidden sm:inline" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
};
