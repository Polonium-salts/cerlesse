import React, { useState, useEffect } from "react";
import {
  SearchResult,
  CustomCardData,
  CustomCardArchetype
} from "../types.js";
import {
  Sparkles,
  X,
  Layers,
  Scale,
  CheckCircle2,
  Terminal,
  Quote,
  Clock,
  Target,
  Palette,
  Columns3,
  Columns4,
  Loader2,
  Check,
  Globe,
  SlidersHorizontal
} from "lucide-react";

interface UniqueCardForgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  results: SearchResult[];
  preselectedResultIds?: string[];
  onCardCreated: (newCard: CustomCardData) => void;
}

const ARCHETYPES: {
  id: CustomCardArchetype | "auto";
  label: string;
  desc: string;
  icon: any;
}[] = [
  {
    id: "auto",
    label: "智能自适应",
    desc: "AI 自动发掘搜索结果中最有价值的结构形式",
    icon: Sparkles
  },
  {
    id: "action_checklist",
    label: "实操清单",
    desc: "梳理分步实操检查项与避坑要点，带交互勾选",
    icon: CheckCircle2
  },
  {
    id: "pros_cons",
    label: "优劣与避坑",
    desc: "对比技术或方案的核心亮点与潜在踩坑风险",
    icon: Scale
  },
  {
    id: "parameter_matrix",
    label: "参数规格",
    desc: "提取核心技术规格、参数指标与硬核基准",
    icon: Terminal
  },
  {
    id: "quote_dossier",
    label: "论据档案",
    desc: "精选权威专家观点、关键言论与信源原句",
    icon: Quote
  },
  {
    id: "timeline",
    label: "发展里程碑",
    desc: "梳理关键演进脉络、历史节点与版本发布",
    icon: Clock
  },
  {
    id: "verdict_summary",
    label: "决策裁决",
    desc: "给出客观评级、选型决策指南与落地建议",
    icon: Target
  }
];

const THEME_COLORS: {
  id: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
  label: string;
  bgClass: string;
}[] = [
  { id: "blue", label: "科技蓝", bgClass: "bg-blue-500" },
  { id: "emerald", label: "翡翠绿", bgClass: "bg-emerald-500" },
  { id: "violet", label: "紫罗兰", bgClass: "bg-purple-500" },
  { id: "amber", label: "琥珀橙", bgClass: "bg-amber-500" },
  { id: "rose", label: "玫瑰红", bgClass: "bg-rose-500" },
  { id: "zinc", label: "极简灰", bgClass: "bg-zinc-600" }
];

const SPAN_OPTIONS = [
  { span: 4, label: "1/3 单格 (Compact)" },
  { span: 6, label: "1/2 半宽 (Standard)" },
  { span: 12, label: "1/1 全宽 (Wide)" }
];

export const UniqueCardForgeModal: React.FC<UniqueCardForgeModalProps> = ({
  isOpen,
  onClose,
  query,
  results,
  preselectedResultIds = [],
  onCardCreated
}) => {
  const [archetype, setArchetype] = useState<CustomCardArchetype | "auto">("auto");
  const [userPrompt, setUserPrompt] = useState("");
  const [themeColor, setThemeColor] = useState<"blue" | "emerald" | "violet" | "amber" | "rose" | "zinc">("blue");
  const [colSpan, setColSpan] = useState<number>(6);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [isAllSelected, setIsAllSelected] = useState<boolean>(true);
  const [isForging, setIsForging] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedResultIds.length > 0) {
      setSelectedResultIds(preselectedResultIds);
      setIsAllSelected(false);
    } else {
      setSelectedResultIds(results.map(r => r.id));
      setIsAllSelected(true);
    }
  }, [preselectedResultIds, results]);

  if (!isOpen) return null;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedResultIds([]);
      setIsAllSelected(false);
    } else {
      setSelectedResultIds(results.map(r => r.id));
      setIsAllSelected(true);
    }
  };

  const handleToggleResult = (id: string) => {
    let next: string[];
    if (selectedResultIds.includes(id)) {
      next = selectedResultIds.filter(i => i !== id);
    } else {
      next = [...selectedResultIds, id];
    }
    setSelectedResultIds(next);
    setIsAllSelected(next.length === results.length);
  };

  const handleForge = async () => {
    setIsForging(true);
    setErrorMsg(null);

    const targetResults = isAllSelected || selectedResultIds.length === 0
      ? results
      : results.filter(r => selectedResultIds.includes(r.id));

    try {
      const response = await fetch("/api/cards/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          results: targetResults,
          archetype,
          userPrompt: userPrompt.trim() || undefined,
          themeColor,
          colSpan
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "生成失败");
      }

      const data = await response.json();
      if (data.card) {
        onCardCreated(data.card);
        onClose();
      } else {
        throw new Error("未能生成卡片数据");
      }
    } catch (err: any) {
      console.error("Forge error:", err);
      setErrorMsg(err.message || "创建独有卡片遇到问题，请重试");
    } finally {
      setIsForging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                根据搜索结果创建独有卡片组件
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                将当前检索 “{query}” 的信源提炼为定制专属 Widget
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* 1. Archetype Selection */}
          <div>
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 mb-2.5">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>1. 选择卡片形态原型</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {ARCHETYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = archetype === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setArchetype(item.id)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-sm"
                        : "bg-zinc-50/70 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-700/70 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-white dark:text-zinc-900" : "text-zinc-500"}`} />
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Custom Prompt Input */}
          <div>
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                <span>2. 定制聚焦指令 (可选)</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-normal">留空则全自动智能提炼</span>
            </label>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="例如：提炼所有价格及免费版额度限制；或总结针对小白的 5 个关键步骤"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          {/* 3. Style & Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Color */}
            <div>
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 mb-2">
                <Palette className="w-3.5 h-3.5 text-zinc-500" />
                <span>3. 卡片主题色调</span>
              </label>
              <div className="flex items-center gap-2">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setThemeColor(c.id)}
                    title={c.label}
                    className={`w-7 h-7 rounded-xl ${c.bgClass} flex items-center justify-center transition-transform cursor-pointer ${
                      themeColor === c.id ? "scale-110 ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-900" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {themeColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Col Span */}
            <div>
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 mb-2">
                <Columns4 className="w-3.5 h-3.5 text-zinc-500" />
                <span>4. 瀑布流宽度占比</span>
              </label>
              <div className="flex items-center gap-1.5">
                {SPAN_OPTIONS.map((opt) => (
                  <button
                    key={opt.span}
                    onClick={() => setColSpan(opt.span)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer ${
                      colSpan === opt.span
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100"
                    }`}
                  >
                    {opt.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Grounding Source Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
                <span>5. 依凭的搜索信源库</span>
              </label>
              <button
                onClick={handleToggleSelectAll}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {isAllSelected ? "清空选择" : "全选信源"}
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/70 dark:border-zinc-800 custom-scrollbar">
              {results.slice(0, 8).map((r, idx) => {
                const isChecked = selectedResultIds.includes(r.id);
                return (
                  <div
                    key={r.id || idx}
                    onClick={() => handleToggleResult(r.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-500 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent onClick
                      className="rounded text-zinc-900 focus:ring-0 shrink-0"
                    />
                    <span className="font-semibold truncate flex-1">{r.title}</span>
                    <span className="text-[10px] text-zinc-400 shrink-0 font-mono">
                      {r.engine || "web"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-zinc-400">
            已勾选 {selectedResultIds.length} 篇参考信源
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isForging}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              取消
            </button>

            <button
              onClick={handleForge}
              disabled={isForging}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isForging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在深度萃取并创建卡片...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>立即生成独有卡片组件</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
