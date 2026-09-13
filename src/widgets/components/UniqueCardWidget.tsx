import React, { useState } from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { cn } from "../../lib/utils.js";
import { CustomCardData, CustomCardSectionItem, WidgetAction, WidgetPlannedSize } from "../../types.js";
import {
  Sparkles,
  CheckCircle2,
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
  ListTree,
  Download,
  PlayCircle,
  Zap,
  ArrowRight
} from "lucide-react";
import { ProsConsView } from "./archetypes/ProsConsView.js";
import { ChecklistView } from "./archetypes/ChecklistView.js";
import { MatrixView } from "./archetypes/MatrixView.js";
import { TimelineView } from "./archetypes/TimelineView.js";
import { VerdictView } from "./archetypes/VerdictView.js";
import { QuoteDossierView } from "./archetypes/QuoteDossierView.js";
import { ToolDiscoveryView } from "./archetypes/ToolDiscoveryView.js";
import { DownloadHubView } from "./archetypes/DownloadHubView.js";
import { TravelItineraryView } from "./archetypes/TravelItineraryView.js";

interface UniqueCardWidgetProps {
  card: CustomCardData;
  onUpdateCard?: (updated: CustomCardData) => void;
  onDeleteCard?: (id: string) => void;
  onReForgeCard?: (card: CustomCardData) => void;
  isCompact?: boolean;
  size?: WidgetPlannedSize;
  onResize?: (size: WidgetPlannedSize | "wide") => void;
}

/**
 * 卡片外壳令牌。
 *
 * 参考稿里所有卡片共用同一套灰阶视觉；项目又把框架色阶整体重映射为纯中性灰，
 * 蓝/绿/紫/琥珀/玫红六个历史主题键位因此**不再需要映射表**。
 * 外壳只剩三处真正需要令牌的地方（弱化图标 / 悬停描边 / 分组强调条），
 * 徽标、按钮、图标盒等视觉一律由 IOSWidget 与 Badge 等原语自身承接。
 * 锻造侧下发的 themeColor 字段仍留在数据契约里，只是不再参与渲染。
 */
const CARD_THEME = {
  iconText: "text-muted-foreground",
  borderHover: "hover:ring-foreground/25",
  accentBar: "bg-foreground/30"
};

const ARCHETYPE_LABELS: Record<string, string> = {
  pros_cons: "优劣与避坑",
  action_checklist: "实操清单",
  parameter_matrix: "参数规格",
  quote_dossier: "信源论据",
  timeline: "演进里程碑",
  verdict_summary: "结论裁决",
  tool_discovery: "工具与体验",
  download_hub: "安装与下载",
  travel_itinerary: "行程与打卡",
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
  isCompact = false,
  size,
  onResize
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"functional" | "structured">("functional");
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({});

  const handleActionClick = (action: WidgetAction, idx: number) => {
    const actId = action.id || `act-${idx}`;
    if (action.type === "copy" && action.command) {
      navigator.clipboard.writeText(action.command);
      setCopiedActionId(actId);
      setTimeout(() => setCopiedActionId(null), 2000);
    } else if (action.url) {
      window.open(action.url, "_blank", "noopener,noreferrer");
    }
  };

  const hasArchetypeView = Boolean(
    (card.archetype === "pros_cons" && card.prosConsData) ||
    (card.archetype === "action_checklist" && card.checklistData) ||
    (card.archetype === "parameter_matrix" && card.matrixData) ||
    (card.archetype === "timeline" && card.timelineData) ||
    (card.archetype === "verdict_summary" && card.verdictData) ||
    (card.archetype === "quote_dossier" && card.quoteData) ||
    (card.archetype === "tool_discovery" && card.toolDiscoveryData) ||
    (card.archetype === "download_hub" && card.downloadHubData) ||
    (card.archetype === "travel_itinerary" && card.travelData)
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

  const theme = CARD_THEME;

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
      size={size}
      onResize={onResize}
      // 宽高比由卡片原型固定（download_hub = 4:5，4 格宽时恰好 4x5），
      // 高度随之等比确定，因此内容无需滚动即可完整呈现。
      // 图标交给 IOSWidget 统一渲染：卡片外壳已把图标规范为「裸图标 + muted 前景」，
      // 这里再套一层图标底盒会形成双重容器
      icon={renderCardIcon(card.iconName)}
      badge={
        <Badge variant="secondary">
          {ARCHETYPE_LABELS[card.archetype] || "独有卡片"}
        </Badge>
      }
      actions={
        <div className="flex items-center gap-1">
          {/* 格宽切换 */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleColSpan}
            title={`调整卡片宽度 (当前: ${card.colSpan || 6} 格)`}
            aria-label="调整卡片宽度"
          >
            {card.colSpan === 12 ? <Minimize2 /> : <Maximize2 />}
          </Button>

          {/* 置顶 */}
          <Button
            variant={card.isPinned ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={togglePin}
            title={card.isPinned ? "取消置顶" : "置顶显示"}
            aria-label="置顶显示"
          >
            <Pin className={card.isPinned ? "fill-current" : undefined} />
          </Button>

          {/* 复制 Markdown */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyMarkdown}
            title="复制卡片 Markdown"
            aria-label="复制卡片 Markdown"
          >
            {copied ? <Check /> : <Copy />}
          </Button>

          {/* 删除 */}
          {onDeleteCard && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDeleteCard(card.id)}
              title="删除此独有卡片"
              aria-label="删除此独有卡片"
              className="hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      }
      className={cn("w-full transition-all", theme.borderHover)}
    >
      <div className="flex flex-col space-y-4">
        {/* 任务执行入口 */}
        {card.actions && card.actions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Zap className="size-3.5 text-muted-foreground" />
              <span>任务执行入口 · 立即解决</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {card.actions.map((act, idx) => {
                const actId = act.id || `act-${idx}`;
                const isCopied = copiedActionId === actId;
                const isPrimary = act.variant === "primary" || idx === 0;

                return (
                  <Button
                    key={actId}
                    variant={isPrimary ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleActionClick(act, idx)}
                  >
                    {act.type === "copy" ? (
                      isCopied ? <Check /> : <Copy />
                    ) : act.type === "download" ? (
                      <Download />
                    ) : act.type === "open_tool" ? (
                      <PlayCircle />
                    ) : (
                      <ExternalLink />
                    )}

                    <span>{isCopied ? "已复制到剪贴板" : act.label}</span>

                    {isPrimary && <ArrowRight className="opacity-60" />}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* 核心指标 */}
        {card.metrics && card.metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {card.metrics.map((m, idx) => (
              <div key={idx} className="flex flex-col px-2 py-1">
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {m.label}
                </span>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {m.value}
                  </span>
                  {m.trend === "up" && <TrendingUp className="size-3 shrink-0 text-muted-foreground" />}
                  {m.trend === "down" && <TrendingDown className="size-3 shrink-0 text-muted-foreground" />}
                </div>
                {m.subtext && (
                  <span className="mt-0.5 truncate text-xs text-muted-foreground">
                    {m.subtext}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 视图模式切换：交互看板 / 条目清单（同一份数据的两种读法） */}
        {hasArchetypeView && (
          <Tabs
            value={viewMode}
            onValueChange={value => setViewMode(value as "functional" | "structured")}
            className="min-w-0"
          >
            <TabsList className="w-full">
              <TabsTrigger value="functional">
                <Sparkles />
                <span>专属交互看板</span>
              </TabsTrigger>
              <TabsTrigger value="structured">
                <ListTree />
                <span>条目清单</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
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

            {card.archetype === "tool_discovery" && card.toolDiscoveryData && (
              <ToolDiscoveryView
                data={card.toolDiscoveryData}
                themeColor={card.themeColor}
              />
            )}

            {card.archetype === "download_hub" && card.downloadHubData && (
              <DownloadHubView
                data={card.downloadHubData}
                themeColor={card.themeColor}
              />
            )}

            {card.archetype === "travel_itinerary" && card.travelData && (
              <TravelItineraryView
                data={card.travelData}
                themeColor={card.themeColor}
              />
            )}
          </div>
        )}

        {/* 2. Structured Sections (shown if no archetype view or toggled to structured mode) */}
        {(!hasArchetypeView || viewMode === "structured") && (
          <div className="flex flex-col gap-3.5">
            {card.sections.map((section, sIdx) => {
              const isCollapsed = collapsedSections[sIdx];
              return (
                <div
                  key={sIdx}
                  className="overflow-hidden rounded-lg border border-border p-3.5"
                >
                  {/* 分组头：整行可点，开合态由 Chevron 方向表达 */}
                  <div
                    onClick={() => handleToggleSection(sIdx)}
                    className={cn("flex cursor-pointer select-none items-center justify-between", !isCollapsed && "mb-2.5 border-b border-border pb-2")}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{section.title}</h4>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {section.items.length}
                      </span>
                    </div>
                    <span className="p-0.5 text-muted-foreground">
                      {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                    </span>
                  </div>

                  {/* Section Items */}
                  {!isCollapsed && (
                    <div className="flex flex-col gap-2.5">
                      {section.items.map((item: CustomCardSectionItem, iIdx: number) => {
                        const itemKey = `${sIdx}-${iIdx}`;
                        const isChecked = itemsState[itemKey];
                        const isChecklist = item.checked !== undefined || card.archetype === "action_checklist";

                        return (
                          <div
                            key={iIdx}
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg p-2.5 transition-colors",
                              isChecked ? "bg-muted/40 opacity-75" : "hover:bg-muted/40"
                            )}
                          >
                            {/* 勾选：与清单视图同款 shadcn Checkbox 形状，达成态整块反色 */}
                            {isChecklist && (
                              <button
                                type="button"
                                onClick={() => handleToggleCheck(sIdx, iIdx)}
                                aria-pressed={Boolean(isChecked)}
                                className={cn(
                                  "mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border transition-colors",
                                  isChecked
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input hover:border-foreground/40"
                                )}
                              >
                                {isChecked && <Check className="size-3" />}
                              </button>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={cn(
                                    "text-sm font-medium text-foreground",
                                    isChecked && "text-muted-foreground line-through"
                                  )}
                                >
                                  {item.title}
                                </span>
                                {item.tag && <Badge variant="outline">{item.tag}</Badge>}
                              </div>

                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {item.description}
                              </p>

                              {item.sourceUrl && (
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1.5 inline-flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                                >
                                  <span>来源：{item.sourceTitle || new URL(item.sourceUrl).hostname}</span>
                                  <ExternalLink className="size-3" />
                                </a>
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

        {/* 落地建议 */}
        {card.takeawayFootnote && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <Sparkles className={cn("mt-0.5 size-3.5 shrink-0", theme.iconText)} />
            <span>
              <strong className="mr-1 font-medium text-foreground">落地建议：</strong>
              {card.takeawayFootnote}
            </span>
          </div>
        )}
      </div>
    </IOSWidget>
  );
};
