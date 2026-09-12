import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  RotateCcw, 
  Store, 
  LayoutGrid, 
  Check, 
  SlidersHorizontal,
  Smartphone,
  Layers,
  Trash2,
  BookmarkCheck
} from "lucide-react";
import {
  ResultWidgetKey,
  AdaptiveLayoutStrategy,
  WidgetPlan,
  WidgetPlannedSize,
  CustomCardData,
  SearchSynthesisResult
} from "../../types.js";
import {
  solveTileLayout,
  saveDesktopState,
  loadDesktopState,
  clearDesktopState,
  TileSize,
  SolvedTileItem,
  TileLayoutInput
} from "../../lib/tileLayoutEngine.js";
import { WidgetRegistry } from "../../widgets/registry.js";
import { WidgetRuntime } from "../../widgets/runtime.js";
import { resolveDynamicCapabilityWidgets } from "../../lib/adaptiveLayout.js";

interface TileDesktopViewProps {
  strategy: AdaptiveLayoutStrategy;
  enabledWidgets: ResultWidgetKey[];
  widgetPlan?: WidgetPlan;
  customCards?: CustomCardData[];
  activeResult: SearchSynthesisResult;
  isWideCanvas?: boolean;
  onOpenMarketplace: () => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  onOpenForgeModal?: (sourceIds?: string[]) => void;
  onNavigateTab?: (tab: "bento" | "mindmap" | "comparison" | "sources" | "reasoning") => void;
  onUpdateCard?: (updated: CustomCardData) => void;
  onDeleteCard?: (id: string) => void;
}

export const TileDesktopView: React.FC<TileDesktopViewProps> = ({
  strategy,
  enabledWidgets,
  widgetPlan,
  customCards = [],
  activeResult,
  onOpenMarketplace,
  onExecuteSearch,
  onOpenForgeModal,
  onNavigateTab,
  onUpdateCard,
  onDeleteCard
}) => {
  // 用户自定尺寸映射表
  const [userSizes, setUserSizes] = useState<Record<string, TileSize>>({});
  // 用户移除的小组件集合
  const [hiddenTileIds, setHiddenTileIds] = useState<Set<string>>(new Set());
  // 已保存提示 Toast 状态
  const [showSavedToast, setShowSavedToast] = useState(false);
  // 当前列数模式: 0 表示自适应 12 列 (大屏 12, 平板 6, 移动 4), 或手动指定 12 / 6 / 4
  const [selectedCols, setSelectedCols] = useState<number>(0);
  // 容器物理宽度监听
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1280);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, []);

  // 自适应计算当前生效列数 (12, 6, 4)
  const activeColumns = useMemo(() => {
    if (selectedCols > 0) return selectedCols;
    if (containerWidth >= 960) return 12;
    if (containerWidth >= 580) return 6;
    return 4;
  }, [selectedCols, containerWidth]);

  // 1. 整理当前待呈现在桌面的组件 ID 列表
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

  // 2. 组装 TileLayoutInput 数组（解构 customCards，映射 Agent Planner 推荐与用户尺寸）
  const tileInputs: TileLayoutInput[] = useMemo(() => {
    const plannedMap = new Map(widgetPlan?.widgets?.map(pw => [pw.type, pw]) || []);
    const inputs: TileLayoutInput[] = [];

    for (const key of activeKeys) {
      if (key === "custom_cards") {
        customCards.forEach((card, idx) => {
          const cardKey = `custom_card__${card.id}`;
          if (hiddenTileIds.has(cardKey) || hiddenTileIds.has(card.id)) return;
          
          let size: TileSize = userSizes[cardKey] || userSizes[card.id] || (
            card.archetype === "timeline" || card.archetype === "parameter_matrix" 
              ? "large" 
              : "medium"
          );

          inputs.push({
            id: cardKey,
            size,
            priority: 110 - idx * 5,
            isEmphasized: idx === 0
          });
        });
        continue;
      }

      if (hiddenTileIds.has(String(key))) continue;

      const planned = plannedMap.get(key);
      const isEmphasized = key === strategy.emphasizedWidget || key === strategy.layoutPlan?.featured;
      let priority = (planned?.priority ?? 50) + (isEmphasized ? 50 : 0);

      // 确定尺寸
      let size: TileSize = userSizes[String(key)] || (planned?.size as TileSize) || "medium";
      if (key === "ai_overview" && !userSizes[String(key)]) {
        size = "large";
      } else if ((key === "weather" || key === "stock" || key === "metrics_telemetry") && !userSizes[String(key)]) {
        size = "small";
      }

      inputs.push({
        id: String(key),
        size,
        priority,
        isEmphasized
      });
    }

    return inputs;
  }, [activeKeys, customCards, hiddenTileIds, userSizes, widgetPlan?.widgets, strategy]);

  // 3. 调用 TileLayoutEngine 二维装箱求解
  const layoutSolution = useMemo(() => {
    return solveTileLayout(tileInputs, activeColumns);
  }, [tileInputs, activeColumns]);

  // 处理尺寸切换
  const handleResizeTile = (id: string, nextSize: TileSize) => {
    setUserSizes(prev => ({
      ...prev,
      [id]: nextSize
    }));
  };

  // 处理隐藏/移除磁贴
  const handleRemoveTile = (id: string) => {
    setHiddenTileIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // 还原 Agent 黄金尺寸与排版
  const handleResetToAgentLayout = () => {
    setUserSizes({});
    setHiddenTileIds(new Set());
    clearDesktopState();
  };

  // 保存当前桌面布局到本地
  const handleSaveDesktop = () => {
    saveDesktopState(layoutSolution.items);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  // 渲染单个磁贴内容
  const renderTileContent = (item: SolvedTileItem) => {
    // 若为自定义卡片
    if (item.id.startsWith("custom_card__")) {
      const cardId = item.id.replace("custom_card__", "");
      const card = customCards.find(c => c.id === cardId);
      if (!card) return null;

      const cardModule = WidgetRegistry.get(item.id) 
        || WidgetRegistry.registerCustomCard(card, {
            onUpdateCard,
            onDeleteCard
          });

      return (
        <WidgetRuntime
          key={item.id}
          module={cardModule}
          activeResult={activeResult}
          size={item.size}
          isCompact={item.size === "small"}
          onResize={(s) => handleResizeTile(item.id, s as TileSize)}
          onExecuteSearch={onExecuteSearch}
        />
      );
    }

    // 官方或已注册模块
    const widgetModule = WidgetRegistry.get(item.id);
    if (!widgetModule) {
      return (
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-400">
          未注册小组件 [{item.id}]
        </div>
      );
    }

    // 注入上下文操作
    const boundModule = {
      ...widgetModule,
      actions: {
        ...(widgetModule.actions || {}),
        openMindMap: () => onNavigateTab?.("mindmap"),
        openComparison: () => onNavigateTab?.("comparison"),
        openForgeModal: (sourceIds?: string[]) => onOpenForgeModal?.(sourceIds),
        forgeCardFromSource: (sourceId: string) => onOpenForgeModal?.([sourceId]),
        reSearch: () => onExecuteSearch?.(activeResult.query, true)
      }
    };

    return (
      <WidgetRuntime
        key={item.id}
        module={boundModule}
        activeResult={activeResult}
        size={item.size}
        isCompact={item.size === "small"}
        onResize={(s) => handleResizeTile(item.id, s as TileSize)}
        onExecuteSearch={onExecuteSearch}
      />
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* 桌面控制台总线 (Desktop Control Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* OS 标识图标 */}
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black shadow-xs">
            ⊞
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              Live Tile 桌面系统
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
              <span>{activeColumns} 栅格列</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>{layoutSolution.items.length} 磁贴</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>{layoutSolution.totalRows} 物理行</span>
            </span>
          </div>
        </div>

        {/* 右侧桌面控制动作 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 列数切换 */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-[11px]">
            <button
              onClick={() => setSelectedCols(0)}
              title="根据视口宽度自适应栅格数"
              className={`px-2 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                selectedCols === 0
                  ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              自适应
            </button>
            <button
              onClick={() => setSelectedCols(12)}
              title="锁定 12 列原生 Windows Phone 桌面栅格"
              className={`px-2 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                selectedCols === 12
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              12列
            </button>
            <button
              onClick={() => setSelectedCols(6)}
              title="锁定 6 列紧凑平板栅格"
              className={`px-2 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                selectedCols === 6
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              6列
            </button>
          </div>

          {/* 打开磁贴商店 */}
          <button
            onClick={onOpenMarketplace}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Store className="w-3.5 h-3.5" />
            <span>小组件商店</span>
          </button>

          {/* 还原 Agent 推荐 */}
          {(Object.keys(userSizes).length > 0 || hiddenTileIds.size > 0) && (
            <button
              onClick={handleResetToAgentLayout}
              className="px-2.5 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
              title="还原为 AI Agent 推荐的黄金布局与磁贴尺寸"
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span>还原推荐</span>
            </button>
          )}

          {/* 保存桌面 */}
          <button
            onClick={handleSaveDesktop}
            className="px-2.5 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
            title="将当前桌面磁贴布局保存到本地"
          >
            {showSavedToast ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <BookmarkCheck className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>{showSavedToast ? "已保存桌面" : "保存桌面"}</span>
          </button>
        </div>
      </div>

      {/* 核心 12 栅格 Live Tile 二维桌面容器 */}
      <div
        ref={containerRef}
        className={`w-full grid ${
          activeColumns === 12
            ? "grid-cols-12"
            : activeColumns === 6
            ? "grid-cols-6"
            : "grid-cols-4"
        } gap-4.5 items-stretch`}
        style={{
          gridAutoFlow: "dense"
        }}
      >
        <AnimatePresence>
          {layoutSolution.items.map((item) => {
            return (
              <motion.div
                key={item.id}
                layout="position"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                style={{
                  gridColumn: item.gridStyle.gridColumn,
                  gridRow: item.gridStyle.gridRow
                }}
                className="relative group flex flex-col min-w-0 transition-all rounded-3xl"
              >
                {/* 聚焦发光标 */}
                {item.isEmphasized && (
                  <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 backdrop-blur-md text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/30 shadow-2xs">
                      <Sparkles className="w-2.5 h-2.5 text-blue-500 animate-pulse" />
                      <span>焦点</span>
                    </div>
                  </div>
                )}

                {/* 磁贴悬浮快捷工具把手 (尺寸切换 + 移除) */}
                <div className="absolute top-2.5 left-2.5 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-white/95 dark:bg-zinc-850/95 backdrop-blur-md rounded-xl p-0.5 border border-zinc-200/80 dark:border-zinc-700/80 shadow-md flex items-center gap-0.5 text-[9px] font-mono">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeTile(item.id, "small"); }}
                    title="切换为 2x2 正方小磁贴"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "small" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    2x2
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeTile(item.id, "medium"); }}
                    title="切换为 4x2 标准横条"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "medium" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    4x2
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeTile(item.id, "wide"); }}
                    title="切换为 6x2 宽条磁贴"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "wide" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    6x2
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeTile(item.id, "large"); }}
                    title="切换为 4x4 正方大磁贴"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "large" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    4x4
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResizeTile(item.id, "full"); }}
                    title="切换为 12 栅格全宽横幅"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      item.size === "full" 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold" 
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    全宽
                  </button>

                  <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

                  {/* 移除磁贴按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveTile(item.id); }}
                    title="从桌面卸载此磁贴"
                    className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* 磁贴实际视图渲染 */}
                {renderTileContent(item)}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
