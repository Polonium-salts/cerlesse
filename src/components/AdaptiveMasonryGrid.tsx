import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  Sparkles, 
  RotateCcw, 
  Layers, 
  Smartphone, 
  Maximize2, 
  SlidersHorizontal,
  LayoutGrid
} from "lucide-react";
import {
  ResultWidgetKey,
  AdaptiveLayoutStrategy,
  LayoutAlignmentMode,
  AutoFillGapsMode,
  WidgetPlan,
  WidgetPlannedSize,
  CustomCardData
} from "../types.js";
import { resolveDynamicCapabilityWidgets } from "../lib/adaptiveLayout.js";
import {
  solveDesktopModularLayout,
  solveBentoLayout,
  buildBentoInputs,
  computeColumnsByWindowRatio,
  SolvedDesktopItem,
  SolvedBentoItem
} from "../lib/bentoLayoutEngine.js";

export type DesktopLayoutMode = "ios" | "android" | "fluid";

interface AdaptiveMasonryGridProps {
  strategy: AdaptiveLayoutStrategy;
  enabledWidgets: ResultWidgetKey[];
  widgetPlan?: WidgetPlan;
  customCards?: CustomCardData[];
  isWideCanvas?: boolean;
  alignmentMode?: LayoutAlignmentMode;
  autoFillGaps?: boolean;
  autoFillMode?: AutoFillGapsMode;
  renderWidget: (
    key: ResultWidgetKey, 
    isCompact?: boolean, 
    size?: WidgetPlannedSize, 
    onResize?: (nextSize: WidgetPlannedSize) => void
  ) => React.ReactNode;
  getGridClassForWidget?: (key: ResultWidgetKey, isEmphasized: boolean) => string;
}

const GRID_CONTAINER_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5"
};

/**
 * iOS & Android 桌面小组件排列引擎 (iOS / Android Desktop Modular Grid)
 *
 * 核心逻辑：
 * 1. 窗口比例自适应：根据视口长宽比与物理宽度自动在 1 ~ 5 横格间无缝伸缩自适应；
 * 2. 2D 槽位重力吸附：大号 (4x4/3x2)、中号 (4x2/2x1)、小号 (2x2/1x1) 在二维网格内无缝嵌套拼合，0 缝隙留白；
 * 3. 交互式横格数与尺寸热切换：支持在工具栏一键切换自适应/1/2/3/4/5列，以及组件上一键切换尺寸；
 * 4. 桌面排布控制栏：支持 iOS 紧凑吸附与 Android 模块化桌面排布切换。
 */
export const AdaptiveMasonryGrid: React.FC<AdaptiveMasonryGridProps> = ({
  strategy,
  enabledWidgets,
  widgetPlan,
  customCards,
  renderWidget,
  getGridClassForWidget
}) => {
  // 桌面排布风格模式: 默认 iOS 紧凑重力吸附桌面
  const [desktopMode, setDesktopMode] = useState<DesktopLayoutMode>("ios");

  // 用户自主调整的各小组件尺寸状态 (iOS 17+ 桌面组件交互调整)
  const [customSizes, setCustomSizes] = useState<Partial<Record<ResultWidgetKey, WidgetPlannedSize>>>({});

  // 用户自选或自适应的横格列数: 0 表示自适应 (根据窗口宽高比自适应 1~5 列), 1~5 表示手动锁定列数
  const [selectedCols, setSelectedCols] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const [windowMetrics, setWindowMetrics] = useState<{ width: number; height: number; ratio: number }>({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
    ratio: typeof window !== "undefined" ? Number((window.innerWidth / Math.max(window.innerHeight, 1)).toFixed(2)) : 1.6
  });

  // 监听窗口尺寸及容器尺寸变化，动态捕捉窗口比例 (Aspect Ratio)
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = Number((w / Math.max(h, 1)).toFixed(2));
      setWindowMetrics({ width: w, height: h, ratio: r });
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  // 根据当前窗口比例和物理容器宽度自动判定黄金横格数 (1 ~ 5)
  const autoColumnsInfo = useMemo(() => {
    return computeColumnsByWindowRatio(windowMetrics.width, windowMetrics.height, containerWidth);
  }, [windowMetrics, containerWidth]);

  // 当前生效的横格数 (1 ~ 5 列)
  const activeColumns = selectedCols > 0 ? selectedCols : autoColumnsInfo.columns;

  // 1. 过滤当前已激活候选组件集（若 Agent 自主锻造了独有小组件，确保自动激活）
  const activeKeys = useMemo(() => {
    const rawList = enabledWidgets && enabledWidgets.length > 0
      ? [...enabledWidgets]
      : (strategy.componentOrder && strategy.componentOrder.length > 0 
          ? [...strategy.componentOrder] 
          : resolveDynamicCapabilityWidgets(strategy.intentType || "balanced"));
    const list = rawList.filter(Boolean);
    if (customCards && customCards.length > 0 && !list.includes("custom_cards")) {
      list.unshift("custom_cards");
    }
    return list;
  }, [enabledWidgets, strategy.componentOrder, strategy.intentType, customCards]);

  // 2. 组装输入参数（合并 Agent 规划的 priority、size 以及用户的实时自定尺寸，并将 customCards 解构为独立模组）
  const bentoInputs = useMemo(() => {
    const baseInputs = buildBentoInputs({
      activeWidgets: activeKeys,
      strategy,
      plannedWidgets: widgetPlan?.widgets,
      customCards
    });

    return baseInputs.map((inp) => {
      const userSize = customSizes[inp.key];
      if (userSize) {
        return { ...inp, size: userSize };
      }
      return inp;
    });
  }, [activeKeys, strategy, widgetPlan?.widgets, customCards, customSizes]);

  // 3. 2D 模组网格装箱求解：使用基于窗口比例自适应的 activeColumns (1 ~ 5 列)
  const desktopSolution = useMemo(() => {
    return solveDesktopModularLayout(bentoInputs, activeColumns);
  }, [bentoInputs, activeColumns]);

  // 备选的 12 列流式求解
  const fluidSolution = useMemo(() => {
    return solveBentoLayout(bentoInputs, 12);
  }, [bentoInputs]);

  const hasCustomSizes = Object.keys(customSizes).length > 0;

  const handleResizeWidget = (key: ResultWidgetKey, nextSize: WidgetPlannedSize) => {
    setCustomSizes((prev) => ({
      ...prev,
      [key]: nextSize
    }));
  };

  const handleResetSizes = () => {
    setCustomSizes({});
  };

  return (
    <div className="w-full space-y-4">
      {/* iOS / Android 桌面排布工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center font-bold">
            {desktopMode === "ios" ? "" : desktopMode === "android" ? "🤖" : "📖"}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {desktopMode === "ios" ? "iOS 桌面模组" : desktopMode === "android" ? "Android 桌面模组" : "流式全宽"}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              <span>{selectedCols === 0 ? "自适应" : "锁定"} {activeColumns} 横格</span>
              <span className="text-zinc-400 dark:text-zinc-500">·</span>
              <span>比例 {windowMetrics.ratio} ({autoColumnsInfo.ratioLabel})</span>
              <span className="text-zinc-400 dark:text-zinc-500">·</span>
              <span>{desktopSolution.totalRows} 行模组</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 1~5 横格列数快速切换器 */}
          {desktopMode !== "fluid" && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-[11px]">
              <button
                onClick={() => setSelectedCols(0)}
                title={`跟随窗口比例自适应 (当前: ${autoColumnsInfo.columns} 格)`}
                className={`px-2 py-0.8 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedCols === 0
                    ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <span>自适应({autoColumnsInfo.columns}格)</span>
              </button>
              {[1, 2, 3, 4, 5].map((col) => (
                <button
                  key={col}
                  onClick={() => setSelectedCols(col)}
                  title={`强制锁定为 ${col} 列模组`}
                  className={`px-1.5 py-0.8 rounded-lg font-medium transition-all cursor-pointer ${
                    selectedCols === col
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>{col}格</span>
                </button>
              ))}
            </div>
          )}

          {/* 模式切换器 */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50">
            <button
              onClick={() => setDesktopMode("ios")}
              title="iOS 紧凑吸附桌面 (2x2 / 4x2 / 4x4 自由嵌套)"
              className={`px-2 py-0.8 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                desktopMode === "ios"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span> iOS</span>
            </button>
            <button
              onClick={() => setDesktopMode("android")}
              title="Android Material 模组平铺对齐"
              className={`px-2 py-0.8 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                desktopMode === "android"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>🤖 Android</span>
            </button>
            <button
              onClick={() => setDesktopMode("fluid")}
              title="沉浸式流式排布"
              className={`px-2 py-0.8 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                desktopMode === "fluid"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>流式</span>
            </button>
          </div>

          {/* 重置自定义尺寸按钮 */}
          {hasCustomSizes && (
            <button
              onClick={handleResetSizes}
              className="px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
              title="还原为 Agent 推荐的黄金尺寸"
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span>还原推荐</span>
            </button>
          )}
        </div>
      </div>

      {/* 2D 模组桌面网格容器 (iOS / Android Springboard) */}
      {desktopMode !== "fluid" ? (
        <div 
          ref={containerRef}
          className={`grid ${GRID_CONTAINER_CLASS[activeColumns] || "grid-cols-4"} auto-rows-auto gap-4.5 items-stretch w-full grid-flow-dense`}
        >
          {desktopSolution.items.map((item: SolvedDesktopItem) => {
            const spanClass = item.gridClass;

            return (
              <motion.div
                key={item.key}
                layout="position"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`relative group flex flex-col min-w-0 ${spanClass} transition-all`}
              >
                {/* 焦点标识 */}
                {item.isEmphasized && (
                  <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 backdrop-blur-sm text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/30 shadow-2xs">
                      <Sparkles className="w-2.5 h-2.5 text-blue-500 animate-pulse" />
                      <span>聚焦</span>
                    </div>
                  </div>
                )}

                {/* 悬浮 iOS / Android 尺寸快捷切换把手 */}
                <div className="absolute top-2.5 left-2.5 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-white/90 dark:bg-zinc-850/90 backdrop-blur-md rounded-lg p-0.5 border border-zinc-200/80 dark:border-zinc-700/80 shadow-md flex items-center gap-0.5 text-[9px] font-mono">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeWidget(item.key, "small"); }}
                    title="切换为 2x2 小号方块"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "small" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    2x2
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeWidget(item.key, "medium"); }}
                    title="切换为 4x2 中号横条"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "medium" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    4x2
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeWidget(item.key, "large"); }}
                    title="切换为 4x4 大号方块"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "large" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    4x4
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeWidget(item.key, "full"); }}
                    title="切换为 4x8 全宽横幅"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "full" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    全宽
                  </button>
                </div>

                {renderWidget(item.key, item.isCompact, item.size, (s) => handleResizeWidget(item.key, s))}
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* 流式模式 */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start auto-rows-auto w-full">
          {fluidSolution.items.map((item: SolvedBentoItem) => {
            return (
              <motion.div
                key={item.key}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`${item.gridClass} flex flex-col min-w-0 self-start transition-all`}
              >
                {renderWidget(item.key, item.isCompact, item.size, (s) => handleResizeWidget(item.key, s))}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
