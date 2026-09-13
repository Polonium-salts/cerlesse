import React, { useMemo } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { SearchSynthesisResult, SearchResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";

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
}

/**
 * 官网跳转小组件
 * 严格按照要求只包含：网站名称、跳转按钮、简介
 * 全面采用圆角长方形 UI 设计，完整加载所有直达站点并支持动态高度自适应与平滑滚动
 */
export const RelatedLinksWidget: React.FC<RelatedLinksWidgetProps> = ({
  result,
  query: customQuery,
  openUrl
}) => {
  const effectiveQuery = (customQuery || result?.query || "官方检索").trim();

  // 整理并提取官网与核心直达网站列表
  const siteEntries = useMemo<OfficialSiteEntry[]>(() => {
    const list: OfficialSiteEntry[] = [];
    const seenUrls = new Set<string>();

    const rawResults: SearchResult[] = result?.filteredResults || [];

    // 1. 优先提取标记为官方认证的网站
    rawResults
      .filter((r) => r.isOfficial && r.url)
      .forEach((r, idx) => {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          list.push({
            id: `official_${idx}`,
            name: r.title || `${effectiveQuery} 官方网站`,
            url: r.url,
            description: r.snippet || `访问 ${r.title} 官方网站与权威门户。`
          });
        }
      });

    // 2. 如果官方网站数量较少，补充检索相关的高权重网页
    rawResults.forEach((r, idx) => {
      if (!r.url || seenUrls.has(r.url)) return;
      seenUrls.add(r.url);
      list.push({
        id: `site_${idx}`,
        name: r.title || effectiveQuery,
        url: r.url,
        description: r.snippet || "点击跳转按钮直接访问该目标官方页面与权威内容。"
      });
    });

    // 3. 若当前尚无搜索结果，生成默认直达入口
    if (list.length === 0) {
      const q = encodeURIComponent(effectiveQuery);
      list.push({
        id: "default_portal",
        name: `${effectiveQuery} 官方直达`,
        url: `https://www.google.com/search?q=${q}`,
        description: `探索并直达「${effectiveQuery}」相关的官方主站、权威门户与核心资料。`
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
          共 {siteEntries.length} 个直达站点
        </span>
      }
      className="w-full h-full border-border/80 bg-card"
      contentClassName="overflow-y-auto"
    >
      {/* 站点卡片列表：圆角长方形 UI，适配半宽比例，全部完整加载 */}
      <div className="grid grid-cols-1 gap-3 p-1">
        {siteEntries.map((site) => (
          <div
            key={site.id}
            className="group rounded-xl border border-border/80 bg-background/60 hover:bg-muted/30 hover:border-primary/40 transition-all p-3.5 sm:p-4 flex flex-col justify-between gap-2.5"
          >
            {/* 头部：网站名称 + 跳转按钮 */}
            <div className="flex items-start justify-between gap-3">
              {/* 网站名称 */}
              <h3
                className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2"
                title={site.name}
              >
                {site.name}
              </h3>

              {/* 跳转按钮：圆角长方形按钮 */}
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleJump(e, site.url)}
                className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
                title={`跳转到 ${site.name}`}
              >
                <span>跳转</span>
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
