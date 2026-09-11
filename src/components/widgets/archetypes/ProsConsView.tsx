import React, { useState } from "react";
import { ProsConsData, ProsConsItem } from "../../../types.js";
import { ThumbsUp, ShieldAlert, CheckCircle2, AlertTriangle, ExternalLink, Lightbulb } from "lucide-react";

interface ProsConsViewProps {
  data: ProsConsData;
  themeColor?: string;
  onUpdateData?: (updated: ProsConsData) => void;
}

export const ProsConsView: React.FC<ProsConsViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData
}) => {
  const [upvotes, setUpvotes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    data.pros.forEach(p => {
      initial[p.id] = p.upvotes || 0;
    });
    return initial;
  });

  const [expandedMitigations, setExpandedMitigations] = useState<Record<string, boolean>>(() => {
    // Expand first con's mitigation by default
    const initial: Record<string, boolean> = {};
    if (data.cons.length > 0) {
      initial[data.cons[0].id] = true;
    }
    return initial;
  });

  const handleUpvote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCount = (upvotes[id] || 0) + 1;
    setUpvotes(prev => ({ ...prev, [id]: nextCount }));
    if (onUpdateData) {
      const nextPros = data.pros.map(p => p.id === id ? { ...p, upvotes: nextCount } : p);
      onUpdateData({ ...data, pros: nextPros });
    }
  };

  const toggleMitigation = (id: string) => {
    setExpandedMitigations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const proPercent = data.balanceRatio?.proPercent ?? 65;
  const conPercent = data.balanceRatio?.conPercent ?? 35;

  return (
    <div className="space-y-4">
      {/* Dynamic Balance Ratio Bar */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-800/80">
        <div className="flex items-center justify-between text-xs font-semibold mb-2">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>优势评级 ({proPercent}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>局限与避坑 ({conPercent}%)</span>
          </div>
        </div>
        
        {/* Visual Progress Ratio Bar */}
        <div className="w-full h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex overflow-hidden p-0.5">
          <div 
            className="h-full rounded-l-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-500" 
            style={{ width: `${proPercent}%` }} 
          />
          <div 
            className="h-full rounded-r-full bg-linear-to-r from-amber-400 to-rose-400 transition-all duration-500" 
            style={{ width: `${conPercent}%` }} 
          />
        </div>

        {data.tradeoffVerdict && (
          <div className="mt-2.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-800 flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed"><strong>权衡决策：</strong>{data.tradeoffVerdict}</span>
          </div>
        )}
      </div>

      {/* Two-Column Grid: Pros vs Cons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Pros Column */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              核心优势 ({data.pros.length})
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">多源正向验证</span>
          </div>

          <div className="space-y-2">
            {data.pros.map((pro: ProsConsItem) => (
              <div 
                key={pro.id}
                className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-950/60 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {pro.title}
                    </span>
                    {pro.category && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-medium">
                        {pro.category}
                      </span>
                    )}
                    {pro.impact === "high" && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                        核心收益
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleUpvote(pro.id, e)}
                    title="认可此优势"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors shrink-0"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{upvotes[pro.id] || 0}</span>
                  </button>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  {pro.description}
                </p>

                {pro.sourceUrl && (
                  <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center">
                    <a
                      href={pro.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-emerald-600 font-mono transition-colors"
                    >
                      <span>信源: {pro.sourceTitle || new URL(pro.sourceUrl).hostname}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cons Column */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              局限与避坑 ({data.cons.length})
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">附应对方案</span>
          </div>

          <div className="space-y-2">
            {data.cons.map((con: ProsConsItem) => {
              const isMitigationOpen = expandedMitigations[con.id];
              return (
                <div 
                  key={con.id}
                  className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-950/60 shadow-2xs hover:border-amber-300 dark:hover:border-amber-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {con.title}
                      </span>
                      {con.severity && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          con.severity === "critical"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {con.severity === "critical" ? "高风险" : "需留意"}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                    {con.description}
                  </p>

                  {/* Interactive Mitigation Drawer */}
                  {con.mitigation && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <button
                        onClick={() => toggleMitigation(con.id)}
                        className="w-full flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 py-0.5"
                      >
                        <span className="flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-amber-500" />
                          <span>推荐化解与应对方案</span>
                        </span>
                        <span className="text-[10px] underline">{isMitigationOpen ? "收起" : "展开"}</span>
                      </button>

                      {isMitigationOpen && (
                        <div className="mt-1.5 p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                          {con.mitigation}
                        </div>
                      )}
                    </div>
                  )}

                  {con.sourceUrl && (
                    <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center">
                      <a
                        href={con.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-amber-600 font-mono transition-colors"
                      >
                        <span>信源: {con.sourceTitle || new URL(con.sourceUrl).hostname}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
