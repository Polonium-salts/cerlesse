import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Scale,
  GitFork,
  FileText,
  ShieldCheck,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Columns4,
  Maximize2,
  Minimize2,
  Power,
  ToggleLeft,
  ToggleRight,
  Database,
  Compass,
  CheckCircle2,
  AlertCircle,
  Waves,
  Grid,
  Proportions,
  Zap,
  MousePointerClick,
  Puzzle,
  Eye,
  EyeOff,
  Code,
  TrendingUp,
  QrCode,
  MessageSquare
} from "lucide-react";
import {
  AdaptiveLayoutStrategy,
  LayoutIntentType,
  ResultWidgetKey,
  WidgetStatusDetail,
  LayoutAlignmentMode,
  AutoFillGapsMode
} from "../types.js";
import {
  PRESET_LAYOUT_OPTIONS,
  WIDTH_SPAN_OPTIONS,
  getWidgetLabel,
  getWidgetSpanLabel
} from "../lib/adaptiveLayout.js";

const ALL_POSSIBLE_WIDGETS: ResultWidgetKey[] = [
  "quick_answer",
  "takeaways",
  "official_portal",
  "metrics_telemetry",
  "actions_toolbox",
  "topic_digest",
  "mindmap",
  "comparison",
  "sources",
  "followup",
  "agent_workflow",
  "ai_overview",
  "analytics_trend",
  "verification_checklist",
  "fast_chat",
  "mobile_qr",
  "custom_cards"
];

interface AdaptiveLayoutControlProps {
  currentStrategy: AdaptiveLayoutStrategy;
  selectedPreset: LayoutIntentType | "custom";
  activeOrder: ResultWidgetKey[];
  enabledWidgets?: ResultWidgetKey[];
  alignmentMode?: LayoutAlignmentMode;
  interactionMode?: "cockpit" | "bento";
  customWidgetSpans?: Partial<Record<ResultWidgetKey, number>>;
  autoFillGaps?: boolean;
  autoFillMode?: AutoFillGapsMode;
  onToggleAutoFillGaps?: (enabled: boolean) => void;
  onChangeAutoFillMode?: (mode: AutoFillGapsMode) => void;
  onToggleInteractionMode?: (mode: "cockpit" | "bento") => void;
  onToggleAlignmentMode?: (mode: LayoutAlignmentMode) => void;
  onChangeWidgetSpan?: (widgetKey: ResultWidgetKey, span: number) => void;
  onSelectPreset: (preset: LayoutIntentType) => void;
  onMoveWidget: (widgetKey: ResultWidgetKey, direction: "up" | "down") => void;
  onToggleWidgetActivation?: (widgetKey: ResultWidgetKey) => void;
  onResetToRecommended: () => void;
  isWideCanvas?: boolean;
  onToggleCanvasWidth?: () => void;
  defaultCollapsed?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  hideCollapsedBar?: boolean;
}

export const AdaptiveLayoutControl: React.FC<AdaptiveLayoutControlProps> = ({
  currentStrategy,
  selectedPreset,
  activeOrder,
  enabledWidgets = ALL_POSSIBLE_WIDGETS,
  alignmentMode = "masonry",
  interactionMode = "cockpit",
  customWidgetSpans = {},
  autoFillGaps = true,
  autoFillMode = "dense",
  onToggleAutoFillGaps,
  onChangeAutoFillMode,
  onToggleInteractionMode,
  onToggleAlignmentMode,
  onChangeWidgetSpan,
  onSelectPreset,
  onMoveWidget,
  onToggleWidgetActivation,
  onResetToRecommended,
  isWideCanvas = true,
  onToggleCanvasWidth,
  defaultCollapsed = true,
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
  hideCollapsedBar = false
}) => {
  // Fine-tuning panel collapsed state: DEFAULT HIDDEN (as requested)
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultCollapsed;
    const saved = localStorage.getItem("layout_finetune_collapsed");
    return saved !== null ? saved === "true" : defaultCollapsed;
  });

  const effectiveCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const handleSetCollapsed = (val: boolean) => {
    setInternalCollapsed(val);
    if (onToggleCollapse) {
      onToggleCollapse(val);
    }
    try {
      localStorage.setItem("layout_finetune_collapsed", String(val));
    } catch (e) {}
  };

  const [showDetails, setShowDetails] = useState(false);
  const [showOrderCustomizer, setShowOrderCustomizer] = useState(false);
  const [showActivationHub, setShowActivationHub] = useState(false);

  const getPresetIcon = (id: LayoutIntentType) => {
    switch (id) {
      case "comparison":
        return <Scale className="w-3.5 h-3.5" />;
      case "architecture":
        return <GitFork className="w-3.5 h-3.5" />;
      case "official_portal":
        return <ShieldCheck className="w-3.5 h-3.5" />;
      case "code_tutorial":
        return <Code className="w-3.5 h-3.5" />;
      case "fact_check":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "news_trend":
        return <TrendingUp className="w-3.5 h-3.5" />;
      case "quick_definition":
        return <Zap className="w-3.5 h-3.5" />;
      case "deep_research":
        return <FileText className="w-3.5 h-3.5" />;
      case "balanced":
      default:
        return <LayoutGrid className="w-3.5 h-3.5" />;
    }
  };

  const getWidgetIcon = (key: ResultWidgetKey) => {
    switch (key) {
      case "quick_answer":
        return <Zap className="w-4 h-4 text-amber-500" />;
      case "official_portal":
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case "takeaways":
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "metrics_telemetry":
        return <SlidersHorizontal className="w-4 h-4 text-indigo-500" />;
      case "actions_toolbox":
        return <Power className="w-4 h-4 text-emerald-500" />;
      case "topic_digest":
        return <LayoutGrid className="w-4 h-4 text-blue-500" />;
      case "ai_overview":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "mindmap":
        return <GitFork className="w-4 h-4 text-purple-500" />;
      case "comparison":
        return <Scale className="w-4 h-4 text-rose-500" />;
      case "sources":
        return <Database className="w-4 h-4 text-indigo-500" />;
      case "followup":
        return <Compass className="w-4 h-4 text-cyan-500" />;
      case "analytics_trend":
        return <TrendingUp className="w-4 h-4 text-sky-500" />;
      case "verification_checklist":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "fast_chat":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "mobile_qr":
        return <QrCode className="w-4 h-4 text-purple-500" />;
      case "agent_workflow":
        return <Sparkles className="w-4 h-4 text-violet-500" />;
      case "custom_cards":
        return <Sparkles className="w-4 h-4 text-blue-500" />;
      default:
        return <LayoutGrid className="w-4 h-4 text-zinc-500" />;
    }
  };

  const isCustomized = selectedPreset === "custom";

  // Active vs Disabled counts
  const enabledCount = enabledWidgets.length;
  const disabledCount = ALL_POSSIBLE_WIDGETS.length - enabledCount;

  // Helper to format span info for user understanding
  const getSpanLabel = (key: ResultWidgetKey) => {
    const config = currentStrategy.gridConfig?.[key];
    if (!config) return "自适应";
    return getWidgetSpanLabel(config.colSpanLg);
  };

  // 1. COLLAPSED VIEW (Default Hidden State)
  if (effectiveCollapsed) {
    if (hideCollapsedBar) {
      return null;
    }
    return (
      <div className="w-full mb-4 px-3.5 py-2 sm:py-2.5 rounded-2xl bg-white/90 dark:bg-[#1c1c1e]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_1px_6px_rgba(0,0,0,0.02)] backdrop-blur-md flex items-center justify-between gap-3 transition-all animate-in fade-in duration-200">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold select-none">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>Agent 智能排版</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
            <span>策略:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg text-[11px]">
              {isCustomized ? "自定义微调排版" : currentStrategy.intentLabel}
            </span>
          </div>

          <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>组件已自适应就绪</span>
            <span className="text-zinc-400 dark:text-zinc-500">
              ({interactionMode === "cockpit" ? "免滑动·点击模式" : "自由流瀑布流"})
            </span>
          </div>
        </div>

        {/* Expand Fine-Tuning Trigger Button */}
        <button
          type="button"
          onClick={() => handleSetCollapsed(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer select-none active:scale-95 shrink-0"
          title="点击展开排版策略、组件顺序与启停微调面板"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
          <span>展开微调</span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>
      </div>
    );
  }

  // 2. EXPANDED FULL VIEW
  return (
    <div className="w-full mb-5 rounded-3xl bg-white/90 dark:bg-[#1c1c1e]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-md overflow-hidden transition-all animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Primary Bar: Agent Auto Layout Announcement & Quick Modes */}
      <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/60">
        {/* Left: Agent Intelligence Badge & Explanation Trigger */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>Agent 智能组件排版与启停</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
            <span>策略:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {isCustomized ? "自定义微调排版" : currentStrategy.intentLabel}
            </span>
          </div>

          {/* Dynamic Activation Pill */}
          <button
            type="button"
            onClick={() => {
              setShowActivationHub(!showActivationHub);
              if (showOrderCustomizer) setShowOrderCustomizer(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 transition-all cursor-pointer"
            title="点击展开查看或管理各组件的自动启动/禁用状态"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>自适应启停管理</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showActivationHub ? "rotate-180" : ""}`} />
          </button>

          {/* Interaction Mode Switcher: Zero-Scroll Click Cockpit vs 4-Cell Free-Flow Bento */}
          {onToggleInteractionMode && (
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                type="button"
                onClick={() => onToggleInteractionMode("cockpit")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  interactionMode === "cockpit"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
                title="高效免滑动驾驶舱：搜索后页面无需上下滚动，通过顶栏横排4格与纯点击导航坞秒级切换全部研报、导图、矩阵、信源"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>⚡ 免滑动·纯点击模式</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleInteractionMode("bento")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  interactionMode === "bento"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
                title="横排最多4格 · 竖排无限瀑布流网格（卡片纵向独立堆叠，零空白缝隙）"
              >
                <Columns4 className="w-3.5 h-3.5 text-blue-500" />
                <span>📜 横4格·纵无限瀑布流</span>
              </button>
            </div>
          )}

          {/* Alignment Mode Switcher (Free-Flow Masonry vs Row Grid) when in Bento mode */}
          {interactionMode === "bento" && onToggleAlignmentMode && (
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                type="button"
                onClick={() => onToggleAlignmentMode("masonry")}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  alignmentMode === "masonry"
                    ? "bg-blue-600 text-white dark:bg-blue-500 shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
                title="真·瀑布流自由排布：卡片彻底突破统一水平线限制，按真实高度独立向上探底紧密补位，杜绝任何空白断层"
              >
                <Waves className="w-3 h-3" />
                <span>🌊 自由流 (瀑布补位)</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleAlignmentMode("grid")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  alignmentMode === "grid"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
                title="经典标准栅格：每一行卡片保持统一水平线对齐"
              >
                <Grid className="w-3 h-3" />
                <span>🧱 标准栅格 (统一对齐)</span>
              </button>
            </div>
          )}

          {/* 🧩 Smart Auto-Fill Gaps Switcher & Mode Selector */}
          {onToggleAutoFillGaps && (
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                type="button"
                onClick={() => onToggleAutoFillGaps(!autoFillGaps)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  autoFillGaps && autoFillMode !== "off"
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
                title="智能自动补位：若遇到行内未占满的空隙（不足4格/12栅格），后方合适尺寸的小卡片将自动提前调入补缺，并自适应拉伸消除视觉断层"
              >
                <Puzzle className={`w-3.5 h-3.5 ${autoFillGaps && autoFillMode !== "off" ? "text-emerald-100 animate-pulse" : "text-zinc-400"}`} />
                <span>{autoFillGaps && autoFillMode !== "off" ? "🧩 自动补位: 开启" : "🧩 自动补位: 关闭"}</span>
                {(currentStrategy.filledGapsCount ?? 0) > 0 && autoFillGaps && autoFillMode !== "off" && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-700/90 text-white dark:bg-emerald-700">
                    +{currentStrategy.filledGapsCount} 补齐
                  </span>
                )}
              </button>

              {autoFillGaps && onChangeAutoFillMode && (
                <div className="flex items-center border-l border-zinc-200 dark:border-zinc-700 pl-1 pr-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => onChangeAutoFillMode("dense")}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      autoFillMode === "dense"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                    title="稠密填补 (Dense)：向后扫描队列，智能提前调取能填满空隙的小卡片"
                  >
                    稠密装箱
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAutoFillMode("stretch")}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      autoFillMode === "stretch"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                    title="自适应拉伸 (Stretch)：保持原始顺序，由行内卡片自适应平滑拉伸吸纳剩余空间"
                  >
                    自适应拉伸
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Canvas Width Full/Standard Toggle */}
          {onToggleCanvasWidth && (
            <button
              type="button"
              onClick={onToggleCanvasWidth}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                isWideCanvas
                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
              title={isWideCanvas ? "切换为居中标准画幅 (1280px)" : "切换为全幅满屏 (卡片铺满两侧空白)"}
            >
              {isWideCanvas ? <Minimize2 className="w-3 h-3 text-purple-600 dark:text-purple-400" /> : <Maximize2 className="w-3 h-3" />}
              <span>{isWideCanvas ? "两侧已全幅铺满" : "两侧留白"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline decoration-dotted transition-colors"
            title="查看 Agent 为什么这样排版"
          >
            <Info className="w-3 h-3" />
            <span>决策依据</span>
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Right: Quick Switch Modes & Customizer Trigger */}
        <div className="flex items-center gap-1.5 flex-wrap self-end md:self-auto">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 overflow-x-auto max-w-full">
            {PRESET_LAYOUT_OPTIONS.map((opt) => {
              const isActive = selectedPreset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectPreset(opt.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                  title={opt.description}
                >
                  {getPresetIcon(opt.id)}
                  <span>{opt.label.replace("优先", "").replace("排版", "").replace(" (最多4列/行)", "")}</span>
                </button>
              );
            })}
          </div>

          {/* Toggle Activation Center Button */}
          <button
            type="button"
            onClick={() => {
              setShowActivationHub(!showActivationHub);
              if (showOrderCustomizer) setShowOrderCustomizer(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showActivationHub
                ? "bg-emerald-600 text-white border-transparent shadow-xs"
                : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60"
            }`}
            title="管理根据搜索内容自动启动/禁用的具体组件"
          >
            <Power className="w-3.5 h-3.5" />
            <span>组件启停</span>
          </button>

          {/* Toggle Order Adjuster */}
          <button
            type="button"
            onClick={() => {
              setShowOrderCustomizer(!showOrderCustomizer);
              if (showActivationHub) setShowActivationHub(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showOrderCustomizer
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs"
                : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60"
            }`}
            title="手动上下移动卡片顺序"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>顺序微调</span>
          </button>

          {/* Hide / Collapse Fine-Tuning Button */}
          <button
            type="button"
            onClick={() => handleSetCollapsed(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700 transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs"
            title="收起微调控制面板（可通过顶部导航栏「智能排版」随时重新展开）"
          >
            <EyeOff className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>收起微调</span>
            <ChevronUp className="w-3 h-3 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Expandable 1: Agent Decision Explanation */}
      {showDetails && (
        <div className="px-4 py-3 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
          <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              Agent 算法排版与启停逻辑：
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {currentStrategy.explanation}
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
              <span>首要核心板块：<strong>{getWidgetLabel(currentStrategy.emphasizedWidget)}</strong></span>
              <span>·</span>
              <span>排版模式：<strong>{alignmentMode === "masonry" ? "自适应自由流 (突破水平线约束·真瀑布流探底补位)" : "标准栅格 (传统统一水平线对齐)"}</strong></span>
              <span>·</span>
              <span>单行最大容量：<strong>4 个组件卡片 (3+3+3+3=12)</strong></span>
              <span>·</span>
              <span>智能启停机制：<strong>未命中的冗余组件自动休眠隐藏</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Expandable 2: Agent Widget Activation & Deactivation Hub (组件自动启动与禁用中枢) */}
      {showActivationHub && (
        <div className="p-4 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Agent 自主组件启停管理中心：
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                  智能自适应编排
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Agent 会在每次搜索后深度分析语义特征，自动启动契合度高的卡片，并自动休眠不适用的冗余组件。您也可以在此手动随时切换或复位。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetToRecommended}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900 transition-colors"
                title="恢复为 Agent 针对当前搜索词的自主推荐启停状态"
              >
                <RotateCcw className="w-3 h-3" />
                <span>恢复 Agent 智能推荐</span>
              </button>
            </div>
          </div>

          {/* Widget Grid with Switch Toggles and Agent Reasons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-1">
            {ALL_POSSIBLE_WIDGETS.map((key) => {
              const isEnabled = enabledWidgets.includes(key);
              const statusDetail = currentStrategy.widgetStatusMap?.[key];
              const label = getWidgetLabel(key);

              return (
                <div
                  key={key}
                  className={`flex flex-col justify-between p-3 rounded-2xl border transition-all ${
                    isEnabled
                      ? "bg-white dark:bg-zinc-800/90 border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs"
                      : "bg-zinc-100/50 dark:bg-zinc-900/40 border-dashed border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-xl ${
                        isEnabled
                          ? "bg-zinc-100 dark:bg-zinc-700/60"
                          : "bg-zinc-200/60 dark:bg-zinc-800"
                      }`}>
                        {getWidgetIcon(key)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {label}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            isEnabled
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                              : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                          }`}>
                            {isEnabled ? "已启动" : "已休眠"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    {onToggleWidgetActivation && (
                      <button
                        type="button"
                        onClick={() => onToggleWidgetActivation(key)}
                        className={`p-1 rounded-lg transition-all cursor-pointer ${
                          isEnabled
                            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            : "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                        title={isEnabled ? `点击休眠/禁用 ${label}` : `点击激活/启动 ${label}`}
                      >
                        {isEnabled ? (
                          <ToggleRight className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-zinc-400 dark:text-zinc-600" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Agent Rationale */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700/50 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 flex items-start gap-1">
                    <span className="shrink-0 mt-0.5">
                      {isEnabled ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-zinc-400 shrink-0" />
                      )}
                    </span>
                    <span className="line-clamp-2">
                      {statusDetail?.reason || (isEnabled ? "符合搜索意图，已自动启用" : "非核心需求，已休眠")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expandable 3: Card Order & Placement Customizer */}
      {showOrderCustomizer && (
        <div className="p-4 bg-zinc-50/60 dark:bg-zinc-900/40 border-b border-zinc-100 dark:border-zinc-800 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                组件排列流与板块大小自适应：
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                每调整一个组件前后位置，Agent 装箱算法将自动重算每一行的板块宽度 (最多4卡/行) 并消除空隙。
              </span>
            </div>
            <button
              type="button"
              onClick={onResetToRecommended}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>重置为 Agent 智能推荐</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {activeOrder.map((key, idx) => {
              const placement = currentStrategy.gridConfig?.[key];
              const spanLabel = getSpanLabel(key);
              const isEmphasized = key === currentStrategy.emphasizedWidget;
              const isEnabled = enabledWidgets.includes(key);

              return (
                <div
                  key={key}
                  className={`flex flex-col justify-between p-3 rounded-2xl bg-white dark:bg-zinc-800 border ${
                    isEmphasized
                      ? "border-blue-500/50 dark:border-blue-400/50 shadow-xs"
                      : "border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs"
                  } ${!isEnabled ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {getWidgetLabel(key)}
                      </span>
                      {!isEnabled && (
                        <span className="text-[10px] text-zinc-400">(休眠)</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onMoveWidget(key, "up")}
                        className={`p-1 rounded-lg transition-colors ${
                          idx === 0
                            ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        }`}
                        title="上移"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === activeOrder.length - 1}
                        onClick={() => onMoveWidget(key, "down")}
                        className={`p-1 rounded-lg transition-colors ${
                          idx === activeOrder.length - 1
                            ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        }`}
                        title="下移"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Size and Row Allocation Indicator */}
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-zinc-100 dark:border-zinc-700/60">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {placement ? `第 ${(placement.rowIndex ?? 0) + 1} 行` : "流式布局"}
                    </span>
                    <span className={`font-medium px-1.5 py-0.5 rounded text-[10px] ${
                      placement?.colSpanLg === 3
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                        : "bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300"
                    }`}>
                      {spanLabel}
                    </span>
                  </div>

                  {/* Width Selection Selector Chips */}
                  {onChangeWidgetSpan && isEnabled && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/60 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1 font-medium">
                          <Proportions className="w-3 h-3 text-blue-500" />
                          <span>宽度排列调节:</span>
                        </span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {customWidgetSpans[key] ? "自定义锁定" : "Agent 推荐"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {WIDTH_SPAN_OPTIONS.map((opt) => {
                          const isCurrentSpan = (placement?.colSpanLg || 12) === opt.span;
                          return (
                            <button
                              key={opt.span}
                              type="button"
                              onClick={() => onChangeWidgetSpan(key, opt.span)}
                              className={`px-1 py-0.5 rounded text-[10px] font-medium transition-all text-center cursor-pointer ${
                                isCurrentSpan
                                  ? "bg-blue-600 text-white shadow-2xs font-bold"
                                  : "bg-zinc-100 dark:bg-zinc-700/70 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                              }`}
                              title={opt.label}
                            >
                              {opt.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
