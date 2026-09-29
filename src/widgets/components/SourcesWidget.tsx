import React, { useState, useMemo } from "react";
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
  Sparkles
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

/**
 * 信源存证与网站直达小组件 (Sources & Related Links)
 * 合并信源交叉核验、权威引用存证与官方入口跳转，实现一站式溯源与直达。
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

  const effectiveQuery = (customQuery || result?.query || "权威检索").trim();

  // 1. 结构化已核验信源列表
  const verifiedSources = useMemo<SearchResult[]>(() => {
    if (customSources && customSources.length > 0) return customSources;
    if (result?.sources && result.sources.length > 0) return result.sources;
    if (result?.filteredResults && result.filteredResults.length > 0) return result.filteredResults;
    return [];
  }, [customSources, result?.sources, result?.filteredResults]);

  // 2. 官方与权威网站入口列表
  const siteEntries = useMemo(
    () => buildOfficialSiteEntries(effectiveQuery, verifiedSources),
    [effectiveQuery, verifiedSources]
  );

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

  const isEmpty = verifiedSources.length === 0 && siteEntries.length === 0;

  return (
    <IOSWidget
      id="sources"
      title="信源存证与网站直达"
      icon={<ShieldCheck className="size-4 text-emerald-500" />}
      badge={
        <div className="flex items-center gap-1.5">
          {siteEntries.length > 0 && (
            <span className="text-[11px] font-medium text-primary px-1.5 py-0.5 rounded-md bg-primary/10">
              {siteEntries.length} 官方入口
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            {isEmpty ? "待核验" : `${verifiedSources.length} 条存证信源`}
          </span>
        </div>
      }
      ratioMode={ratioMode}
      height={height}
      className="w-full h-auto border-border/80 bg-card"
      contentClassName="p-1 flex flex-col gap-3"
    >
      {/* 视图切换胶囊导航 */}
      {!isEmpty && (
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
          <div className="inline-flex p-0.5 bg-muted/60 rounded-lg text-xs">
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

          <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
            全网交叉核验 · 原文直达
          </span>
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
          {(activeTab === "all" || activeTab === "official") && siteEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              {activeTab === "all" && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 pt-0.5">
                  <Globe className="size-3.5 text-primary" />
                  <span>权威网站与官方直达</span>
                </div>
              )}
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

          {/* 2. 全网交叉核验信源列表区 */}
          {(activeTab === "all" || activeTab === "sources") && verifiedSources.length > 0 && (
            <div className="flex flex-col gap-2">
              {activeTab === "all" && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 pt-1">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>已核验信源存证清单</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2.5">
                {verifiedSources.map((source, index) => {
                  const cleanTitle = (source.title || "未知标题").replace(/<[^>]*>/g, "").trim();
                  const cleanSnippet = (source.snippet || "").replace(/<[^>]*>/g, "").trim();
                  const domain = getDomainFromUrl(source.url, source.displayDomain);

                  return (
                    <div
                      key={source.id || `source-${index}`}
                      className="group rounded-xl border border-border/70 bg-background/50 hover:bg-muted/30 hover:border-emerald-500/40 transition-all p-3 sm:p-3.5 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="inline-flex items-center justify-center size-5 shrink-0 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                            [{index + 1}]
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
                          <span className="text-[10px] text-muted-foreground/60 ml-auto">
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
        </div>
      )}
    </IOSWidget>
  );
};
