import React, { useMemo } from "react";
import { ExternalLink, Globe, ShieldCheck } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { buildOfficialSiteEntries, OfficialSiteEntry } from "./officialSiteEntries.js";

export interface RelatedLinksWidgetProps {
  result?: SearchSynthesisResult;
  query?: string;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

export type { OfficialSiteEntry } from "./officialSiteEntries.js";

/**
 * Official navigation portal. Keeps a stable number of links while clearly distinguishing
 * result URLs from search links; unverified search links are never labeled as official.
 */
export const RelatedLinksWidget: React.FC<RelatedLinksWidgetProps> = ({
  result,
  query: customQuery,
  openUrl
}) => {
  const effectiveQuery = (customQuery || result?.query || "官方检索").trim();
  const siteEntries = useMemo(
    () => buildOfficialSiteEntries(effectiveQuery, result?.filteredResults || []),
    [result?.filteredResults, effectiveQuery]
  );

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
          {siteEntries.length} 个入口（官方身份以标记为准）
        </span>
      }
      className="w-full h-full border-border/80 bg-card"
      contentClassName="p-1 flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-2.5">
        {siteEntries.map((site) => (
          <div
            key={site.id}
            className="group rounded-xl border border-border/80 bg-background/60 hover:bg-muted/30 hover:border-primary/40 transition-all p-3.5 sm:p-4 flex flex-col justify-between gap-2"
          >
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
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleJump(e, site.url)}
                className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
                title={`跳转到 ${site.name}`}
              >
                <span>打开</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {site.description}
            </p>
          </div>
        ))}
      </div>
    </IOSWidget>
  );
};
