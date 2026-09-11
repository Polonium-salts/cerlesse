import React from "react";
import { SearchResult } from "../types.js";
import { Globe, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";

interface GoogleOrganicResultsProps {
  results: SearchResult[];
  query: string;
}

export const GoogleOrganicResults: React.FC<GoogleOrganicResultsProps> = ({
  results,
  query
}) => {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          网页搜索结果与高权重信源 ({results.length})
        </h4>
        <span className="text-xs text-zinc-400">SearXNG 实时多源抓取</span>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {results.map((item, index) => {
          let hostname = "";
          let pathname = "";
          try {
            const urlObj = new URL(item.url);
            hostname = urlObj.hostname;
            pathname = urlObj.pathname.length > 1 ? urlObj.pathname.split("/").filter(Boolean).join(" › ") : "";
          } catch {
            hostname = item.url;
          }

          const scorePercent = item.score ? Math.round(item.score * 100) : 88;

          return (
            <div 
              key={item.id || index} 
              className={`group max-w-3xl ${
                item.isOfficial 
                  ? "p-3.5 sm:p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/15 border border-blue-200/80 dark:border-blue-900/60 shadow-xs" 
                  : ""
              }`}
            >
              {/* Google Breadcrumb URL Header */}
              <div className="flex items-center gap-2 mb-1 text-xs">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                  item.isOfficial
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                }`}>
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate">
                    {hostname}
                  </span>
                  {pathname && (
                    <span className="text-zinc-400 dark:text-zinc-500 truncate text-[11px]">
                      › {pathname}
                    </span>
                  )}
                </div>

                {item.isOfficial && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>官方网站</span>
                  </span>
                )}

                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {item.engine || "web"}
                </span>
              </div>

              {/* Google Title Link */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg sm:text-xl font-normal leading-snug">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a0dab] dark:text-[#8ab4f8] hover:underline visited:text-[#681da8] dark:visited:text-[#c58af9] inline-flex items-center gap-1.5 font-normal"
                  >
                    <span>{item.title}</span>
                  </a>
                </h3>
                {item.isOfficial && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2.5 py-1 rounded-lg bg-blue-100/70 dark:bg-blue-900/40 hover:bg-blue-200/70 transition-colors"
                  >
                    <span>直达官网</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Google Snippet Description */}
              <p className="text-sm text-[#4d5156] dark:text-[#bdc1c6] leading-normal mt-1">
                {item.snippet}
              </p>

              {/* Agent Verification Tag */}
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-zinc-400">
                <span className={`inline-flex items-center gap-1 font-medium ${
                  item.isOfficial
                    ? "text-blue-700 dark:text-blue-300 font-semibold"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  <span>{item.isOfficial ? "官方网站权威认证" : `置信度: ${scorePercent}%`}</span>
                </span>
                {item.relevanceReason && (
                  <>
                    <span>·</span>
                    <span className="text-zinc-500 dark:text-zinc-400 italic">
                      "{item.relevanceReason}"
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
