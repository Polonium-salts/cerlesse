import React, { useState } from "react";
import { QuoteDossierData, QuoteDossierItem } from "../../../types.js";
import { Quote, ExternalLink, ShieldCheck, Filter, UserCheck, AlertTriangle } from "lucide-react";

interface QuoteDossierViewProps {
  data: QuoteDossierData;
  themeColor?: string;
  onUpdateData?: (updated: QuoteDossierData) => void;
}

export const QuoteDossierView: React.FC<QuoteDossierViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData: _onUpdateData
}) => {
  const [stanceFilter, setStanceFilter] = useState<"all" | "support" | "caution" | "neutral">("all");

  const quotes = data.quotes || [];

  const filteredQuotes = quotes.filter(q => {
    if (stanceFilter === "all") return true;
    return q.stance === stanceFilter;
  });

  return (
    <div className="space-y-3.5">
      {/* Filter Tabs */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <span>立场透视:</span>
        </div>

        <div className="flex items-center gap-1">
          {(
            [
              { id: "all", label: `全部 (${quotes.length})` },
              { id: "support", label: `正向支持 (${quotes.filter(q => q.stance === "support").length})` },
              { id: "caution", label: `谨慎提醒 (${quotes.filter(q => q.stance === "caution").length})` }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setStanceFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                stanceFilter === tab.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                  : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quote Cards Stream */}
      <div className="space-y-3">
        {filteredQuotes.map((item: QuoteDossierItem) => (
          <div
            key={item.id}
            className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-2.5"
          >
            {/* Quote Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {item.speaker}
                </span>
                {item.titleOrRole && (
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    · {item.titleOrRole}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {item.authorityLevel === "verified" && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    权威认证
                  </span>
                )}
                {item.authorityLevel === "high" && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium flex items-center gap-0.5">
                    <UserCheck className="w-2.5 h-2.5" />
                    资深代表
                  </span>
                )}

                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  item.stance === "support"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : item.stance === "caution"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}>
                  {item.stance === "support" ? "正向肯定" : item.stance === "caution" ? "谨慎提示" : "客观中立"}
                </span>
              </div>
            </div>

            {/* Quote Text */}
            <div className="relative pl-6 py-1 italic text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
              <Quote className="w-4 h-4 text-zinc-300 dark:text-zinc-600 absolute left-0 top-1 shrink-0 fill-current" />
              <span>“{item.quote}”</span>
            </div>

            {/* Context & Source */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 flex-wrap gap-1">
              <span>出处背景: {item.organizationOrSource || "行业评测档案"}</span>

              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  <span>查验证据</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            {item.contextSnippet && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-50/70 dark:bg-zinc-850/50 p-2 rounded-lg leading-relaxed">
                背景透视: {item.contextSnippet}
              </p>
            )}
          </div>
        ))}

        {filteredQuotes.length === 0 && (
          <div className="text-center py-6 text-xs text-zinc-400">
            未检索到该立场下的言论档案
          </div>
        )}
      </div>
    </div>
  );
};
