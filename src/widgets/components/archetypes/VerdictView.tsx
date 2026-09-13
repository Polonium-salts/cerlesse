import React, { useState } from "react";
import { VerdictSummaryData, VerdictCandidate, VerdictScenario } from "../../../types.js";
import { AlertCircle, Award, CheckCircle2, ExternalLink, Sparkles, Target, ThumbsUp } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { cn } from "../../../lib/utils.js";

interface VerdictViewProps {
  data: VerdictSummaryData;
  themeColor?: string;
  onUpdateData?: (updated: VerdictSummaryData) => void;
}

/**
 * 结论裁决视图 (verdict_summary)
 *
 * shadcn/ui 重做要点：
 *   · 场景切换器由「蓝底药丸 + 琥珀色 Sparkles」改为 Button 三态：
 *     选中 = default、未选中 = outline，选中标记用同色 Sparkles 而非撞色点缀；
 *   · 名次徽标由圆形改为 rounded-[4px] 方角，冠军位用 bg-primary 反色；
 *   · 评分条去掉「蓝→绿渐变」，冠军走 bg-primary、其余走 bg-foreground/25，
 *     层级由明度而非色相承担；匹配度数值统一 font-mono + tabular-nums；
 *   · 长板 / 短板标签由绿、琥珀两套底色统一为 outline 徽章，
 *     语义交由「核心长板 / 注意短板」文案与 ThumbsUp / AlertCircle 图标承担；
 *   · 总评由蓝底提示块改为 muted 底信息块。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
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

  /** 推荐档位：实心 > 半实心 > 描边，对应强烈推荐 / 次选备选 / 其他 */
  const verdictVariant = (verdict?: string) =>
    verdict === "强烈推荐" ? "default" : verdict === "次选备选" ? "secondary" : "outline";

  return (
    <div className="flex flex-col gap-4">
      {/* 决策场景模拟器 */}
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Target className="size-3.5 text-muted-foreground" />
            决策场景模拟器
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            点击切换场景查看动态评级
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {scenarios.map((sc: VerdictScenario) => {
            const isSelected = selectedScenarioId === sc.id;
            return (
              <Button
                key={sc.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScenarioId(sc.id)}
                className="shrink-0 gap-1.5 whitespace-nowrap"
              >
                <span>{sc.name}</span>
                {isSelected && <Sparkles />}
              </Button>
            );
          })}
        </div>

        {activeScenario && (
          <p className="text-xs italic text-muted-foreground">
            当前场景聚焦：{activeScenario.description}
          </p>
        )}
      </div>

      {/* 动态排名 */}
      <div className="flex flex-col gap-3">
        {sortedCandidates.map((cand: VerdictCandidate, rankIdx: number) => {
          const score = cand.scenarioScores?.[selectedScenarioId] ?? 80;
          const isWinner = rankIdx === 0;

          return (
            <div
              key={cand.id}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-3 transition-colors",
                isWinner ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-[4px] font-mono text-xs font-semibold tabular-nums",
                      isWinner
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {rankIdx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="text-sm font-medium text-foreground">{cand.name}</h4>
                      {isWinner && (
                        <Badge variant="secondary">
                          <Award />
                          本场景首选
                        </Badge>
                      )}
                    </div>
                    {cand.bestFor && (
                      <span className="text-xs text-muted-foreground">适合：{cand.bestFor}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                    匹配度 {score}%
                  </span>
                  <Badge variant={verdictVariant(cand.verdict)}>{cand.verdict}</Badge>
                </div>
              </div>

              {/* 评分条：冠军实心、其余弱化 */}
              <div className="my-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isWinner ? "bg-primary" : "bg-foreground/25"
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>

              {/* 长板 / 短板 */}
              <div className="flex flex-col gap-1.5 text-xs">
                {cand.keyPros && cand.keyPros.length > 0 && (
                  <div className="flex flex-wrap items-start gap-1.5">
                    <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
                      <ThumbsUp className="size-3" /> 核心长板
                    </span>
                    {cand.keyPros.map((pro, pIdx) => (
                      <Badge key={pIdx} variant="outline" className="font-normal">
                        {pro}
                      </Badge>
                    ))}
                  </div>
                )}

                {cand.keyCons && cand.keyCons.length > 0 && (
                  <div className="flex flex-wrap items-start gap-1.5">
                    <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
                      <AlertCircle className="size-3" /> 注意短板
                    </span>
                    {cand.keyCons.map((con, cIdx) => (
                      <Badge key={cIdx} variant="outline" className="font-normal">
                        {con}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {cand.sourceUrl && (
                <a
                  href={cand.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex w-fit items-center gap-1 border-t border-border pt-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  <span>参考信源: {cand.sourceTitle || new URL(cand.sourceUrl).hostname}</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {data.finalAdvice && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong className="font-medium text-foreground">专家总评结论：</strong>
            {data.finalAdvice}
          </div>
        </div>
      )}
    </div>
  );
};
