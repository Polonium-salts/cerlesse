import React, { useState } from "react";
import { SearchResult } from "../types.js";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { ExternalLink, ShieldCheck, Filter, Search, Globe, Calendar, Link } from "lucide-react";

interface SourcesFilterViewProps {
  results: SearchResult[];
  rawResultCount: number;
}

export const SourcesFilterView: React.FC<SourcesFilterViewProps> = ({
  results,
  rawResultCount
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<string>("all");

  const engines = Array.from(new Set(results.map(r => r.engine || "web"))).filter(Boolean);

  const filtered = results.filter(item => {
    const matchesSearch = searchTerm === "" || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.snippet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.url.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEngine = selectedEngine === "all" || (item.engine || "web") === selectedEngine;

    return matchesSearch && matchesEngine;
  });

  return (
    <div className="space-y-4">
      {/* Filtering Header Stats */}
      <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Agent 检索清洗与信源库
            </h4>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            SearXNG 原始并发获取 {rawResultCount} 条信息，Agent 语义去重过滤后保留 {results.length} 条高价值文献
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Engine filter */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-lg text-xs">
            <button
              onClick={() => setSelectedEngine("all")}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                selectedEngine === "all"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              全部 ({results.length})
            </button>
            {engines.map((eng) => (
              <button
                key={eng}
                onClick={() => setSelectedEngine(eng)}
                className={`px-2 py-1 rounded font-medium transition-colors ${
                  selectedEngine === eng
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {eng}
              </button>
            ))}
          </div>

          {/* Quick search input */}
          <div className="relative">
            <input
              type="text"
              placeholder="快速过滤信源..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-36 sm:w-44 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {filtered.map((item, idx) => {
          let host = "";
          try {
            host = new URL(item.url).hostname;
          } catch {
            host = item.url;
          }

          const scorePercent = item.score ? Math.round(item.score * 100) : 85;

          return (
            <Card
              key={item.id || idx}
              className="border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      信源 #{idx + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-medium uppercase">
                      {item.engine || "web"}
                    </Badge>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      相关度: {scorePercent}%
                    </span>
                    {item.publishedDate && (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                        <Calendar className="w-3 h-3" />
                        {item.publishedDate}
                      </span>
                    )}
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 line-clamp-1"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  </a>

                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                    {item.snippet}
                  </p>

                  {item.relevanceReason && (
                    <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 px-2.5 py-1 rounded border border-zinc-100 dark:border-zinc-800/80">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">甄选依据:</span>
                      <span>{item.relevanceReason}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {host}
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
                  >
                    访问原始网页
                  </a>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
