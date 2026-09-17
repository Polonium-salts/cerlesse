import React, { useMemo } from "react";
import { ExternalLink, Globe, ShieldCheck } from "lucide-react";
import { SearchSynthesisResult, SearchResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";

export interface RelatedLinksWidgetProps {
  result?: SearchSynthesisResult;
  query?: string;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

export interface OfficialSiteEntry {
  id: string;
  name: string;
  url: string;
  description: string;
  tag?: string;
  isOfficial?: boolean;
}

/**
 * 官网跳转小组件 (Official Navigation Portal)
 * 严格定位：官方入口 / 权威主站 / 开发文档 / 开源门户直达导航
 * 绝不退化为普通搜索结果列表，所有信源引用与存证由 SourcesWidget 独立承载
 */
export const RelatedLinksWidget: React.FC<RelatedLinksWidgetProps> = ({
  result,
  query: customQuery,
  openUrl
}) => {
  const effectiveQuery = (customQuery || result?.query || "官方检索").trim();

  // 严格提取并甄别官方与核心权威直达入口（最多 3~4 个高权威条目）
  const siteEntries = useMemo<OfficialSiteEntry[]>(() => {
    const list: OfficialSiteEntry[] = [];
    const seenUrls = new Set<string>();
    const rawResults: SearchResult[] = result?.filteredResults || [];

    // 辅助函数：判断是否为文档、开源仓库或根主站
    const categorizeLink = (title: string, url: string, isOfficial?: boolean) => {
      const lowerUrl = url.toLowerCase();
      const lowerTitle = title.toLowerCase();
      if (lowerUrl.includes("github.com") || lowerUrl.includes("gitee.com") || lowerUrl.includes("gitlab.com")) {
        return "开源主页";
      }
      if (lowerUrl.includes("docs.") || lowerUrl.includes("/docs") || lowerTitle.includes("文档") || lowerTitle.includes("documentation")) {
        return "官方文档";
      }
      if (lowerUrl.includes("developer.") || lowerUrl.includes("dev.")) {
        return "开发者中心";
      }
      if (lowerUrl.includes("npmjs.com") || lowerUrl.includes("pypi.org") || lowerUrl.includes("hub.docker.com")) {
        return "包管理器发布页";
      }
      if (isOfficial) {
        return "官方主站";
      }
      return "权威入口";
    };

    // 1. 严格优先提取标记为官方认证的网站
    rawResults
      .filter((r) => r.isOfficial && r.url)
      .forEach((r, idx) => {
        if (!seenUrls.has(r.url) && list.length < 4) {
          seenUrls.add(r.url);
          list.push({
            id: `official_${idx}`,
            name: r.title || `${effectiveQuery} 官方网站`,
            url: r.url,
            description: r.snippet || `访问 ${r.title} 官方网站与权威门户。`,
            tag: categorizeLink(r.title || "", r.url, true),
            isOfficial: true
          });
        }
      });

    // 2. 如果官方结果不足，仅筛选具备权威主站/文档/开源特征的高置信直达入口（最多补足至 3 个）
    if (list.length < 3) {
      const authorityCandidates = rawResults.filter((r) => {
        if (!r.url || seenUrls.has(r.url)) return false;
        try {
          const parsed = new URL(r.url);
          const path = parsed.pathname.toLowerCase();
          const host = parsed.hostname.toLowerCase();
          // 仅纳入主域名、docs子域、开发者域或知名根平台
          const isDocOrRoot =
            path === "" ||
            path === "/" ||
            host.startsWith("docs.") ||
            host.startsWith("dev.") ||
            host.includes("github.com") ||
            host.includes("wikipedia.org") ||
            host.includes("developer.mozilla.org");
          return isDocOrRoot;
        } catch {
          return false;
        }
      });

      for (const r of authorityCandidates) {
        if (list.length >= 3) break;
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          list.push({
            id: `site_${list.length}`,
            name: r.title || effectiveQuery,
            url: r.url,
            description: r.snippet || "点击跳转直达该目标核心入口与权威页面。",
            tag: categorizeLink(r.title || "", r.url, false),
            isOfficial: false
          });
        }
      }
    }

    // 3. 若当前尚无搜索结果或未提取到明确入口，生成极简官方检索直达
    if (list.length === 0) {
      const q = encodeURIComponent(effectiveQuery);
      list.push({
        id: "default_portal",
        name: `${effectiveQuery} 官方直达`,
        url: `https://www.google.com/search?q=${q}`,
        description: `探索并直达「${effectiveQuery}」相关的官方主站、权威门户与核心资料。`,
        tag: "搜索直达",
        isOfficial: true
      });
    }

    return list;
  }, [result?.filteredResults, effectiveQuery]);

  const handleJump = (e: React.MouseEvent, url: string) => {
    if (openUrl) {
      e.preventDefault();
      openUrl(url);
    }
  };

  return (
    <IOSWidget
      title="官网跳转"
      icon={<Globe className="size-4 text-primary" />}
      badge={
        <span className="text-xs text-muted-foreground font-normal">
          已锁定 {siteEntries.length} 个核心入口
        </span>
      }
      className="w-full h-full border-border/80 bg-card"
      contentClassName="p-1 flex flex-col gap-3"
    >
      {/* 站点卡片列表：圆角长方形 UI，精炼权威入口 */}
      <div className="grid grid-cols-1 gap-2.5">
        {siteEntries.map((site) => (
          <div
            key={site.id}
            className="group rounded-xl border border-border/80 bg-background/60 hover:bg-muted/30 hover:border-primary/40 transition-all p-3.5 sm:p-4 flex flex-col justify-between gap-2"
          >
            {/* 头部：网站名称 + 标签 + 跳转按钮 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3
                    className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug truncate"
                    title={site.name}
                  >
                    {site.name}
                  </h3>
                  {site.tag && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary shrink-0 flex items-center gap-1"
                    >
                      {site.isOfficial ? <ShieldCheck className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                      {site.tag}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 跳转按钮：圆角长方形按钮 */}
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleJump(e, site.url)}
                className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
                title={`跳转到 ${site.name}`}
              >
                <span>直达</span>
                <ExternalLink className="size-3" />
              </a>
            </div>

            {/* 简介 */}
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {site.description}
            </p>
          </div>
        ))}
      </div>
    </IOSWidget>
  );
};
