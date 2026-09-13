import React, { useState, useEffect, FormEvent } from "react";
import { Search, X, Sparkles, Zap, ArrowRight, CornerDownLeft, Loader2 } from "lucide-react";
import { Button } from "./ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

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
    // 结果页顶栏内的紧凑检索框
    return (
      <form
        onSubmit={handleSubmit}
        className="w-full flex items-center h-10 px-3.5 rounded-full border border-border bg-muted/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/30 transition-all"
      >
        <Search className="size-4 text-muted-foreground shrink-0 mr-2.5" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="在 Cerlesse 中搜索任何内容..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
          className="rounded-full"
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
        className="w-full rounded-full border border-border bg-card shadow-sm p-2 pl-4 sm:pl-5 flex items-center gap-2.5 transition-all focus-within:ring-2 focus-within:ring-ring/30"
      >
        <Search className="size-5 text-muted-foreground shrink-0 ml-1" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="检索技术架构、方案选型、官方网站或复杂问题..."
          disabled={isLoading}
          autoFocus
          className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
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
          size="lg"
          disabled={!query.trim() || isLoading}
          className="rounded-full px-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              搜索中
            </>
          ) : (
            <>
              搜索
              <CornerDownLeft className="opacity-60" />
            </>
          )}
        </Button>
      </form>

      {/* 检索模式：二选一，占用同一个分段控件 */}
      <Tabs
        value={deepSearch ? "deep" : "fast"}
        onValueChange={(v) => setDeepSearch(v === "deep")}
        className="mt-5"
      >
        <TabsList>
          <TabsTrigger value="deep">
            <Sparkles />
            深度 Agent
          </TabsTrigger>
          <TabsTrigger value="fast">
            <Zap />
            极速直答
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};
