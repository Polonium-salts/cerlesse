import React, { useState, useEffect } from "react";
import {
  SearchSynthesisResult,
  ResultWidgetKey,
  DetectedLanguage,
  UserSettings
} from "../types.js";
import {
  FileText,
  GitFork,
  Scale,
  Library,
  HelpCircle,
  BrainCircuit,
  ShieldCheck,
  ListChecks,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Globe,
  Maximize2,
  Copy,
  Check,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Search,
  Zap,
  LayoutGrid,
  Compass
} from "lucide-react";
import { AIOverviewWidget } from "./AIOverviewWidget.js";
import { MindMapWidget } from "./MindMapWidget.js";
import { ComparisonMatrixWidget } from "./ComparisonMatrixWidget.js";
import { SourcesListWidget } from "./SourcesListWidget.js";
import { FollowUpWidget } from "./FollowUpWidget.js";
import { AgentProgressStream } from "./AgentProgressStream.js";
import { UniqueCardWidget } from "./widgets/UniqueCardWidget.js";
import { ActionPlanWidget } from "./widgets/ActionPlanWidget.js";
import { CustomCardData } from "../types.js";

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
  const [selectedSourcePreview, setSelectedSourcePreview] = useState<number | null>(null);

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

  // Enable keyboard shortcuts (1-6) for rapid zero-scroll navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case "1":
          setActiveTab("overview");
          break;
        case "2":
          setActiveTab("mindmap");
          break;
        case "3":
          setActiveTab("comparison");
          break;
        case "4":
          setActiveTab("sources");
          break;
        case "5":
          setActiveTab("followup");
          break;
        case "6":
          setActiveTab("reasoning");
          break;
        default:
          break;
      }
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
    shortcut: string;
    countBadge?: number | string;
    hasContent: boolean;
  }> = [
    {
      id: "overview",
      label: "AI 深度研报",
      icon: FileText,
      shortcut: "1",
      hasContent: Boolean(activeResult.summary)
    },
    {
      id: "mindmap",
      label: "知识架构导图",
      icon: GitFork,
      shortcut: "2",
      countBadge: activeResult.mindMap?.children?.length || undefined,
      hasContent: Boolean(activeResult.mindMap)
    },
    {
      id: "comparison",
      label: "多维对比矩阵",
      icon: Scale,
      shortcut: "3",
      countBadge: activeResult.comparisonTable?.length || undefined,
      hasContent: Boolean(activeResult.comparisonTable?.length)
    },
    {
      id: "sources",
      label: "权威文献与信源库",
      icon: Library,
      shortcut: "4",
      countBadge: sources.length,
      hasContent: sources.length > 0
    },
    {
      id: "followup",
      label: "延伸探索问答",
      icon: HelpCircle,
      shortcut: "5",
      countBadge: followUps.length,
      hasContent: followUps.length > 0
    },
    {
      id: "reasoning",
      label: "推理决策诊断",
      icon: BrainCircuit,
      shortcut: "6",
      countBadge: `${((activeResult.executionTimeMs || 0) / 1000).toFixed(1)}s`,
      hasContent: true
    }
  ];

  return (
    <div className="w-full flex flex-col gap-4 transition-all">
      {/* 1. TOP ROW: 4 HORIZONTAL CELLS FIXED OVERVIEW BAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
        {/* Cell 1 & 2 (Left 50% width - 2 Grid Cells): High-Authority Sources Preview & Quick Jump */}
        <div className="md:col-span-2 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200/90 dark:border-zinc-800/90 p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Library className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    高权重文献与信源库
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                    已核验 {sources.length} 条
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  占据前两格 · 点击信源即时预览或深挖
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("sources")}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
            >
              <span>查看全部</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Click Source Chips */}
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
                  onClick={() => {
                    setSelectedSourcePreview(idx);
                    setActiveTab("sources");
                  }}
                  className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 hover:border-blue-300 dark:hover:border-blue-600/70 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex items-center gap-2 group/item"
                >
                  <span className="w-4 h-4 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400">
                      {source.title}
                    </p>
                    <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 truncate block">
                      {host}
                    </span>
                  </div>
                  {source.isOfficial && (
                    <span className="shrink-0 text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      官
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cell 3 (Right 25% width - 1 Grid Cell): Official Portal / High Authority Verification */}
        <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200/90 dark:border-zinc-800/90 p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  官方认证门户
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                占 1 格
              </span>
            </div>

            {officialSite ? (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                  {officialSite.title}
                </h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {officialSite.snippet || "经多源交叉检验确认为直属入口"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  多方综合信源已加权验证
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  已聚合全网权威公开发布平台
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            {officialSite ? (
              <a
                href={officialSite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-all active:scale-98 shadow-2xs"
              >
                <span>直达官方站点</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                onClick={() => setActiveTab("sources")}
                className="w-full flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-all"
              >
                <span>浏览全部参考信源</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Cell 4 (Far Right 25% width - 1 Grid Cell): Key Takeaways Highlight */}
        <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200/90 dark:border-zinc-800/90 p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ListChecks className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  核心结论速览
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold">
                {keyTakeaways.length} 条洞见
              </span>
            </div>

            <div className="space-y-1.5">
              {keyTakeaways.slice(0, 2).map((item, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white font-bold text-[8px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab("overview")}
              className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5"
            >
              <span>在研报中定位全文</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={handleCopySummary}
              title="复制结论与摘要"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {copiedSummary ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. CENTRAL COCKPIT STAGE: ZERO-SCROLL CLICK-ONLY INTERACTION HUB */}
      <div className="rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 border border-zinc-200/90 dark:border-zinc-800/90 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-md overflow-hidden flex flex-col flex-1 min-h-[580px]">
        {/* Click Command Dock (Zero-Scroll Module Switcher) */}
        <div className="px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              if (!tab.hasContent) return null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-97 ${
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-400 dark:text-blue-600" : "text-zinc-400 group-hover:text-zinc-600"}`} />
                  <span>{tab.label}</span>

                  {tab.countBadge !== undefined && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                        isActive
                          ? "bg-white/20 text-white dark:bg-black/10 dark:text-black font-bold"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {tab.countBadge}
                    </span>
                  )}

                  <kbd
                    className={`hidden lg:inline-block text-[9px] px-1 rounded font-mono ${
                      isActive
                        ? "text-white/60 dark:text-black/50"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {tab.shortcut}
                  </kbd>
                </button>
              );
            })}
          </div>

          {/* Switch to Bento Grid Mode & Quick Info */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>免滑动模式 · 按键盘 1-6 极速切换</span>
            </div>

            {onSwitchToBentoGrid && (
              <button
                onClick={onSwitchToBentoGrid}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 transition-all cursor-pointer shadow-2xs"
                title="切换至横排4格无限流自由网格布局"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />
                <span>切为多格流</span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Active Stage Content (Scrollable internally without window scroll) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-white dark:bg-[#1c1c1e]">
          {activeTab === "overview" && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* 行动规划与能力调度组件：当存在明确操作目标时优先置顶 */}
              {activeResult.actionPlan && activeResult.actionPlan.tasks && activeResult.actionPlan.tasks.length > 0 && (
                <div className="w-full">
                  <ActionPlanWidget
                    actionPlan={activeResult.actionPlan}
                    query={activeResult.query}
                  />
                </div>
              )}

              {/* 搜索定制独有小组件：与固定组件拥有完全相同的排列效果与UI风格 */}
              {displayCustomCards.length > 0 && (
                <div className="space-y-4 w-full">
                  {displayCustomCards.map((card) => (
                    <UniqueCardWidget
                      key={card.id}
                      card={card}
                      onUpdateCard={onUpdateCard}
                      onDeleteCard={onDeleteCard}
                    />
                  ))}
                </div>
              )}

              <AIOverviewWidget
                summary={activeResult.summary}
                query={activeResult.query}
                modelUsed={activeResult.modelUsed}
                filteredResults={activeResult.filteredResults}
                detectedLanguage={activeResult.detectedLanguage}
                onOpenMindMap={() => setActiveTab("mindmap")}
                onOpenComparison={() => setActiveTab("comparison")}
              />
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
                onForgeCardFromSource={(srcId) => onOpenForgeModal?.([srcId])}
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

              {/* Quick Inquiry Assistant Prompt */}
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>点击任意建议问题，Agent 将立即展开全新多源检索与交叉验证分析</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reasoning" && (
            <div className="max-w-4xl mx-auto">
              <AgentProgressStream
                steps={activeResult.steps}
                query={activeResult.query}
                isComplete={true}
                executionTimeMs={activeResult.executionTimeMs}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
