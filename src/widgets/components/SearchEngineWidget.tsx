import React, { useState, useMemo, useEffect } from "react";
import { Search, ExternalLink, ArrowRight, Sparkles, Check, Globe } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";

export interface SearchEngineWidgetProps {
  result?: SearchSynthesisResult;
  query?: string;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

interface SearchEngineConfig {
  id: string;
  name: string;
  brandLabel: string;
  promotedText: string;
  accentColor: string;
  getSearchUrl: (keyword: string) => string;
}

const SEARCH_ENGINES: SearchEngineConfig[] = [
  {
    id: "bing",
    name: "Bing",
    brandLabel: "微软必应",
    promotedText: "Promoted by Microsoft",
    accentColor: "#0078d4",
    getSearchUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`
  },
  {
    id: "google",
    name: "Google",
    brandLabel: "谷歌搜索",
    promotedText: "Google Search",
    accentColor: "#4285f4",
    getSearchUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
  },
  {
    id: "baidu",
    name: "百度",
    brandLabel: "百度搜索",
    promotedText: "百度一下，你就知道",
    accentColor: "#2932e1",
    getSearchUrl: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
  },
  {
    id: "sogou",
    name: "搜狗",
    brandLabel: "搜狗搜索",
    promotedText: "搜狗搜索，结果更准",
    accentColor: "#fb6022",
    getSearchUrl: (q) => `https://www.sogou.com/web?query=${encodeURIComponent(q)}`
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    brandLabel: "隐私搜索",
    promotedText: "Privacy, simplified.",
    accentColor: "#de5833",
    getSearchUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
  }
];

export const SearchEngineWidget: React.FC<SearchEngineWidgetProps> = ({
  result,
  query: customQuery,
  openUrl
}) => {
  const rawQuery = (customQuery || result?.query || "").trim();

  // 从查询中分析匹配的搜索引擎与核心搜索词
  const { detectedEngineId, extractedKeyword } = useMemo(() => {
    const qLower = rawQuery.toLowerCase();
    let engId = "bing"; // 默认必应（契合 Promoted by Microsoft 视觉设计）
    if (/google|谷歌/i.test(qLower)) {
      engId = "google";
    } else if (/baidu|百度/i.test(qLower)) {
      engId = "baidu";
    } else if (/sogou|搜狗/i.test(qLower)) {
      engId = "sogou";
    } else if (/duckduckgo/i.test(qLower)) {
      engId = "duckduckgo";
    }

    // 清理查询中的引擎名称词缀，保留用户真正想检索的内容
    const cleaned = rawQuery
      .replace(/^(google|bing|baidu|sogou|duckduckgo|谷歌|必应|百度|搜狗)\s*/i, "")
      .replace(/\s*(google|bing|baidu|sogou|duckduckgo|谷歌|必应|百度|搜狗)$/i, "")
      .replace(/(搜索引擎|搜索)$/i, "")
      .trim();

    return {
      detectedEngineId: engId,
      extractedKeyword: cleaned || (rawQuery && !/^(google|bing|baidu|sogou|duckduckgo|谷歌|必应|百度|搜狗)$/i.test(rawQuery) ? rawQuery : "")
    };
  }, [rawQuery]);

  const [selectedEngineId, setSelectedEngineId] = useState<string>(detectedEngineId);
  const [searchInput, setSearchInput] = useState<string>(extractedKeyword);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [lastRedirectEngine, setLastRedirectEngine] = useState<string>("");

  // 当外部查询变化时同步
  useEffect(() => {
    setSelectedEngineId(detectedEngineId);
    if (extractedKeyword) {
      setSearchInput(extractedKeyword);
    }
  }, [detectedEngineId, extractedKeyword]);

  const currentEngine = useMemo(() => {
    return SEARCH_ENGINES.find((e) => e.id === selectedEngineId) || SEARCH_ENGINES[0];
  }, [selectedEngineId]);

  // 执行跳转搜索
  const handlePerformSearch = (engineConfig = currentEngine, overrideKeyword?: string) => {
    const term = (overrideKeyword ?? searchInput).trim();
    if (!term) return;

    const targetUrl = engineConfig.getSearchUrl(term);
    setIsRedirecting(true);
    setLastRedirectEngine(engineConfig.name);

    if (openUrl) {
      openUrl(targetUrl);
    } else {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }

    setTimeout(() => {
      setIsRedirecting(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePerformSearch();
    }
  };

  // 推荐搜索词标签（来自信源标题或预设）
  const suggestions = useMemo(() => {
    const list: string[] = [];
    if (searchInput) {
      list.push(searchInput);
    }
    if (result?.filteredResults && result.filteredResults.length > 0) {
      result.filteredResults.slice(0, 3).forEach((r) => {
        if (r.title && r.title.length <= 15 && !list.includes(r.title)) {
          list.push(r.title);
        }
      });
    }
    if (list.length === 0) {
      list.push("最新资讯", "官网直达", "深度研究");
    }
    return list.slice(0, 4);
  }, [result?.filteredResults, searchInput]);

  return (
    <IOSWidget
      title="搜索引擎直达"
      icon={<Search className="size-4 text-primary" />}
      badge={
        <span className="text-xs text-muted-foreground font-normal">
          已就绪 · {currentEngine.name}
        </span>
      }
      className="w-full h-full border-border/80 bg-card"
      noPadding={true}
      contentClassName="p-3.5 sm:p-4 flex flex-col justify-between gap-2.5"
    >
      <div className="flex flex-col gap-2">
        {/* 顶部赞助与归属标识（如截图中的 Promoted by Microsoft） */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-normal text-muted-foreground tracking-tight select-none">
            {currentEngine.promotedText}
          </span>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: currentEngine.accentColor }}
            />
            <span className="text-[11px] font-medium text-muted-foreground">
              {currentEngine.brandLabel}
            </span>
          </div>
        </div>

        {/* 核心药丸形输入框 UI（还原图片设计样式） */}
        <div className="relative w-full group">
          <div className="w-full rounded-full bg-background dark:bg-zinc-800/90 border border-border/90 hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-xs hover:shadow-sm transition-all flex items-center px-4 py-2 sm:px-4.5 sm:py-2 gap-2.5">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`在 ${currentEngine.name} 中搜索...`}
              className="flex-1 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden"
            />

            {/* 搜索放大镜按钮 */}
            <button
              type="button"
              onClick={() => handlePerformSearch()}
              className="p-1.5 sm:p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all cursor-pointer shrink-0"
              title={`在 ${currentEngine.name} 中搜索并直接跳转`}
              aria-label="搜索并跳转"
            >
              <Search className="size-4 sm:size-4.5" />
            </button>
          </div>
        </div>

        {/* 搜索引擎快速切换标签栏 */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[11px] text-muted-foreground shrink-0 mr-1 select-none">
            引擎:
          </span>
          {SEARCH_ENGINES.map((engine) => {
            const isActive = engine.id === selectedEngineId;
            return (
              <button
                key={engine.id}
                type="button"
                onClick={() => setSelectedEngineId(engine.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isActive && <Check className="size-3" />}
                <span>{engine.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 底部跳转提示与直达按钮 */}
      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isRedirecting ? (
            <span className="text-primary font-medium flex items-center gap-1 animate-pulse">
              <Sparkles className="size-3.5" />
              正在跳转至 {lastRedirectEngine} 检索结果页...
            </span>
          ) : (
            <span className="truncate max-w-[200px] sm:max-w-xs">
              输入内容后点击放大镜或回车直接跳转
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handlePerformSearch()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0"
        >
          <span>立即前往 {currentEngine.name}</span>
          <ArrowRight className="size-3" />
        </button>
      </div>
    </IOSWidget>
  );
};
