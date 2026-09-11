import React, { useState } from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import { CustomCardData, CustomCardSectionItem } from "../../types.js";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
  Pin,
  TrendingUp,
  TrendingDown,
  Layers,
  Scale,
  Terminal,
  Shield,
  Clock,
  Quote,
  Target,
  ChevronDown,
  ChevronUp,
  Share2,
  ListTree
} from "lucide-react";
import { ProsConsView } from "./archetypes/ProsConsView.js";
import { ChecklistView } from "./archetypes/ChecklistView.js";
import { MatrixView } from "./archetypes/MatrixView.js";
import { TimelineView } from "./archetypes/TimelineView.js";
import { VerdictView } from "./archetypes/VerdictView.js";
import { QuoteDossierView } from "./archetypes/QuoteDossierView.js";

interface UniqueCardWidgetProps {
  card: CustomCardData;
  onUpdateCard?: (updated: CustomCardData) => void;
  onDeleteCard?: (id: string) => void;
  onReForgeCard?: (card: CustomCardData) => void;
  isCompact?: boolean;
}

const THEME_STYLES: Record<string, {
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconText: string;
  borderHover: string;
  accentBar: string;
}> = {
  blue: {
    badgeBg: "bg-blue-50 dark:bg-blue-950/70",
    badgeText: "text-blue-700 dark:text-blue-300",
    iconBg: "bg-blue-100 dark:bg-blue-900/60",
    iconText: "text-blue-700 dark:text-blue-300",
    borderHover: "hover:border-blue-400 dark:hover:border-blue-600",
    accentBar: "bg-blue-500"
  },
  emerald: {
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/70",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/60",
    iconText: "text-emerald-700 dark:text-emerald-300",
    borderHover: "hover:border-emerald-400 dark:hover:border-emerald-600",
    accentBar: "bg-emerald-500"
  },
  violet: {
    badgeBg: "bg-purple-50 dark:bg-purple-950/70",
    badgeText: "text-purple-700 dark:text-purple-300",
    iconBg: "bg-purple-100 dark:bg-purple-900/60",
    iconText: "text-purple-700 dark:text-purple-300",
    borderHover: "hover:border-purple-400 dark:hover:border-purple-600",
    accentBar: "bg-purple-500"
  },
  amber: {
    badgeBg: "bg-amber-50 dark:bg-amber-950/70",
    badgeText: "text-amber-700 dark:text-amber-300",
    iconBg: "bg-amber-100 dark:bg-amber-900/60",
    iconText: "text-amber-700 dark:text-amber-300",
    borderHover: "hover:border-amber-400 dark:hover:border-amber-600",
    accentBar: "bg-amber-500"
  },
  rose: {
    badgeBg: "bg-rose-50 dark:bg-rose-950/70",
    badgeText: "text-rose-700 dark:text-rose-300",
    iconBg: "bg-rose-100 dark:bg-rose-900/60",
    iconText: "text-rose-700 dark:text-rose-300",
    borderHover: "hover:border-rose-400 dark:hover:border-rose-600",
    accentBar: "bg-rose-500"
  },
  zinc: {
    badgeBg: "bg-zinc-100 dark:bg-zinc-800",
    badgeText: "text-zinc-700 dark:text-zinc-300",
    iconBg: "bg-zinc-200 dark:bg-zinc-700",
    iconText: "text-zinc-800 dark:text-zinc-200",
    borderHover: "hover:border-zinc-400 dark:hover:border-zinc-500",
    accentBar: "bg-zinc-600"
  }
};

const ARCHETYPE_LABELS: Record<string, string> = {
  pros_cons: "优劣与避坑",
  action_checklist: "实操清单",
  parameter_matrix: "参数规格",
  quote_dossier: "信源论据",
  timeline: "演进里程碑",
  verdict_summary: "结论裁决",
  freeform: "专属定制"
};

function renderCardIcon(iconName?: string, className = "w-4 h-4") {
  switch (iconName?.toLowerCase()) {
    case "checkcircle":
    case "checklist":
      return <CheckCircle2 className={className} />;
    case "scale":
      return <Scale className={className} />;
    case "terminal":
      return <Terminal className={className} />;
    case "shield":
      return <Shield className={className} />;
    case "clock":
    case "timeline":
      return <Clock className={className} />;
    case "quote":
      return <Quote className={className} />;
    case "target":
      return <Target className={className} />;
    case "layers":
      return <Layers className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export const UniqueCardWidget: React.FC<UniqueCardWidgetProps> = ({
  card,
  onUpdateCard,
  onDeleteCard,
  onReForgeCard: _onReForgeCard,
  isCompact = false
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"functional" | "structured">("functional");
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({});

  const hasArchetypeView = Boolean(
    (card.archetype === "pros_cons" && card.prosConsData) ||
    (card.archetype === "action_checklist" && card.checklistData) ||
    (card.archetype === "parameter_matrix" && card.matrixData) ||
    (card.archetype === "timeline" && card.timelineData) ||
    (card.archetype === "verdict_summary" && card.verdictData) ||
    (card.archetype === "quote_dossier" && card.quoteData)
  );

  const [itemsState, setItemsState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    card.sections.forEach((sec, sIdx) => {
      sec.items.forEach((item, iIdx) => {
        if (item.checked !== undefined) {
          initial[`${sIdx}-${iIdx}`] = item.checked;
        }
      });
    });
    return initial;
  });

  const theme = THEME_STYLES[card.themeColor] || THEME_STYLES.blue;

  const handleToggleCheck = (sIdx: number, iIdx: number) => {
    const key = `${sIdx}-${iIdx}`;
    const nextVal = !itemsState[key];
    const nextState = { ...itemsState, [key]: nextVal };
    setItemsState(nextState);

    if (onUpdateCard) {
      const nextSections = card.sections.map((sec, currS) => {
        if (currS !== sIdx) return sec;
        return {
          ...sec,
          items: sec.items.map((item, currI) => {
            if (currI !== iIdx) return item;
            return { ...item, checked: nextVal };
          })
        };
      });
      onUpdateCard({ ...card, sections: nextSections });
    }
  };

  const handleToggleSection = (idx: number) => {
    setCollapsedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopyMarkdown = () => {
    let md = `# ${card.title}\n> ${card.subtitle}\n\n`;
    if (card.metrics && card.metrics.length > 0) {
      md += `**核心指标**:\n` + card.metrics.map(m => `- ${m.label}: ${m.value} (${m.subtext || ""})`).join("\n") + "\n\n";
    }
    card.sections.forEach(sec => {
      md += `### ${sec.title}\n`;
      sec.items.forEach((it, i) => {
        const checkPrefix = it.checked !== undefined ? (it.checked ? "[x] " : "[ ] ") : "";
        md += `${i + 1}. ${checkPrefix}${it.title}\n   ${it.description}\n`;
        if (it.sourceUrl) {
          md += `   信源: [${it.sourceTitle || it.sourceUrl}](${it.sourceUrl})\n`;
        }
      });
      md += "\n";
    });
    if (card.takeawayFootnote) {
      md += `*总结建议*: ${card.takeawayFootnote}\n`;
    }
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleColSpan = () => {
    if (!onUpdateCard) return;
    const current = card.colSpan || 6;
    let nextSpan = 6;
    if (current === 6) nextSpan = 12;
    else if (current === 12) nextSpan = 4;
    else nextSpan = 6;
    onUpdateCard({ ...card, colSpan: nextSpan });
  };

  const togglePin = () => {
    if (!onUpdateCard) return;
    onUpdateCard({ ...card, isPinned: !card.isPinned });
  };

  return (
    <IOSWidget
      id={`unique-card-${card.id}`}
      title={card.title}
      subtitle={card.subtitle}
      icon={
        <div className={`w-8 h-8 rounded-xl ${theme.iconBg} ${theme.iconText} flex items-center justify-center shrink-0`}>
          {renderCardIcon(card.iconName)}
        </div>
      }
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
            {ARCHETYPE_LABELS[card.archetype] || "独有卡片"}
          </span>
          {card.isPinned && (
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <Pin className="w-2.5 h-2.5 fill-current" />
              已置顶
            </span>
          )}
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            {card.sourceCount} 源交叉
          </span>
        </div>
      }
      actions={
        <div className="flex items-center gap-1">
          {/* Col Span Resizer */}
          <button
            onClick={toggleColSpan}
            title={`调整卡片宽度 (当前: ${card.colSpan || 6} 格)`}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {card.colSpan === 12 ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Pin */}
          <button
            onClick={togglePin}
            title={card.isPinned ? "取消置顶" : "置顶显示"}
            className={`p-1.5 rounded-lg transition-colors ${
              card.isPinned 
                ? "text-amber-500 bg-amber-50 dark:bg-amber-950/60" 
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${card.isPinned ? "fill-current" : ""}`} />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopyMarkdown}
            title="复制卡片 Markdown"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Delete */}
          {onDeleteCard && (
            <button
              onClick={() => onDeleteCard(card.id)}
              title="删除此独有卡片"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      }
      className={`w-full ${theme.borderHover} transition-all`}
    >
      <div className="flex flex-col space-y-4">
        {/* Key Metrics Banner (if present) */}
        {card.metrics && card.metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-850/70 border border-zinc-200/60 dark:border-zinc-800/80">
            {card.metrics.map((m, idx) => (
              <div key={idx} className="flex flex-col px-2 py-1">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                  {m.label}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {m.value}
                  </span>
                  {m.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />}
                  {m.trend === "down" && <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />}
                </div>
                {m.subtext && (
                  <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {m.subtext}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Archetype View Selector / Mode Toggle (if rich data is present) */}
        {hasArchetypeView && (
          <div className="flex items-center justify-between p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("functional")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "functional"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>专属交互看板</span>
              </button>

              <button
                onClick={() => setViewMode("structured")}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "structured"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>条目清单</span>
              </button>
            </div>

            <span className="text-[10px] font-mono text-zinc-400 pr-2">
              {ARCHETYPE_LABELS[card.archetype] || "定制引擎"}
            </span>
          </div>
        )}

        {/* 1. Specialized Archetype Interactive View */}
        {hasArchetypeView && viewMode === "functional" && (
          <div className="pt-0.5">
            {card.archetype === "pros_cons" && card.prosConsData && (
              <ProsConsView
                data={card.prosConsData}
                themeColor={card.themeColor}
                onUpdateData={(updated) => onUpdateCard?.({ ...card, prosConsData: updated })}
              />
            )}

            {card.archetype === "action_checklist" && card.checklistData && (
              <ChecklistView
                data={card.checklistData}
                themeColor={card.themeColor}
                onUpdateData={(updated) => onUpdateCard?.({ ...card, checklistData: updated })}
              />
            )}

            {card.archetype === "parameter_matrix" && card.matrixData && (
              <MatrixView
                data={card.matrixData}
                themeColor={card.themeColor}
                onUpdateData={(updated) => onUpdateCard?.({ ...card, matrixData: updated })}
              />
            )}

            {card.archetype === "timeline" && card.timelineData && (
              <TimelineView
                data={card.timelineData}
                themeColor={card.themeColor}
                onUpdateData={(updated) => onUpdateCard?.({ ...card, timelineData: updated })}
              />
            )}

            {card.archetype === "verdict_summary" && card.verdictData && (
              <VerdictView
                data={card.verdictData}
                themeColor={card.themeColor}
                onUpdateData={(updated) => onUpdateCard?.({ ...card, verdictData: updated })}
              />
            )}

            {card.archetype === "quote_dossier" && card.quoteData && (
              <QuoteDossierView
                data={card.quoteData}
                themeColor={card.themeColor}
                onUpdateData={(updated) => onUpdateCard?.({ ...card, quoteData: updated })}
              />
            )}
          </div>
        )}

        {/* 2. Structured Sections (shown if no archetype view or toggled to structured mode) */}
        {(!hasArchetypeView || viewMode === "structured") && (
          <div className="space-y-3.5">
            {card.sections.map((section, sIdx) => {
              const isCollapsed = collapsedSections[sIdx];
              return (
                <div
                  key={sIdx}
                  className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 overflow-hidden transition-all shadow-2xs"
                >
                  {/* Section Header */}
                  <div
                    onClick={() => handleToggleSection(sIdx)}
                    className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-zinc-100 dark:border-zinc-800/80 mb-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-3.5 rounded-full ${theme.accentBar}`} />
                      <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {section.title}
                      </h4>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        ({section.items.length})
                      </span>
                    </div>
                    <button className="text-zinc-400 hover:text-zinc-600 p-0.5">
                      {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Section Items */}
                  {!isCollapsed && (
                    <div className="space-y-2.5">
                      {section.items.map((item: CustomCardSectionItem, iIdx: number) => {
                        const itemKey = `${sIdx}-${iIdx}`;
                        const isChecked = itemsState[itemKey];
                        const isChecklist = item.checked !== undefined || card.archetype === "action_checklist";

                        return (
                          <div
                            key={iIdx}
                            className={`group/item flex items-start gap-2.5 p-2.5 rounded-xl transition-all ${
                              isChecked
                                ? "bg-zinc-50 dark:bg-zinc-850/40 opacity-75"
                                : "bg-zinc-50/60 dark:bg-zinc-800/40 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/80"
                            }`}
                          >
                            {/* Interactive Checkbox */}
                            {isChecklist && (
                              <button
                                onClick={() => handleToggleCheck(sIdx, iIdx)}
                                className="mt-0.5 shrink-0 text-zinc-400 hover:text-emerald-500 transition-colors"
                              >
                                {isChecked ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                                ) : (
                                  <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover/item:text-zinc-400" />
                                )}
                              </button>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-semibold text-zinc-900 dark:text-zinc-100 ${isChecked ? "line-through text-zinc-400 dark:text-zinc-500" : ""}`}>
                                  {item.title}
                                </span>
                                {item.tag && (
                                  <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-md ${
                                    item.tagColor === "emerald"
                                      ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                      : item.tagColor === "amber"
                                      ? "bg-amber-100/80 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                      : item.tagColor === "rose"
                                      ? "bg-rose-100/80 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                      : item.tagColor === "violet"
                                      ? "bg-purple-100/80 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                      : "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                  }`}>
                                    {item.tag}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                                {item.description}
                              </p>

                              {/* Source reference pill */}
                              {item.sourceUrl && (
                                <div className="mt-1.5 flex items-center gap-1">
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-mono transition-colors"
                                  >
                                    <span>来源：{item.sourceTitle || new URL(item.sourceUrl).hostname}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Takeaway Footnote */}
        {card.takeawayFootnote && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
            <Sparkles className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${theme.iconText}`} />
            <span className="leading-relaxed">
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200 mr-1">落地建议：</strong>
              {card.takeawayFootnote}
            </span>
          </div>
        )}
      </div>
    </IOSWidget>
  );
};
