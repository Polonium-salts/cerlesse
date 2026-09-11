import React, { useState } from "react";
import { VerdictSummaryData, VerdictCandidate, VerdictScenario } from "../../../types.js";
import { Award, Target, Sparkles, ExternalLink, ThumbsUp, AlertCircle, CheckCircle2 } from "lucide-react";

interface VerdictViewProps {
  data: VerdictSummaryData;
  themeColor?: string;
  onUpdateData?: (updated: VerdictSummaryData) => void;
}

export const VerdictView: React.FC<VerdictViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData: _onUpdateData
}) => {
  const scenarios = data.scenarios || [
    { id: "balanced", name: "综合均衡", description: "平衡效能与成本" },
    { id: "performance", name: "极致性能", description: "高并发极速吞吐" },
    { id: "budget", name: "轻量快速", description: "敏捷验证低门槛" }
  ];

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0]?.id || "balanced");

  const candidates = data.candidates || [];

  // Sort candidates dynamically based on the selected scenario score
  const sortedCandidates = [...candidates].sort((a, b) => {
    const scoreA = a.scenarioScores?.[selectedScenarioId] || 0;
    const scoreB = b.scenarioScores?.[selectedScenarioId] || 0;
    return scoreB - scoreA;
  });

  const activeScenario = scenarios.find(s => s.id === selectedScenarioId);

  return (
    <div className="space-y-4">
      {/* Scenario Switcher Toolbar */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-blue-500" />
            <span>决策场景模拟器</span>
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">
            点击切换场景查看动态评级
          </span>
        </div>

        {/* Scenario Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {scenarios.map((sc: VerdictScenario) => {
            const isSelected = selectedScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedScenarioId(sc.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white dark:bg-blue-500 shadow-sm"
                    : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100"
                }`}
              >
                <span>{sc.name}</span>
                {isSelected && <Sparkles className="w-3 h-3 text-amber-300" />}
              </button>
            );
          })}
        </div>

        {activeScenario && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-1 italic">
            当前场景聚焦：{activeScenario.description}
          </p>
        )}
      </div>

      {/* Dynamic Ranking Candidates */}
      <div className="space-y-3">
        {sortedCandidates.map((cand: VerdictCandidate, rankIdx: number) => {
          const score = cand.scenarioScores?.[selectedScenarioId] ?? 80;
          const isWinner = rankIdx === 0;

          return (
            <div
              key={cand.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                isWinner
                  ? "bg-white dark:bg-zinc-900 border-blue-400 dark:border-blue-600 shadow-md ring-1 ring-blue-400/20"
                  : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-2xs"
              }`}
            >
              {/* Header with Rank, Name, Verdict Badge, Score */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isWinner
                      ? "bg-amber-400 text-amber-950 shadow-xs"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}>
                    {rankIdx + 1}
                  </span>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {cand.name}
                      </h4>
                      {isWinner && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-0.5">
                          <Award className="w-2.5 h-2.5" />
                          本场景首选
                        </span>
                      )}
                    </div>
                    {cand.bestFor && (
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        适合：{cand.bestFor}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score & Verdict */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      匹配度 {score}%
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                    cand.verdict === "强烈推荐"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : cand.verdict === "次选备选"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {cand.verdict}
                  </span>
                </div>
              </div>

              {/* Dynamic Score Bar */}
              <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 my-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isWinner
                      ? "bg-linear-to-r from-blue-500 to-emerald-500"
                      : "bg-zinc-400 dark:bg-zinc-600"
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>

              {/* Pros & Cons pills */}
              <div className="space-y-1.5 mt-2 text-xs">
                {cand.keyPros && cand.keyPros.length > 0 && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 shrink-0">
                      <ThumbsUp className="w-2.5 h-2.5" /> 核心长板:
                    </span>
                    {cand.keyPros.map((pro, pIdx) => (
                      <span key={pIdx} className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {pro}
                      </span>
                    ))}
                  </div>
                )}

                {cand.keyCons && cand.keyCons.length > 0 && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5 shrink-0">
                      <AlertCircle className="w-2.5 h-2.5" /> 注意短板:
                    </span>
                    {cand.keyCons.map((con, cIdx) => (
                      <span key={cIdx} className="text-[11px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        {con}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {cand.sourceUrl && (
                <div className="mt-2.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center">
                  <a
                    href={cand.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-600 font-mono transition-colors"
                  >
                    <span>参考信源: {cand.sourceTitle || new URL(cand.sourceUrl).hostname}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.finalAdvice && (
        <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/50 flex items-start gap-2 text-xs text-blue-950 dark:text-blue-200">
          <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-blue-900 dark:text-blue-100">专家总评结论：</strong>
            {data.finalAdvice}
          </div>
        </div>
      )}
    </div>
  );
};
