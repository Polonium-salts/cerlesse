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

const QUICK_TASKS = [
  { label: "🛠️ 在线 PDF 转换免安装工具", query: "pdf 转 word 在线免安装工具" },
  { label: "💻 Docker 安装教程与国内镜像", query: "docker 安装教程与国内镜像源配置" },
  { label: "✈️ 成都三日游精选路线与避坑", query: "成都三日游路线攻略与避坑指南" },
  { label: "⚠️ npm install 报错 EACCES 解决", query: "npm install 报错 EACCES 权限问题解决办法" },
  { label: "⚖️ DeepSeek R1 对比 Claude 3.5", query: "DeepSeek R1 vs Claude 3.5 Sonnet 模型对比" }
];

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
        className="w-full flex items-center h-10 px-3 rounded-md border border-border bg-muted/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/30 transition-all"
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
          >
            <X />
          </Button>
        )}

        <Button
          type="submit"
          size="icon-sm"
          disabled={!query.trim() || isLoading}
          title="执行搜索"
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
        className="w-full rounded-xl border border-border bg-card shadow-sm p-2 flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-ring/30"
      >
        <Search className="size-5 text-muted-foreground shrink-0 ml-2" />

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
          >
            <X />
          </Button>
        )}

        <Button type="submit" size="lg" disabled={!query.trim() || isLoading}>
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
            深度 Agent（导图+对比）
          </TabsTrigger>
          <TabsTrigger value="fast">
            <Zap />
            极速直答
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 快速体验：把一句话需求直接送进检索 */}
      <div className="mt-8 w-full flex flex-col items-center gap-3">
        <p className="text-xs text-muted-foreground">快速体验智能自适应任务布局</p>
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
          {QUICK_TASKS.map((item) => (
            <Button
              key={item.query}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery(item.query);
                onSearch(item.query, deepSearch);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
