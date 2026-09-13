import React, { useState, useEffect } from "react";
import {
  SearchSynthesisResult,
  UserSettings,
  CustomCardData
} from "../types.js";
import {
  FileText,
  GitFork,
  Scale,
  Library,
  HelpCircle,
  BrainCircuit,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  LayoutGrid
} from "lucide-react";
import { AIOverviewWidget } from "../widgets/components/AIOverviewWidget.js";
import { MindMapWidget } from "../widgets/components/MindMapWidget.js";
import { ComparisonMatrixWidget } from "../widgets/components/ComparisonMatrixWidget.js";
import { SourcesListWidget } from "../widgets/components/SourcesListWidget.js";
import { FollowUpWidget } from "../widgets/components/FollowUpWidget.js";
import { AgentProgressStream } from "./AgentProgressStream.js";
import { UniqueCardWidget } from "../widgets/components/UniqueCardWidget.js";
import { ActionPlanWidget } from "../widgets/components/ActionPlanWidget.js";
import { Button } from "./ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

interface CockpitWorkspaceProps {
  activeResult: SearchSynthesisResult;
  settings: UserSettings;
  onExecuteSearch: (query: string, deepSearch?: boolean) => void;
  onSwitchToBentoGrid?: () => void;
  initialTab?: "overview" | "mindmap" | "comparison" | "sources" | "followup" | "reasoning";
  isDark?: boolean;
  customCards?: CustomCardData[];
  onUpdateCard?: (updated: CustomCardData) => void;
  onDeleteCard?: (id: string) => void;
  onOpenForgeModal?: (sourceIds?: string[]) => void;
}

type CockpitTab = "overview" | "mindmap" | "comparison" | "sources" | "followup" | "reasoning";

export const CockpitWorkspace: React.FC<CockpitWorkspaceProps> = ({
  activeResult,
  settings,
  onExecuteSearch,
  onSwitchToBentoGrid,
  initialTab = "overview",
  isDark,
  customCards = [],
  onUpdateCard,
  onDeleteCard,
  onOpenForgeModal
}) => {
  const [activeTab, setActiveTab] = useState<CockpitTab>(initialTab);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const officialSite = activeResult.filteredResults.find((r) => r.isOfficial);
  const sources = activeResult.filteredResults;
  const keyTakeaways = activeResult.keyTakeaways || [];
  const followUps = activeResult.followUpQuestions || [];

  // Filter custom cards relevant to active search query (or pinned) and deduplicate by archetype
  const activeNormQuery = (activeResult?.query || "").trim().toLowerCase();
  const relevantCustomCards = customCards.filter((c) => {
    if (c.isPinned) return true;
    const cardQuery = (c.basedOnQuery || "").trim().toLowerCase();
    return cardQuery === activeNormQuery;
  });

  const seenArchetypes = new Set<string>();
  const displayCustomCards = relevantCustomCards.filter((c) => {
    if (seenArchetypes.has(c.archetype)) return false;
    seenArchetypes.add(c.archetype);
    return true;
  });

  // 数字键 1-6 快速切换模块。快捷键本身保留，但不再在界面上常驻 kbd 提示。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const order: CockpitTab[] = ["overview", "mindmap", "comparison", "sources", "followup", "reasoning"];
      const index = Number(e.key) - 1;
      if (index >= 0 && index < order.length) setActiveTab(order[index]);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCopySummary = () => {
    if (activeResult.summary) {
      navigator.clipboard.writeText(activeResult.summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const navTabs: Array<{
    id: CockpitTab;
    label: string;
    icon: React.ElementType;
    hasContent: boolean;
  }> = [
    { id: "overview", label: "AI 深度研报", icon: FileText, hasContent: Boolean(activeResult.summary) },
    { id: "mindmap", label: "知识架构导图", icon: GitFork, hasContent: Boolean(activeResult.mindMap) },
    { id: "comparison", label: "多维对比矩阵", icon: Scale, hasContent: Boolean(activeResult.comparisonTable?.length) },
    { id: "sources", label: "权威文献与信源库", icon: Library, hasContent: sources.length > 0 },
    { id: "followup", label: "延伸探索问答", icon: HelpCircle, hasContent: followUps.length > 0 },
    { id: "reasoning", label: "推理决策诊断", icon: BrainCircuit, hasContent: true }
  ];

  return (
    <div className="w-full flex flex-col gap-4 transition-all">
      {/* 一览区：三个信息块，只陈述内容，不带位置说明与计数徽标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* 高权重信源 */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-4 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Library className="size-4 text-muted-foreground" />
              高权重文献与信源库
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("sources")}
            >
              查看全部
              <ChevronRight />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sources.slice(0, 4).map((source, idx) => {
              let host = "";
              try {
                host = new URL(source.url).hostname.replace("www.", "");
              } catch {
                host = source.url;
              }

              return (
                <div
                  key={idx}
                  onClick={() => setActiveTab("sources")}
                  className="p-2.5 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer flex items-center gap-2.5 group/item"
                >
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {source.title}
                    </p>
                    <span className="text-xs text-muted-foreground truncate block">
                      {host}
                    </span>
                  </div>
                  {source.isOfficial && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      官方
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 官方认证门户 */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between gap-4">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ExternalLink className="size-4 text-muted-foreground" />
            官方认证门户
          </span>

          {officialSite ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {officialSite.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {officialSite.snippet || "经多源交叉检验确认为直属入口"}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={officialSite.url} target="_blank" rel="noopener noreferrer">
                  直达官方站点
                  <ExternalLink />
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                多方综合信源已加权验证，暂无单一官方入口。
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setActiveTab("sources")}
              >
                浏览全部参考信源
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        {/* 核心结论 */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Check className="size-4 text-muted-foreground" />
              核心结论速览
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopySummary}
              title="复制结论与摘要"
            >
              {copiedSummary ? <Check /> : <Copy />}
            </Button>
          </div>

          <div className="space-y-2">
            {keyTakeaways.slice(0, 2).map((item, idx) => (
              <p key={idx} className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {item}
              </p>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start -ml-2"
            onClick={() => setActiveTab("overview")}
          >
            在研报中定位全文
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* 主舞台：模块切换 + 内容 */}
      <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col flex-1 min-h-[580px]">
        {/* 模块切换 */}
        <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as CockpitTab)}
            className="min-w-0"
          >
            <TabsList className="overflow-x-auto no-scrollbar">
              {navTabs
                .filter((tab) => tab.hasContent)
                .map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id}>
                      <Icon />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
            </TabsList>
          </Tabs>

          {onSwitchToBentoGrid && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToBentoGrid}
              title="切换至横排多格自由网格布局"
            >
              <LayoutGrid />
              切为多格流
            </Button>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
          {activeTab === "overview" && (
            <div className="max-w-6xl mx-auto space-y-6">
              {(Boolean(activeResult.actionPlan?.tasks?.length) || displayCustomCards.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                  {activeResult.actionPlan && activeResult.actionPlan.tasks && activeResult.actionPlan.tasks.length > 0 && (
                    <div className={displayCustomCards.length === 0 ? "lg:col-span-2" : "col-span-1"}>
                      <ActionPlanWidget
                        actionPlan={activeResult.actionPlan}
                        query={activeResult.query}
                      />
                    </div>
                  )}

                  {displayCustomCards.map((card) => {
                    const isFull = displayCustomCards.length === 1 && !activeResult.actionPlan?.tasks?.length;
                    return (
                      <div key={card.id} className={isFull ? "lg:col-span-2" : "col-span-1"}>
                        <UniqueCardWidget
                          card={card}
                          onUpdateCard={onUpdateCard}
                          onDeleteCard={onDeleteCard}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="w-full">
                <AIOverviewWidget
                  summary={activeResult.summary}
                  query={activeResult.query}
                  modelUsed={activeResult.modelUsed}
                  filteredResults={activeResult.filteredResults}
                />
              </div>
            </div>
          )}

          {activeTab === "mindmap" && (
            <div className="w-full h-full min-h-[500px]">
              <MindMapWidget
                rootNode={activeResult.mindMap}
                query={activeResult.query}
                isDark={isDark}
              />
            </div>
          )}

          {activeTab === "comparison" && (
            <div className="w-full">
              <ComparisonMatrixWidget
                comparisonTable={activeResult.comparisonTable}
                query={activeResult.query}
              />
            </div>
          )}

          {activeTab === "sources" && (
            <div className="w-full">
              <SourcesListWidget
                results={activeResult.filteredResults}
                rawResultCount={activeResult.rawResultCount}
                onOpenForgeModal={() => onOpenForgeModal?.()}
              />
            </div>
          )}

          {activeTab === "followup" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <FollowUpWidget
                questions={activeResult.followUpQuestions}
                onQuestionClick={(q) => onExecuteSearch(q, settings.enableDeepSearch)}
              />

              <p className="text-xs text-muted-foreground">
                点击任意建议问题，Agent 将立即展开全新多源检索与交叉验证分析。
              </p>
            </div>
          )}

          {activeTab === "reasoning" && (
            <div className="max-w-4xl mx-auto">
              <AgentProgressStream
                steps={activeResult.steps}
                query={activeResult.query}
                isComplete={true}
                executionTimeMs={activeResult.executionTimeMs}
                agentTeam={activeResult.agentTeam}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
