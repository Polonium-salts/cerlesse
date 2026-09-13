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
  Columns4,
  Loader2,
  Check,
  Globe,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Alert, AlertDescription } from "./ui/alert.js";

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
  { id: "zinc", label: "极简灰", bgClass: "bg-muted-foreground" }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl bg-card text-card-foreground rounded-xl border border-border shadow-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-start gap-2.5">
            <Sparkles className="size-4 text-muted-foreground shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                根据搜索结果创建独有卡片组件
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                将当前检索 “{query}” 的信源提炼为定制专属 Widget
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon-sm" onClick={onClose} title="关闭">
            <X />
          </Button>
        </div>

        {/* 主体 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* 形态原型 */}
          <div>
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2.5">
              <Layers className="size-3.5 text-muted-foreground" />
              <span>选择卡片形态原型</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {ARCHETYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = archetype === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setArchetype(item.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:bg-accent text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <Icon className={`size-4 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      {isSelected && <Check className="size-3.5" />}
                    </div>
                    <span className="text-xs font-medium block">{item.label}</span>
                    <span className={`text-xs mt-0.5 line-clamp-1 ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 定制指令 */}
          <div>
            <Label className="text-xs font-medium text-foreground flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                <span>定制聚焦指令（可选）</span>
              </span>
              <span className="text-xs text-muted-foreground font-normal">留空则全自动智能提炼</span>
            </Label>
            <Input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="例如：提炼所有价格及免费版额度限制；或总结针对小白的 5 个关键步骤"
            />
          </div>

          {/* 样式与布局 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 主题色调 */}
            <div>
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
                <Palette className="size-3.5 text-muted-foreground" />
                <span>卡片主题色调</span>
              </Label>
              <div className="flex items-center gap-2">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setThemeColor(c.id)}
                    title={c.label}
                    className={`size-7 rounded-md ${c.bgClass} flex items-center justify-center transition-transform cursor-pointer ${
                      themeColor === c.id ? "scale-110 ring-2 ring-offset-2 ring-ring ring-offset-background" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {themeColor === c.id && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 宽度占比 */}
            <div>
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
                <Columns4 className="size-3.5 text-muted-foreground" />
                <span>瀑布流宽度占比</span>
              </Label>
              <div className="flex items-center gap-1.5">
                {SPAN_OPTIONS.map((opt) => (
                  <Button
                    key={opt.span}
                    type="button"
                    variant={colSpan === opt.span ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setColSpan(opt.span)}
                  >
                    {opt.label.split(" ")[0]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 依凭信源 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                <span>依凭的搜索信源库</span>
              </Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleToggleSelectAll}
              >
                {isAllSelected ? "清空选择" : "全选信源"}
              </Button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-muted/40 border border-border custom-scrollbar">
              {results.slice(0, 8).map((r, idx) => {
                const isChecked = selectedResultIds.includes(r.id);
                return (
                  <div
                    key={r.id || idx}
                    onClick={() => handleToggleResult(r.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-card text-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent onClick
                      className="rounded accent-foreground focus:ring-0 shrink-0"
                    />
                    <span className="font-medium truncate flex-1">{r.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 font-mono">
                      {r.engine || "web"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-border bg-muted/40 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            已勾选 {selectedResultIds.length} 篇参考信源
          </span>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isForging}>
              取消
            </Button>

            <Button onClick={handleForge} disabled={isForging}>
              {isForging ? (
                <>
                  <Loader2 className="animate-spin" />
                  正在深度萃取并创建卡片...
                </>
              ) : (
                <>
                  <Sparkles />
                  立即生成独有卡片组件
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
