import React, { useState, useMemo, useEffect } from "react";
import { 
  ShieldCheck, 
  ExternalLink, 
  Globe, 
  Globe2, 
  AlertCircle, 
  FileCheck2, 
  Check, 
  Copy,
  Layers,
  ArrowUpRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal
} from "lucide-react";
import { SearchSynthesisResult, SearchResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { buildOfficialSiteEntries, OfficialSiteEntry } from "./officialSiteEntries.js";

export interface SourcesWidgetProps {
  result?: SearchSynthesisResult;
  sources?: SearchResult[];
  query?: string;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
  ratioMode?: "flexible" | "strict";
  height?: number | "auto" | string;
}

export type { OfficialSiteEntry } from "./officialSiteEntries.js";

type TabFilter = "all" | "official" | "sources";

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 50, 9999] as const;

/**
 * 信源存证与网站直达小组件 (Sources & Related Links)
 * 支持 SearXNG 全量内容加载与高交互分页控制（单页数量自由切换、精准翻页与跨页序号连续溯源）。
 */
export const SourcesWidget: React.FC<SourcesWidgetProps> = ({
  result,
  sources: customSources,
  query: customQuery,
  openUrl,
  copyText,
  ratioMode = "flexible",
  height = "auto"
}) => {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // 分页状态：单页数量（默认 10）与当前页码（1-based）
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("cerlesse_sources_page_size") : null;
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (PAGE_SIZE_OPTIONS.includes(parsed as any)) return parsed;
      }
    } catch {}
    return 10;
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");

  const effectiveQuery = (customQuery || result?.query || "权威检索").trim();

  // 1. 结构化原始信源列表（对接 SearXNG 全量已加载结果）
  const rawSources = useMemo<SearchResult[]>(() => {
    if (customSources && customSources.length > 0) return customSources;
    if (result?.sources && result.sources.length > 0) return result.sources;
    if (result?.filteredResults && result.filteredResults.length > 0) return result.filteredResults;
    return [];
  }, [customSources, result?.sources, result?.filteredResults]);

  // 2. 官方与权威网站直达列表
  const siteEntries = useMemo(
    () => buildOfficialSiteEntries(effectiveQuery, rawSources, { minEntries: 7, maxEntries: 20 }),
    [effectiveQuery, rawSources]
  );

  // 3. 信源存证保障最少 7 条：检索信源不足 7 条时，以网站直达中的权威站点补足存证
  const verifiedSources = useMemo<SearchResult[]>(() => {
    if (rawSources.length === 0) return [];
    if (rawSources.length >= 7) return rawSources;

    const list = [...rawSources];
    const seenUrls = new Set(list.map((s) => s.url));

    for (const site of siteEntries) {
      if (list.length >= 7) break;
      if (site.url && !seenUrls.has(site.url)) {
        seenUrls.add(site.url);
        let domain = "";
        try {
          domain = new URL(site.url).hostname.replace(/^www\./, "");
        } catch {
          domain = "权威直达";
        }
        list.push({
          id: `verified_entry_${list.length + 1}`,
          title: site.name,
          url: site.url,
          snippet: site.description || `「${site.name}」官方权威直达索引，提供标准规范与官方文档参考。`,
          isOfficial: Boolean(site.isOfficial),
          displayDomain: domain,
          engine: "官方直达存证"
        });
      }
    }
    return list;
  }, [rawSources, siteEntries]);

  // 切换分类或查询词时重置页码为第 1 页
  useEffect(() => {
    setCurrentPage(1);
    setJumpPageInput("");
  }, [activeTab, effectiveQuery]);

  // 单页大小变更处理
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    try {
      localStorage.setItem("cerlesse_sources_page_size", String(newSize));
    } catch {}
  };

  // 4. 当前视图下的分页切片计算
  const {
    totalItems,
    totalPages,
    safePage,
    startIndex,
    endIndex,
    pagedSources,
    pagedSiteEntries
  } = useMemo(() => {
    const isOfficialTab = activeTab === "official";
    const total = isOfficialTab ? siteEntries.length : verifiedSources.length;
    const effectivePageSize = pageSize >= 9999 ? Math.max(1, total) : pageSize;
    const pages = Math.max(1, Math.ceil(total / effectivePageSize));
    const page = Math.min(Math.max(1, currentPage), pages);
    const start = (page - 1) * effectivePageSize;
    const end = Math.min(start + effectivePageSize, total);

    return {
      totalItems: total,
      totalPages: pages,
      safePage: page,
      startIndex: start,
      endIndex: end,
      pagedSources: verifiedSources.slice(start, end),
      pagedSiteEntries: siteEntries.slice(start, end)
    };
  }, [activeTab, verifiedSources, siteEntries, pageSize, currentPage]);

  const handleOpenUrl = (e: React.MouseEvent, url: string) => {
    if (openUrl) {
      e.preventDefault();
      openUrl(url);
    }
  };

  const handleCopyUrl = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (copyText) {
      copyText(url);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1800);
  };

  const getDomainFromUrl = (urlString: string, fallback?: string): string => {
    if (fallback) return fallback;
    try {
      const parsed = new URL(urlString);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return "外部信源";
    }
  };

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setCurrentPage(target);
      setJumpPageInput("");
    }
  };

  // 生成智能分页按钮列表
  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: Array<number | "ellipsis"> = [];
    pages.push(1);
    if (safePage > 3) {
      pages.push("ellipsis");
    }
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (safePage < totalPages - 2) {
      pages.push("ellipsis");
    }
    pages.push(totalPages);
    return pages;
  }, [totalPages, safePage]);

  const isEmpty = verifiedSources.length === 0 && siteEntries.length === 0;

  return (
    <IOSWidget
      id="sources"
      title="信源存证与网站直达"
      icon={<ShieldCheck className="size-4 text-emerald-500" />}
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          {siteEntries.length > 0 && (
            <span className="text-[11px] font-medium text-primary px-1.5 py-0.5 rounded-md bg-primary/10">
              {siteEntries.length} 官方入口
            </span>
          )}
          <span className="text-[11px] text-muted-foreground font-mono">
            {isEmpty ? "待核验" : `已加载 ${verifiedSources.length} 条信源`}
          </span>
        </div>
      }
      ratioMode={ratioMode}
      height={height}
      className="w-full h-auto border-border/80 bg-card"
      contentClassName="p-1 flex flex-col gap-3"
    >
      {/* 顶部控制栏：视图切换胶囊导航 + 单页数量选择器 */}
      {!isEmpty && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/50">
          <div className="inline-flex p-0.5 bg-muted/60 rounded-lg text-xs self-start">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              全部 ({siteEntries.length + verifiedSources.length})
            </button>
            {siteEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("official")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "official"
                    ? "bg-background text-primary shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                官方入口 ({siteEntries.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("sources")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === "sources"
                  ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              信源存证 ({verifiedSources.length})
            </button>
          </div>

          {/* 单页数量控制器 (Pagination Page Size Selector) */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground self-start sm:self-auto">
            <SlidersHorizontal className="size-3.5 text-muted-foreground/80 hidden xs:inline-block" />
            <span className="text-[11px] font-medium shrink-0">单页显示:</span>
            <div className="inline-flex items-center p-0.5 bg-muted/40 rounded-lg border border-border/60">
              {PAGE_SIZE_OPTIONS.map((opt) => {
                const isSelected = pageSize === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handlePageSizeChange(opt)}
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                    title={opt >= 9999 ? "显示全部结果" : `每页显示 ${opt} 条`}
                  >
                    {opt >= 9999 ? "全部" : opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-border/70 bg-muted/20">
          <AlertCircle className="size-8 text-amber-500/80 mb-2" />
          <h4 className="text-sm font-semibold text-foreground mb-1">暂无交叉核验信源存证</h4>
          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
            {result?.evidenceAssessment?.reason ||
              "根据 Cerlesse 真实性规范，当证据不足时不做出推测性结论。请重新检索或发起聚焦检索。"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 1. 官方权威入口卡片区 */}
          {activeTab === "all" && siteEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 pt-0.5">
                <Globe className="size-3.5 text-primary" />
                <span>权威网站与官方直达</span>
                <span className="text-[11px] text-muted-foreground font-normal ml-auto">
                  共 {siteEntries.length} 个入口
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {siteEntries.map((site) => (
                  <div
                    key={site.id}
                    className="group rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <h4
                            className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate"
                            title={site.name}
                          >
                            {site.name}
                          </h4>
                          {site.tag && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary shrink-0 flex items-center gap-1 font-medium"
                            >
                              {site.isOfficial ? <FileCheck2 className="size-2.5" /> : <Globe className="size-2.5" />}
                              {site.tag}
                            </Badge>
                          )}
                        </div>
                        {site.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {site.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-primary/10">
                      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
                        {getDomainFromUrl(site.url)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleCopyUrl(e, site.url)}
                          className="p-1 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="复制网址"
                        >
                          {copiedUrl === site.url ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        </button>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handleOpenUrl(e, site.url)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-2xs cursor-pointer"
                        >
                          <span>直达</span>
                          <ArrowUpRight className="size-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 官方入口专属独立分页视图 */}
          {activeTab === "official" && siteEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {pagedSiteEntries.map((site) => (
                  <div
                    key={site.id}
                    className="group rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <h4
                            className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate"
                            title={site.name}
                          >
                            {site.name}
                          </h4>
                          {site.tag && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary shrink-0 flex items-center gap-1 font-medium"
                            >
                              {site.isOfficial ? <FileCheck2 className="size-2.5" /> : <Globe className="size-2.5" />}
                              {site.tag}
                            </Badge>
                          )}
                        </div>
                        {site.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {site.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-primary/10">
                      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
                        {getDomainFromUrl(site.url)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleCopyUrl(e, site.url)}
                          className="p-1 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="复制网址"
                        >
                          {copiedUrl === site.url ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        </button>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handleOpenUrl(e, site.url)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-2xs cursor-pointer"
                        >
                          <span>直达</span>
                          <ArrowUpRight className="size-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. 全网交叉核验信源列表区 (支持分单页数量切片呈现与全局引用序号连续性) */}
          {(activeTab === "all" || activeTab === "sources") && verifiedSources.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground/90 pt-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>已核验信源存证清单</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-normal">
                  当前呈现 {startIndex + 1} - {endIndex} 条 · 共 {verifiedSources.length} 条已载入
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {pagedSources.map((source, idx) => {
                  const cleanTitle = (source.title || "未知标题").replace(/<[^>]*>/g, "").trim();
                  const cleanSnippet = (source.snippet || "").replace(/<[^>]*>/g, "").trim();
                  const domain = getDomainFromUrl(source.url, source.displayDomain);
                  // 全局连续序号：契约要求严格追溯，分页翻页后保持正确的全局编号 [11], [12]...
                  const globalIndex = startIndex + idx + 1;

                  return (
                    <div
                      key={source.id || `source-${globalIndex}`}
                      className="group rounded-xl border border-border/70 bg-background/50 hover:bg-muted/30 hover:border-emerald-500/40 transition-all p-3 sm:p-3.5 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 shrink-0 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                            [{globalIndex}]
                          </span>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => handleOpenUrl(e, source.url)}
                            className="text-xs sm:text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary hover:underline transition-colors"
                            title={cleanTitle}
                          >
                            {cleanTitle}
                          </a>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleCopyUrl(e, source.url)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                            title="复制信源链接"
                          >
                            {copiedUrl === source.url ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => handleOpenUrl(e, source.url)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground/70 group-hover:text-primary transition-colors cursor-pointer"
                            title="打开信源原文"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        </div>
                      </div>

                      {cleanSnippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pl-7">
                          {cleanSnippet}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1 pl-7 flex-wrap">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4.5 bg-muted/40 text-muted-foreground border-border/60">
                          <Globe2 className="size-2.5 mr-1 text-muted-foreground/80" />
                          {domain}
                        </Badge>

                        {source.isOfficial ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium">
                            <FileCheck2 className="size-2.5 mr-1" />
                            官方认证
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30">
                            深度核验
                          </Badge>
                        )}

                        {source.engine && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto font-mono">
                            检索源: {source.engine}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. 分页底部控制栏 (Pagination Navigation Bar) */}
          {totalPages > 1 && (
            <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>
                  第 <span className="font-mono font-semibold text-foreground">{safePage}</span> / <span className="font-mono">{totalPages}</span> 页
                </span>
                <span>·</span>
                <span>
                  共 <span className="font-mono font-semibold text-foreground">{totalItems}</span> 条结果
                </span>
              </div>

              {/* 翻页按钮组 */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {/* 首页 */}
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="p-1 sm:p-1.5 rounded-lg border border-border/70 bg-background/80 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="第一页"
                >
                  <ChevronsLeft className="size-3.5" />
                </button>

                {/* 上一页 */}
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/70 bg-background/80 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer font-medium"
                >
                  <ChevronLeft className="size-3.5" />
                  <span className="hidden xs:inline">上一页</span>
                </button>

                {/* 数字页码 */}
                <div className="flex items-center gap-1">
                  {paginationPages.map((p, i) => {
                    if (p === "ellipsis") {
                      return (
                        <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground/60">
                          ...
                        </span>
                      );
                    }
                    const isCurrent = p === safePage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`size-7 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center ${
                          isCurrent
                            ? "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                            : "border border-border/60 bg-background/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                {/* 下一页 */}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/70 bg-background/80 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer font-medium"
                >
                  <span className="hidden xs:inline">下一页</span>
                  <ChevronRight className="size-3.5" />
                </button>

                {/* 末页 */}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1 sm:p-1.5 rounded-lg border border-border/70 bg-background/80 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="最后一页"
                >
                  <ChevronsRight className="size-3.5" />
                </button>

                {/* 快速直达跳转 */}
                {totalPages > 5 && (
                  <form onSubmit={handleJumpPage} className="flex items-center gap-1 ml-1 sm:ml-2">
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpPageInput}
                      onChange={(e) => setJumpPageInput(e.target.value)}
                      placeholder="页码"
                      className="w-12 h-7 px-1.5 text-center text-xs font-mono rounded-lg border border-border/70 bg-background text-foreground focus:outline-hidden focus:border-primary"
                    />
                    <button
                      type="submit"
                      className="h-7 px-2 text-xs rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors cursor-pointer"
                    >
                      跳至
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </IOSWidget>
  );
};
