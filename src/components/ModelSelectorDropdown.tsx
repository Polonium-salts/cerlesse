/**
 * 顶部栏模型选择面板。
 * ========================================================================
 * 为什么重做（v1 的四个实际问题）：
 *   1. 类名失效：v1 用了 `h-8.5` / `pl-8.5` / `py-0.2` / `shadow-xs`。
 *      本仓库是 Tailwind **v3.4.17**（见 package.json 与 tailwind.config.ts），
 *      这几个是 v4 的命名，编译产物里根本不存在对应规则 ——
 *      于是触发按钮和搜索框没有固定高度（靠内容撑），搜索框左侧内边距为 0
 *      （文字压在被绝对定位的放大镜图标下面），标签没有纵向内边距。
 *      本文件只用 v3 确定生成的类，并有 `scripts/verify:*` 之外的构建产物可核对。
 *   2. 颜色失效：tailwind.config.ts 把 red/blue/emerald/purple… 全部指向同一套灰阶，
 *      所以 v1 里那套 `bg-emerald-500/10` / `text-blue-600` 厂牌配色**全都渲染成灰色**，
 *      视觉层级实际只来自层级本身。重做后不再假装有颜色，改用
 *      「分组标题 + 主色高亮 + 灰阶标签」来表达结构，任何主题下都成立。
 *   3. 列表可读性：v1 是 238+ 模型的一条平铺流水（`divide-y` + 每行自带厂牌标签，
 *      同一厂牌重复出现几十次）。现在按厂牌分组、组标题吸顶，厂牌信息从每行搬到组头，
 *      每行只留「名称 / 模型 ID / 上下文 / FREE」，搜索与页签过滤照旧。
 *   4. 键盘与无障碍：v1 只有鼠标点击。现在补上 combobox + listbox 结构、
 *      ↑/↓/Home/End/Enter/Esc 导航、aria-activedescendant 与选中态播报。
 *
 * 数据流不变：只接收 models 与 onSelectModel，不自己发请求、不自己写 localStorage。
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Cpu,
  Loader2,
  Search,
  SlidersHorizontal,
  Star,
  X,
  Zap
} from "lucide-react";
import { cn } from "../lib/utils.js";
import { Input } from "./ui/input.js";

export interface SelectableModelItem {
  id: string;
  name?: string;
  description?: string;
  contextLength?: string;
  contextWindow?: number;
  pricing?: string;
  isRecommended?: boolean;
}

interface ModelSelectorDropdownProps {
  currentModelId: string;
  models: SelectableModelItem[];
  onSelectModel: (modelId: string) => void;
  isDetecting?: boolean;
  providerName?: string;
  onOpenSettings?: () => void;
}

/** 列表上方的快捷筛选页签 */
export type ModelListTab = "all" | "recommended" | "free" | "large_ctx";

export interface ModelMeta {
  /** 去掉装饰性前后缀的展示名（`★ Gemini 2.0 (1000k)` → `Gemini 2.0`） */
  cleanName: string;
  isFree: boolean;
  isRecommended: boolean;
  /** 规范化后的上下文标记，如 `128k` / `1M`；取不到时为空串 */
  contextBadge: string;
  /** 上下文换算成 k，便于比较（`1M` → 1000） */
  contextScaleK: number;
  brand: string;
}

/** 超大上下文的判定线：200k 以上（与 v1 的筛选口径保持一致） */
const LARGE_CONTEXT_K = 200;
/** 「其他」分组名：所有规则都没命中的模型归到这里 */
const OTHER_BRAND = "其他";

/**
 * 厂牌识别规则，顺序即优先级。
 *
 * 用正则而不是 `includes`：`o1` / `o3` 这类极短 token 用子串匹配会误伤
 * （例如把 `cogito` 里的 `o1` 认成 OpenAI）。这里要求它们出现在
 * 路径分隔符、空格或连字符的边界上（`openai/o1-mini`）。
 */
const BRAND_RULES: ReadonlyArray<{ brand: string; test: RegExp }> = [
  { brand: "DeepSeek", test: /deepseek/i },
  { brand: "Anthropic", test: /claude|anthropic/i },
  { brand: "Google", test: /gemini|gemma|google|palm/i },
  { brand: "OpenAI", test: /gpt|openai|chatgpt|davinci|(^|[/\s-])o[1-4]([-/\s]|$)/i },
  { brand: "Qwen", test: /qwen|tongyi|alibaba/i },
  { brand: "Meta", test: /llama|meta-/i },
  { brand: "Mistral", test: /mistral|mixtral|magistral|devstral|codestral/i },
  { brand: "xAI", test: /grok|x-ai|xai/i },
  { brand: "Moonshot", test: /kimi|moonshot/i },
  { brand: "Zhipu", test: /glm|zhipu|chatglm/i },
  { brand: "MiniMax", test: /minimax|abab/i },
  { brand: "NVIDIA", test: /nvidia|nemotron/i },
  { brand: "Microsoft", test: /phi-|microsoft/i },
  { brand: "Cohere", test: /command-|cohere/i },
  { brand: "Amazon", test: /nova-|amazon|titan/i },
  { brand: "Vision/Art", test: /flux|diffusion|dreamshaper|sdxl|stable-/i }
];

/** 从名称 / ID 里捞出上下文长度标记，取不到就回退到结构化字段 */
export function extractContextBadge(model: SelectableModelItem): string {
  const source = `${model.name || ""} ${model.id}`;
  const matched = source.match(/(\d+(?:\.\d+)?)\s*([km])(?![a-z0-9])/i);
  if (matched) return `${matched[1]}${matched[2].toLowerCase()}`;
  const structured = (model.contextLength || "").trim();
  if (structured) return structured;
  if (typeof model.contextWindow === "number" && model.contextWindow > 0) {
    return model.contextWindow >= 1_000_000
      ? `${Math.round(model.contextWindow / 1_000_000)}M`
      : `${Math.round(model.contextWindow / 1000)}k`;
  }
  return "";
}

/** 上下文标记换算成 k（`1M` → 1000，`128k` → 128，无法解析 → 0） */
export function contextScaleK(badge: string): number {
  const matched = (badge || "").match(/(\d+(?:\.\d+)?)\s*([km])?/i);
  if (!matched) return 0;
  const value = parseFloat(matched[1]);
  if (!Number.isFinite(value)) return 0;
  return /m/i.test(matched[2] || "") ? value * 1000 : value;
}

/** 解析单个模型的展示元数据（纯函数，可单测） */
export function parseModelMetadata(model: SelectableModelItem): ModelMeta {
  const idLower = (model.id || "").toLowerCase();
  const nameLower = (model.name || model.id || "").toLowerCase();
  const pricing = (model.pricing || "").toLowerCase();

  const isFree =
    idLower.includes(":free") ||
    idLower.includes("free/") ||
    idLower.endsWith("/free") ||
    nameLower.includes(":free") ||
    pricing === "free" ||
    pricing.includes("免费");

  let brand = OTHER_BRAND;
  for (const rule of BRAND_RULES) {
    if (rule.test.test(`${idLower} ${nameLower}`)) {
      brand = rule.brand;
      break;
    }
  }

  let cleanName = model.name || model.id;
  cleanName = cleanName
    .replace(/^[★\s]+/, "")
    .replace(/\s*\(\s*\d+(?:\.\d+)?\s*k?\s*\)\s*$/i, "")
    .replace(/\s*:free$/i, "")
    .trim();
  if (!cleanName) cleanName = model.id;

  const contextBadge = extractContextBadge(model);

  return {
    cleanName,
    isFree,
    isRecommended: Boolean(model.isRecommended),
    contextBadge,
    contextScaleK: contextScaleK(contextBadge),
    brand
  };
}

/** 按关键词与页签过滤模型列表（纯函数，可单测） */
export function filterModels(
  models: SelectableModelItem[],
  query: string,
  tab: ModelListTab
): SelectableModelItem[] {
  const needle = (query || "").trim().toLowerCase();
  return models.filter((model) => {
    const meta = parseModelMetadata(model);
    if (needle) {
      const haystack = `${model.id} ${model.name || ""} ${model.description || ""} ${meta.brand}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (tab === "free") return meta.isFree;
    if (tab === "recommended") return meta.isRecommended;
    if (tab === "large_ctx") return meta.contextScaleK >= LARGE_CONTEXT_K;
    return true;
  });
}

/**
 * 按厂牌分组，保持首次出现的顺序。
 * 不按组大小排序：同一个网关的模型顺序在多次打开展开时应该稳定，
 * 否则「常常点的那个」每刷新一次就换位置。
 */
export function groupModelsByBrand(
  models: SelectableModelItem[]
): Array<{ brand: string; items: SelectableModelItem[] }> {
  const groups = new Map<string, SelectableModelItem[]>();
  for (const model of models) {
    const brand = parseModelMetadata(model).brand;
    const bucket = groups.get(brand);
    if (bucket) bucket.push(model);
    else groups.set(brand, [model]);
  }
  return [...groups.entries()].map(([brand, items]) => ({ brand, items }));
}

/** 各页签的数量，用于页签上的角标（纯函数，可单测） */
export function modelTabCounts(models: SelectableModelItem[]): Record<ModelListTab, number> {
  let recommended = 0;
  let free = 0;
  let largeContext = 0;
  for (const model of models) {
    const meta = parseModelMetadata(model);
    if (meta.isRecommended) recommended += 1;
    if (meta.isFree) free += 1;
    if (meta.contextScaleK >= LARGE_CONTEXT_K) largeContext += 1;
  }
  return { all: models.length, recommended, free, large_ctx: largeContext };
}

/** 小标签（FREE / 上下文长度）的统一样式：v3 有效的内边距，没有颜色幻觉 */
const TAG_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none";

/** 面板与视口边缘的最小留白 */
const PANEL_MARGIN = 12;

export const ModelSelectorDropdown: React.FC<ModelSelectorDropdownProps> = ({
  currentModelId,
  models,
  onSelectModel,
  isDetecting = false,
  providerName,
  onOpenSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ModelListTab>("all");
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * 面板相对触发器的水平偏移（px）。
   * 不能只靠 `right-0`：宽屏下右对齐触发器就是对的，但窄屏时触发器右边还有
   * 主题切换 / API Key 两个按钮（实测 390px 视口下触发器右边缘距屏幕右边缘 90px），
   * 一个 366px 宽的面板右对齐过去就会从屏幕左侧溢出 66px，左半边点不到。
   * 这里把面板右边缘夹取到视口内，左边缘不够时再往右推。
   */
  const [panelOffsetRight, setPanelOffsetRight] = useState(0);

  // useId 带冒号（`:r1:`），直接当 DOM id 会在 querySelector 里需要转义，这里洗掉
  const rawId = useId();
  const listId = `model-list-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const activeModel = useMemo<SelectableModelItem>(
    () => models.find((m) => m.id === currentModelId) || { id: currentModelId, name: currentModelId },
    [models, currentModelId]
  );
  const activeMeta = useMemo(() => parseModelMetadata(activeModel), [activeModel]);

  const filteredModels = useMemo(
    () => filterModels(models, searchQuery, activeTab),
    [models, searchQuery, activeTab]
  );
  const groups = useMemo(() => groupModelsByBrand(filteredModels), [filteredModels]);
  const counts = useMemo(() => modelTabCounts(models), [models]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 打开时聚焦搜索框；关闭时清空关键词（页签保留，便于连续挑选）
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // 过滤条件变化后把高亮落回当前选中模型，找不到就回到第一项
  useEffect(() => {
    const selectedIndex = filteredModels.findIndex((m) => m.id === currentModelId);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [filteredModels, currentModelId]);

  // 键盘高亮项滚进可视区（block: nearest 不会把列表整体滚动位置带飞）
  useEffect(() => {
    if (!isOpen) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-model-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen, filteredModels]);

  // 定位在 useLayoutEffect 里做：浏览器绘制前就修正，不会出现「先错位再跳一下」
  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelOffsetRight(0);
      return;
    }
    const place = () => {
      const container = containerRef.current;
      const panel = panelRef.current;
      if (!container || !panel) return;
      const rect = container.getBoundingClientRect();
      const width = panel.offsetWidth;
      const viewportWidth = window.innerWidth;
      const desiredRight = Math.min(
        Math.max(rect.right, PANEL_MARGIN + width),
        viewportWidth - PANEL_MARGIN
      );
      setPanelOffsetRight(Math.round(rect.right - desiredRight));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [isOpen]);

  const closeAndRestoreFocus = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (modelId: string) => {
      const next = (modelId || "").trim();
      if (!next) return;
      onSelectModel(next);
      closeAndRestoreFocus();
    },
    [onSelectModel, closeAndRestoreFocus]
  );

  const handlePopoverKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const total = filteredModels.length;
    const move = (delta: number) => {
      event.preventDefault();
      if (total === 0) return;
      setActiveIndex((index) => (index + delta + total) % total);
    };

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      case "ArrowDown":
        move(1);
        return;
      case "ArrowUp":
        move(-1);
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        if (total > 0) setActiveIndex(total - 1);
        return;
      case "Enter": {
        const target = filteredModels[activeIndex];
        if (target) {
          event.preventDefault();
          handleSelect(target.id);
        } else if (searchQuery.trim()) {
          // 列表里没有这个 ID 时，允许直接把搜索词当作模型 ID 使用
          event.preventDefault();
          handleSelect(searchQuery.trim());
        }
        return;
      }
      default:
        return;
    }
  };

  const tabs: Array<{ id: ModelListTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: "all", label: "全部", count: counts.all, icon: <Cpu className="size-2.5" /> },
    { id: "recommended", label: "推荐", count: counts.recommended, icon: <Star className="size-2.5" /> },
    { id: "free", label: "免费", count: counts.free, icon: <Zap className="size-2.5" /> },
    { id: "large_ctx", label: "长上下文", count: counts.large_ctx, icon: <Bot className="size-2.5" /> }
  ];

  // 逐组铺行，同时维护一个跨组递增的扁平下标（键盘导航用同一个顺序）
  let flatCursor = 0;
  const listBody: React.ReactNode[] = [];
  for (const group of groups) {
    listBody.push(
      <div
        key={`group-${group.brand}`}
        role="presentation"
        className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-popover/95 px-3 py-1.5 backdrop-blur-sm"
      >
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {group.brand}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {group.items.length}
        </span>
      </div>
    );

    for (const model of group.items) {
      const meta = parseModelMetadata(model);
      const index = flatCursor++;
      const isSelected = model.id === currentModelId;
      const isActive = index === activeIndex;
      const optionId = `${listId}-option-${index}`;

      listBody.push(
        <div
          key={model.id}
          id={optionId}
          role="option"
          aria-selected={isSelected}
          data-model-index={index}
          title={model.description || model.id}
          onClick={() => handleSelect(model.id)}
          className={cn(
            "mx-1.5 mt-1 flex cursor-pointer items-start gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
            isSelected
              ? "border-primary/35 bg-primary/10"
              : "border-transparent hover:bg-muted/70",
            isActive && !isSelected && "border-border/70 bg-muted/60",
            isActive && isSelected && "ring-1 ring-primary/25"
          )}
        >
          {/* 厂牌首字母方块：与信源卡的 favicon 色块同一套「无图标资源的站点标识」思路 */}
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border font-mono text-[11px] font-semibold",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-muted text-muted-foreground"
            )}
          >
            {meta.isFree ? <Zap className="size-3.5" /> : meta.brand.charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "truncate text-xs font-semibold tracking-tight",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {meta.cleanName}
              </span>
              {meta.isRecommended && (
                <span className={cn(TAG_CLASS, "border-primary/25 bg-primary/10 text-primary")}>
                  <Star className="size-2.5" />
                  推荐
                </span>
              )}
              {meta.isFree && (
                <span className={cn(TAG_CLASS, "border-primary/25 bg-primary/10 font-mono text-primary")}>
                  FREE
                </span>
              )}
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate font-mono text-[10px] opacity-80">{model.id}</span>
              {meta.contextBadge && (
                <span className={cn(TAG_CLASS, "border-border/60 bg-muted/60 font-mono text-muted-foreground")}>
                  {meta.contextBadge}
                </span>
              )}
            </div>

            {model.description && (
              <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-muted-foreground/80">
                {model.description}
              </p>
            )}
          </div>

          {isSelected && (
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary">
              <Check className="size-3 stroke-[3] text-primary-foreground" />
            </span>
          )}
        </div>
      );
    }
  }

  return (
    // 外层用 flex 而不是 inline-block：
    // 1) min-w-0 + flex 项，才能让本组件在顶栏（窄屏）里真正被压缩 —— 不放开最小宽度时，
    //    它的 min-content 就是完整模型名（名字 nowrap + 省略号），会拒绝收缩并压到左边内容上；
    // 2) 触发器本身是 <button>，即使写 display:flex 也是「按内容收缩」的盒子，
    //    不会自己填满父容器 —— 放在 flex 容器里当 flex 项，它才会跟着容器一起收缩。
    <div className="relative flex min-w-0 text-left" ref={containerRef}>
      {/* 隐藏原生 Select：保留一条非 JS / 读屏可读的兜底通道 */}
      <select
        aria-label="选择 AI 模型"
        value={currentModelId}
        onChange={(e) => onSelectModel(e.target.value)}
        className="sr-only pointer-events-none"
        tabIndex={-1}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.id}
          </option>
        ))}
      </select>

      {/* 触发按钮 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-label={`当前模型 ${activeMeta.cleanName}，点击选择模型`}
        title={`当前模型: ${activeModel.name || activeModel.id}${providerName ? ` (${providerName})` : ""}\n点击展开模型选择面板`}
        className={cn(
          // 移动端顶栏第一行只放品牌 + 三个操作，模型名可以拿到更多宽度
          "group flex h-9 min-w-0 max-w-[11rem] shrink cursor-pointer select-none items-center gap-2 rounded-xl border bg-background/90 pl-2 pr-2 text-xs font-medium text-foreground shadow-sm backdrop-blur-md transition-colors sm:max-w-none sm:pl-2.5 sm:pr-2.5",
          "hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          isOpen ? "border-primary/60 bg-muted/90 ring-2 ring-primary/20" : "border-border/80 hover:border-border"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-semibold",
            activeMeta.isFree ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {isDetecting ? (
            <Loader2 className="size-3 animate-spin text-primary" />
          ) : activeMeta.isFree ? (
            <Zap className="size-3" />
          ) : (
            activeMeta.brand.charAt(0).toUpperCase()
          )}
        </span>

        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <span className="truncate text-[12px] font-semibold tracking-tight">{activeMeta.cleanName}</span>
          {activeMeta.isFree && (
            <span className={cn(TAG_CLASS, "border-primary/25 bg-primary/10 font-mono text-primary")}>FREE</span>
          )}
          {activeMeta.contextBadge && !activeMeta.isFree && (
            <span className={cn(TAG_CLASS, "hidden border-border/60 bg-muted/70 font-mono text-muted-foreground sm:inline-flex")}>
              {activeMeta.contextBadge}
            </span>
          )}
        </span>

        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen ? "rotate-180 text-primary" : "opacity-70 group-hover:opacity-100"
          )}
        />
      </button>

      {/* 选择面板 */}
      {isOpen && (
        <div
          ref={panelRef}
          onKeyDown={handlePopoverKeyDown}
          style={{ right: panelOffsetRight }}
          className="absolute top-full z-50 mt-2 flex w-[min(26rem,calc(100vw-1.5rem))] origin-top-right flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 搜索 + 页签 */}
          <div className="border-b border-border/60 bg-muted/40 p-3 pb-2">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  filteredModels.length > 0 ? `${listId}-option-${activeIndex}` : undefined
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索模型名称、ID 或厂牌…"
                className="h-9 pl-9 pr-8 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="清空搜索"
                  className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                    <span className="tabular-nums opacity-70">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 模型列表：按厂牌分组、组标题吸顶 */}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="可用模型"
            className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain py-1.5"
          >
            {models.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bot className="mx-auto mb-2 size-7 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">还没有加载到可用模型</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  填入 API Key 后会自动探测上游服务并拉取模型目录
                </p>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenSettings();
                    }}
                    className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <SlidersHorizontal className="size-3" />
                    前往设置填入 API Key
                  </button>
                )}
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="space-y-3 px-4 py-6 text-center">
                <div>
                  <Bot className="mx-auto mb-2 size-7 text-muted-foreground/50" />
                  <p className="text-xs font-medium text-foreground">列表里没有匹配的模型</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    也支持直接使用任意 OpenAI 兼容的模型 ID
                  </p>
                </div>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchQuery.trim())}
                    className="mx-auto flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <Cpu className="size-3.5" />
                    <span>
                      直接使用 <strong>{searchQuery.trim()}</strong>
                    </span>
                  </button>
                )}
              </div>
            ) : (
              listBody
            )}
          </div>

          {/* 底部：网关状态与设置入口 */}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/40 px-3.5 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="truncate">
                当前网关: <strong className="font-medium text-foreground">{providerName || "就绪"}</strong>
              </span>
            </span>

            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1 font-medium text-primary hover:underline"
              >
                <SlidersHorizontal className="size-3" />
                管理 API Key
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
