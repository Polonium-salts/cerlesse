import React, { useState } from "react";
import { BookOpen, ExternalLink, ShieldCheck, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";

interface SourcesWidgetProps {
  activeResult?: SearchSynthesisResult;
  query?: string;
  isCompact?: boolean;
}

export const SourcesWidget: React.FC<SourcesWidgetProps> = ({
  activeResult,
  query = "",
  isCompact = false
}) => {
  const sources = activeResult?.filteredResults || [];
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="p-5 flex flex-col items-center justify-center text-center h-full min-h-[160px] text-muted-foreground">
        <BookOpen className="w-8 h-8 mb-2 opacity-40 text-teal-500" />
        <p className="text-sm font-medium">暂无可追溯的权威信源记录</p>
      </div>
    );
  }

  const displayedSources = expanded ? sources : sources.slice(0, 8);

  return (
    <div className="p-4 sm:p-5 flex flex-col h-full overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">权威信源存证</h3>
            <p className="text-xs text-muted-foreground">多引擎引文出处溯源与权威度审计</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-600 dark:text-teal-400">
          已审计 {sources.length} 条
        </Badge>
      </div>

      <div className="flex-1 overflow-auto space-y-2 pr-1 max-h-[520px]">
        {displayedSources.map((src, idx) => {
          let domain = "";
          try {
            domain = new URL(src.url).hostname;
          } catch {
            domain = src.url;
          }

          return (
            <div
              key={idx}
              className="p-2.5 rounded-xl border border-border/40 hover:border-teal-500/30 bg-muted/20 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    {domain}
                  </span>
                  {src.isOfficial && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      官方权威
                    </Badge>
                  )}
                  {src.publishedDate && (
                    <span className="text-[10px] text-muted-foreground/60">{src.publishedDate}</span>
                  )}
                </div>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-foreground hover:text-teal-600 dark:hover:text-teal-400 line-clamp-1 group-hover:underline transition-colors block"
                >
                  {src.title}
                </a>
                {src.snippet && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{src.snippet}</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleCopy(src.url)}
                  title="复制链接"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  {copiedUrl === src.url ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {sources.length > 8 && (
        <div className="pt-3 mt-2 border-t border-border/30 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 py-1 h-8"
          >
            {expanded ? (
              <>
                <span>收起部分信源</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>查看全部 {sources.length} 条已审计信源</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
