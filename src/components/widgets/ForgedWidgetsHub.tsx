import React, { useState } from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import { CustomCardData } from "../../types.js";
import {
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Pin,
  Scale,
  Terminal,
  Shield,
  Clock,
  Quote,
  Target,
  Layers,
  Plus
} from "lucide-react";

interface ForgedWidgetsHubProps {
  query: string;
  customCards: CustomCardData[];
  onUpdateCard?: (updated: CustomCardData) => void;
  onDeleteCard?: (id: string) => void;
  onOpenForgeModal?: () => void;
  isCompact?: boolean;
}

const ARCHETYPE_LABELS: Record<string, string> = {
  pros_cons: "优劣避坑",
  action_checklist: "实操清单",
  parameter_matrix: "参数规格",
  quote_dossier: "信源论据",
  timeline: "演进历程",
  verdict_summary: "选型裁决",
  freeform: "定制组件"
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

/**
 * 搜索定制独有小组件
 * 与固定小组件（官方门户、核心要点、工具箱等）保持完全一致的排版风格、网格规范和统一 iOS 视觉规范。
 */
export const ForgedWidgetsHub: React.FC<ForgedWidgetsHubProps> = ({
  query,
  customCards,
  onUpdateCard,
  onDeleteCard,
  onOpenForgeModal,
  isCompact = false
}) => {
  const [activeCardId, setActiveCardId] = useState<string>(() => {
    return customCards[0]?.id || "";
  });
  const [copied, setCopied] = useState(false);

  // 内部勾选状态
  const [itemsState, setItemsState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    customCards.forEach((card) => {
      card.sections.forEach((sec, sIdx) => {
        sec.items.forEach((item, iIdx) => {
          if (item.checked !== undefined) {
            initial[`${card.id}-${sIdx}-${iIdx}`] = item.checked;
          }
        });
      });
    });
    return initial;
  });

  if (!customCards || customCards.length === 0) {
    return null;
  }

  // 获取当前显示的卡片
  const activeCard = customCards.find(c => c.id === activeCardId) || customCards[0];

  const handleToggleCheck = (card: CustomCardData, sIdx: number, iIdx: number) => {
    const key = `${card.id}-${sIdx}-${iIdx}`;
    const nextVal = !itemsState[key];
    setItemsState(prev => ({ ...prev, [key]: nextVal }));

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

  const handleTogglePin = (card: CustomCardData) => {
    if (!onUpdateCard) return;
    onUpdateCard({ ...card, isPinned: !card.isPinned });
  };

  const handleCopyMarkdown = (card: CustomCardData) => {
    let md = `# ${card.title}\n> ${card.subtitle}\n\n`;
    if (card.metrics && card.metrics.length > 0) {
      md += `**关键指标**: ` + card.metrics.map(m => `${m.label}: ${m.value}`).join(" | ") + "\n\n";
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

  const getCardShortTitle = (card: CustomCardData, index: number) => {
    if (card.title.includes("·")) {
      return card.title.split("·")[1]?.trim() || card.title;
    }
    if (card.title.includes("-")) {
      return card.title.split("-")[1]?.trim() || card.title;
    }
    return card.title.length > 8 ? `${card.title.slice(0, 8)}...` : card.title || `卡片 ${index + 1}`;
  };

  return (
    <IOSWidget
      id="widget-custom-cards"
      title={activeCard.title}
      subtitle={isCompact ? undefined : activeCard.subtitle}
      icon={renderCardIcon(activeCard.iconName, "w-4 h-4 text-zinc-900 dark:text-zinc-100")}
      badge={
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {ARCHETYPE_LABELS[activeCard.archetype] || "定制组件"}
          </span>
          {activeCard.isPinned && (
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <Pin className="w-2.5 h-2.5 fill-current" />
              已置顶
            </span>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-1">
          {/* 多卡片无缝标签切换 (与固定小组件完全一致的高对比药丸按钮) */}
          {customCards.length > 1 && (
            <div className="flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 mr-1">
              {customCards.map((card, idx) => {
                const isActive = (activeCard.id === card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActiveCardId(card.id)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                    title={card.title}
                  >
                    {getCardShortTitle(card, idx)}
                  </button>
                );
              })}
            </div>
          )}

          {/* 复制 Markdown */}
          <button
            type="button"
            onClick={() => handleCopyMarkdown(activeCard)}
            className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="复制此组件 Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* 置顶切换 */}
          <button
            type="button"
            onClick={() => handleTogglePin(activeCard)}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              activeCard.isPinned
                ? "text-amber-500 bg-amber-50 dark:bg-amber-950/60"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            }`}
            title={activeCard.isPinned ? "取消置顶" : "置顶小组件"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* 删除小组件 */}
          {onDeleteCard && (
            <button
              type="button"
              onClick={() => onDeleteCard(activeCard.id)}
              className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
              title="删除此小组件"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 定制新组件 */}
          {onOpenForgeModal && (
            <button
              type="button"
              onClick={onOpenForgeModal}
              className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="根据搜索结果继续锻造新定制小组件"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      }
      className="w-full"
    >
      <div className={`flex flex-col ${isCompact ? "space-y-2.5" : "space-y-3.5"}`}>
        {/* 关键度量指标网格 (与固定小组件一致的圆角与边框) */}
        {activeCard.metrics && activeCard.metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {activeCard.metrics.map((m, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/80 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate">{m.label}</span>
                  <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                    {m.value}
                  </div>
                </div>
                {m.subtext && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 shrink-0 ml-1">
                    {m.subtext}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 分区与条目展示 (采用与 KeyTakeawaysWidget、ChecklistWidget 相同的视觉层级) */}
        <div className="space-y-3">
          {activeCard.sections.map((sec, sIdx) => (
            <div key={sIdx} className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                  {sec.title}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {sec.items.length} 条
                </span>
              </div>

              <div className="space-y-2">
                {sec.items.map((item, iIdx) => {
                  const checkKey = `${activeCard.id}-${sIdx}-${iIdx}`;
                  const isChecked = itemsState[checkKey] ?? item.checked;
                  const hasCheckbox = item.checked !== undefined;

                  return (
                    <div
                      key={iIdx}
                      onClick={() => hasCheckbox && handleToggleCheck(activeCard, sIdx, iIdx)}
                      className={`flex items-start gap-2.5 ${
                        isCompact ? "p-2.5 rounded-xl" : "p-3 rounded-2xl"
                      } bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors ${
                        hasCheckbox ? "cursor-pointer" : ""
                      }`}
                    >
                      {/* 序号或勾选框 */}
                      {hasCheckbox ? (
                        <div className="mt-0.5 shrink-0">
                          {isChecked ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600" />
                          )}
                        </div>
                      ) : (
                        <span className={`${isCompact ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-[11px]"} rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}>
                          {iIdx + 1}
                        </span>
                      )}

                      {/* 文本内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span
                            className={`${isCompact ? "text-xs" : "text-xs sm:text-sm"} font-semibold ${
                              isChecked
                                ? "line-through text-zinc-400 dark:text-zinc-500"
                                : "text-zinc-900 dark:text-zinc-100"
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.tag && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                              {item.tag}
                            </span>
                          )}
                        </div>

                        <p className={`${isCompact ? "text-[11px]" : "text-xs"} text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed font-normal`}>
                          {item.description}
                        </p>

                        {item.sourceUrl && (
                          <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              <span>{item.sourceTitle || "参考信源"}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 底部小结建议 (与固定小组件一致的边框与说明文字) */}
        {activeCard.takeawayFootnote && (
          <div className="mt-2 pt-2.5 border-t border-zinc-200/70 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 mr-1">总结建议:</span>
            {activeCard.takeawayFootnote}
          </div>
        )}
      </div>
    </IOSWidget>
  );
};
