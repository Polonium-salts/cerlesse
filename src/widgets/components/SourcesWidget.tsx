import React, { useMemo } from "react";
import { ShieldCheck, ExternalLink, Globe2, AlertCircle, FileCheck2 } from "lucide-react";
import { SearchSynthesisResult, SearchResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";

export interface SourcesWidgetProps {
  result?: SearchSynthesisResult;
  sources?: SearchResult[];
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

export const SourcesWidget: React.FC<SourcesWidgetProps> = ({
  result,
  sources: customSources,
  openUrl
}) => {
  const verifiedSources = useMemo<SearchResult[]>(() => {
    if (customSources && customSources.length > 0) return customSources;
    if (result?.sources && result.sources.length > 0) return result.sources;
    if (result?.filteredResults && result.filteredResults.length > 0) return result.filteredResults;
    return [];
  }, [customSources, result?.sources, result?.filteredResults]);

  const handleOpenSource = (e: React.MouseEvent, url: string) => {
    if (openUrl) {
      e.preventDefault();
      openUrl(url);
    }
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

  const isEmpty = verifiedSources.length === 0;

  return (
    <IOSWidget
      id="sources"
      title="信源溯源存证"
      icon={<ShieldCheck className="size-4 text-emerald-500" />}
      badge={
        <span className="text-xs text-muted-foreground font-normal">
          {isEmpty ? "待交叉核验" : `${verifiedSources.length} 条已核验信源`}
        </span>
      }
      ratioMode="flexible"
      className="w-full h-full border-border/80 bg-card"
      contentClassName="p-1 flex flex-col gap-3"
    >
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
        <div className="grid grid-cols-1 gap-2.5">
          {verifiedSources.map((source, index) => {
            const cleanTitle = (source.title || "未知标题").replace(/<[^>]*>/g, "").trim();
            const cleanSnippet = (source.snippet || "").replace(/<[^>]*>/g, "").trim();
            const domain = getDomainFromUrl(source.url, source.displayDomain);

            return (
              <a
                key={source.id || `source-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleOpenSource(e, source.url)}
                className="group rounded-xl border border-border/70 bg-background/50 hover:bg-muted/30 hover:border-emerald-500/40 transition-all p-3 sm:p-3.5 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="inline-flex items-center justify-center size-5 shrink-0 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                      [{index + 1}]
                    </span>
                    <h4 className="text-xs sm:text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {cleanTitle}
                    </h4>
                  </div>
                  <ExternalLink className="size-3.5 text-muted-foreground/60 shrink-0 group-hover:text-primary transition-colors mt-0.5" />
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
                      信源索引: {source.engine}
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </IOSWidget>
  );
};
