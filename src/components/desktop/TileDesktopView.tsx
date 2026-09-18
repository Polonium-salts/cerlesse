import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trash2,
  ArrowLeftRight,
  GripVertical
} from "lucide-react";
import {
  ResultWidgetKey,
  AdaptiveLayoutStrategy,
  WidgetPlan,
  SearchSynthesisResult
} from "../../types.js";
import {
  solveTileLayout,
  TileWidth,
  TileLayoutInput,
  TILE_COLUMN_GAP_PX,
  TILE_ROW_GAP_PX,
  TILE_ROW_UNIT_PX,
  ARCHETYPE_RATIOS,
  resolveTileRatio,
  tileWidthFromSpan,
  tileWidthFromPlannedSize,
  spanOfTileWidth
} from "../../lib/tileLayoutEngine.js";
import { MANIFEST_MIN_WIDTHS } from "../../widgets/manifests/index.js";
import { WidgetRegistry } from "../../widgets/registry.js";
import { WidgetRuntime } from "../../widgets/runtime.js";
import { resolveDynamicCapabilityWidgets } from "../../lib/adaptiveLayout.js";
import { MuuriWidgetGrid, MuuriWidgetItem } from "./MuuriWidgetGrid.js";
import { Button } from "../ui/button.js";

interface TileDesktopViewProps {
  strategy: AdaptiveLayoutStrategy;
  enabledWidgets: ResultWidgetKey[];
  widgetPlan?: WidgetPlan;
  activeResult: SearchSynthesisResult;
  isWideCanvas?: boolean;
  onOpenMarketplace?: () => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  onNavigateTab?: (tab: "bento" | "images" | "mindmap" | "comparison" | "sources" | "reasoning") => void;
}

export const TileDesktopView: React.FC<TileDesktopViewProps> = ({
  strategy,
  enabledWidgets,
  widgetPlan,
  activeResult,
  onExecuteSearch,
  onNavigateTab
}) => {
  // 左右换位偏好：针对 75% 与 25% 互补小组件，支持在行内左侧或右侧互补对调
  const [userSides, setUserSides] = useState<Record<string, "left" | "right">>({});
  // 用户移除的小组件集合
  const [hiddenTileIds, setHiddenTileIds] = useState<Set<string>>(new Set());
  // 容器物理宽度监听
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1280);

  // 规则：一次性显示所有内容无需手动向下滑动查看隐藏内容
  // 测量并存储每个小组件完整展示所需要的自然高度
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const tileRefs = useRef<Map<string, HTMLElement>>(new Map());

  // 注册中心补全版本号
  const [registryRevision] = useState(0);

  /** 解析小组件模块；registryRevision 参与解析，手动补全后即可重新命中 */
  const resolveWidgetModule = (id: string) => {
    void registryRevision;
    return WidgetRegistry.get(id);
  };

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

  // 自适应计算当前生效列数 (大屏 12, 平板 6, 手机 4)
  const activeColumns = useMemo(() => {
    if (containerWidth >= 960) return 12;
    if (containerWidth >= 580) return 6;
    return 4;
  }, [containerWidth]);

  /**
   * 磁贴的最小可用跨度
   */
  const minSpanFor = (id: string, width: TileWidth) => {
    const declared = MANIFEST_MIN_WIDTHS[id];
    if (typeof declared === "number") return spanOfTileWidth(declared, activeColumns);
    return Math.max(2, spanOfTileWidth(width, activeColumns) - 1);
  };

  // 当外部传入的 enabledWidgets 更新（如从小组件商店重新添加，或新任务点名启用）时，
  // 自动从隐藏集合中移出对应小组件，确保其能够重新渲染显示
  useEffect(() => {
    if (enabledWidgets && enabledWidgets.length > 0) {
      setHiddenTileIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of enabledWidgets) {
          if (next.has(String(id))) {
            next.delete(String(id));
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [enabledWidgets]);

  // 1. 整理当前待呈现在桌面的组件 ID 列表（严格根据 Agent 检索与重排决策呈现，杜绝前端私自正则增删组件）
  const activeKeys = useMemo(() => {
    // 优先采用 Agent 规划并验证后的小组件序列
    const rawList = enabledWidgets && enabledWidgets.length > 0
      ? [...enabledWidgets]
      : (widgetPlan?.widgetOrder && widgetPlan.widgetOrder.length > 0
          ? [...widgetPlan.widgetOrder]
          : (strategy.componentOrder && strategy.componentOrder.length > 0 
              ? [...strategy.componentOrder] 
              : resolveDynamicCapabilityWidgets(strategy.intentType || "balanced")));
    let list = [...rawList.filter(Boolean)];
    const query = (activeResult?.query || "").trim().toLowerCase();

    // 核心结论要点：只有存在真实 keyTakeaways 时才保留（防空壳）
    const hasTakeaways = Boolean(activeResult.keyTakeaways && activeResult.keyTakeaways.length > 0);
    if (!hasTakeaways) {
      list = list.filter(k => k !== "takeaways");
    }

    // 过滤用户已显式隐藏的组件，并确保注册中心有对应模块
    const visibleList = list.filter(k => !hiddenTileIds.has(String(k)));
    const uniqueKeys = Array.from(new Set(visibleList));
    return uniqueKeys.filter((k) => Boolean(resolveWidgetModule(String(k))));
  }, [enabledWidgets, strategy.componentOrder, strategy.intentType, registryRevision, hiddenTileIds, activeResult.keyTakeaways, activeResult.query, widgetPlan]);

  // 监听各个小组件实际内容高度，当内容变化时自动扩充磁贴高度以一次性显示全部内容
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      let changed = false;
      const updates: Record<string, number> = {};

      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const id = target.getAttribute("data-tile-measure-id");
        if (!id) continue;

        // 获取组件内容的自然总高度（包含卡片所有内容与外层尺寸，如真实渲染高度），保证各个小组件均能获得准确物理高度
        const scrollH = target.scrollHeight;
        const clientH = target.clientHeight;
        const offsetH = target.offsetHeight;
        const naturalH = Math.ceil(Math.max(scrollH, clientH, offsetH));

        if (naturalH > 0) {
          updates[id] = naturalH;
          changed = true;
        }
      }

      if (changed) {
        setContentHeights((prev) => {
          let hasDiff = false;
          const next = { ...prev };
          for (const [id, h] of Object.entries(updates)) {
            if (Math.abs((prev[id] || 0) - h) > 4) {
              next[id] = h;
              hasDiff = true;
            }
          }
          return hasDiff ? next : prev;
        });
      }
    });

    tileRefs.current.forEach((el) => {
      ro.observe(el);
    });

    return () => ro.disconnect();
  }, [activeKeys]);

  // 2. 小组件排版 Agent 排版决策
  const layoutDecision = strategy.layoutAgentDecision;
  const agentSpans = useMemo<Partial<Record<string, number>>>(() => {
    const raw = { ...(strategy.customWidgetSpans || {}), ...(layoutDecision?.spans || {}) };
    if (raw.image_gallery !== undefined) {
      raw.image_gallery = 9;
    }
    return raw;
  }, [strategy.customWidgetSpans, layoutDecision?.spans]);
  const agentFocusKey = layoutDecision?.emphasizedWidget || strategy.emphasizedWidget;

  // 3. 组装 TileLayoutInput 数组（图片小组件固定 75% 宽度，比例严格固定）
  const tileInputs: TileLayoutInput[] = useMemo(() => {
    const plannedMap = new Map(widgetPlan?.widgets?.map(pw => [pw.type, pw]) || []);
    const inputs: TileLayoutInput[] = [];

    for (const key of activeKeys) {
      if (hiddenTileIds.has(String(key))) continue;

      const planned = plannedMap.get(key);
      const keyStr = String(key);
      const module = resolveWidgetModule(keyStr);
      if (!module) continue;
      const isEmphasized = key === agentFocusKey || key === strategy.layoutPlan?.featured;
      const priority = (planned?.priority ?? 50) + (isEmphasized ? 30 : 0);

      // 尺寸决策：优先采用用户/Agent 动态 Span 设定，其次为 Agent 规划尺寸，兜底为组件模块默认宽度
      const plannedSize = tileWidthFromPlannedSize(planned?.size);
      const agentSpanSize = tileWidthFromSpan(agentSpans[keyStr]);
      const moduleSize = module?.width;
      const size: TileWidth = agentSpanSize || plannedSize || moduleSize || 50;

      const measuredHeight = contentHeights[keyStr];

      inputs.push({
        id: keyStr,
        size,
        preferredSide: userSides[keyStr],
        priority,
        isEmphasized,
        contentHeightPx: measuredHeight,
        minSpan: keyStr === "image_gallery" ? spanOfTileWidth(75, activeColumns) : minSpanFor(keyStr, size)
      });
    }

    return inputs;
  }, [
    activeKeys,
    widgetPlan,
    agentSpans,
    agentFocusKey,
    strategy.layoutPlan?.featured,
    hiddenTileIds,
    userSides,
    activeColumns,
    contentHeights
  ]);

  // 4. 调用 TileLayoutEngine 二维装箱求解（固定比例求解）
  const layoutSolution = useMemo(() => {
    return solveTileLayout(tileInputs, {
      totalColumns: activeColumns,
      containerWidth,
      columnGap: TILE_COLUMN_GAP_PX,
      rowGap: TILE_ROW_GAP_PX
    });
  }, [tileInputs, activeColumns, containerWidth]);

  // 处理隐藏/移除磁贴
  const handleRemoveTile = (id: string) => {
    setHiddenTileIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // 切换磁贴在行内的偏好侧（在左侧或右侧互换）
  const handleToggleTileSide = (id: string) => {
    setUserSides(prev => {
      const current = prev[id];
      const nextSide = current === "left" ? "right" : "left";
      return {
        ...prev,
        [id]: nextSide
      };
    });
  };

  // 桌面布局引擎选择："muuri" (Muuri 动态交叉回填引擎) | "skyline" (2D Skyline 装箱引擎)
  const [layoutEngine] = useState<"muuri" | "skyline">("muuri");

  // Muuri 拖拽与排序控制
  const [muuriDragEnabled] = useState<boolean>(true);
  const [muuriDragAction] = useState<"move" | "swap">("move");
  const [customMuuriOrder, setCustomMuuriOrder] = useState<string[]>([]);

  // 拖拽排序后更新顺序
  const handleMuuriOrderChange = (newOrder: string[]) => {
    setCustomMuuriOrder(newOrder);
  };

  // 渲染单个磁贴内容
  const renderTileContentById = (id: string, size: TileWidth) => {
    // 官方或已注册模块
    const widgetModule = resolveWidgetModule(id);
    if (!widgetModule) {
      return null;
    }

    const boundModule = {
      ...widgetModule,
      actions: {
        ...(widgetModule.actions || {}),
        openMindMap: () => onNavigateTab?.("mindmap"),
        openComparison: () => onNavigateTab?.("comparison"),
        reSearch: () => onExecuteSearch?.(activeResult.query, true)
      }
    };

    return (
      <WidgetRuntime
        key={id}
        module={boundModule}
        activeResult={activeResult}
        size={size}
        isCompact={size === 25}
        onResize={undefined}
        onExecuteSearch={onExecuteSearch}
      />
    );
  };

  // Muuri 磁贴项列表 (带拖拽手柄与卡片内容包装)
  const muuriItems: MuuriWidgetItem[] = useMemo(() => {
    const rawItems = tileInputs.map((input) => ({
      id: input.id,
      size: input.size,
      priority: input.priority,
      node: (
        <div className="relative group flex flex-col min-w-0 transition-all rounded-2xl md:rounded-3xl h-full shadow-sm hover:shadow-md border border-border/40 bg-card overflow-hidden">
          {/* 拖拽排序把手 */}
          {muuriDragEnabled && (
            <div
              className="muuri-drag-handle absolute top-2.5 left-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-foreground shadow-xs flex items-center justify-center"
              title="按住拖拽调整小组件位置"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}

          {/* 75% 与 25% 互补磁贴左右排位切换把手 */}
          {(input.size === 75 || input.size === 25) && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTileSide(input.id);
              }}
              title="将互补组件切换至左/右对调排列"
              className="absolute top-2.5 right-10 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-primary rounded-xl shadow-xs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* 磁贴卸载把手 */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveTile(input.id);
            }}
            title="从桌面卸载此磁贴"
            className="absolute top-2.5 right-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-destructive rounded-xl shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>

          {/* 磁贴视图内容 */}
          <div
            ref={(el) => {
              if (el) {
                tileRefs.current.set(input.id, el);
              } else {
                tileRefs.current.delete(input.id);
              }
            }}
            data-tile-measure-id={input.id}
            className="h-full flex flex-col [&>*]:flex-1"
          >
            {renderTileContentById(input.id, input.size)}
          </div>
        </div>
      )
    }));

    // 若存在用户拖拽产生的自定义顺序，优先遵循自定义顺序
    if (customMuuriOrder && customMuuriOrder.length > 0) {
      const orderMap = new Map<string, number>();
      customMuuriOrder.forEach((id, idx) => orderMap.set(id, idx));
      return [...rawItems].sort((a, b) => {
        const idxA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
        const idxB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
        return idxA - idxB;
      });
    }

    return rawItems;
  }, [tileInputs, activeResult, customMuuriOrder, muuriDragEnabled, onNavigateTab, onExecuteSearch]);

  return (
    <div className="w-full">
      {/* 桌面磁贴网格主体 */}
      {layoutEngine === "muuri" ? (
        <MuuriWidgetGrid
          items={muuriItems}
          fillGaps={true}
          dragEnabled={muuriDragEnabled}
          dragHandle=".muuri-drag-handle"
          dragSortAction={muuriDragAction}
          onOrderChange={handleMuuriOrderChange}
          columnGapPx={TILE_COLUMN_GAP_PX}
          rowGapPx={TILE_ROW_GAP_PX}
        />
      ) : (
        /* 核心 12 栅格 Live Tile 二维桌面容器 (Skyline 2D) */
        <div
          ref={containerRef}
          className={`w-full grid ${
            activeColumns === 12
              ? "grid-cols-12"
              : activeColumns === 6
              ? "grid-cols-6"
              : "grid-cols-4"
          }`}
          style={{
            gridAutoFlow: "dense",
            columnGap: `${TILE_COLUMN_GAP_PX}px`,
            rowGap: "0px",
            gridAutoRows: `${TILE_ROW_UNIT_PX}px`
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
                    gridRow: item.gridStyle.gridRow,
                    minHeight: `${item.pixelHeight}px`,
                    alignSelf: "start"
                  }}
                  className="relative group flex flex-col min-w-0 transition-all rounded-2xl md:rounded-3xl"
                >
                  {/* 75% 与 25% 互补磁贴左右排位切换把手 */}
                  {(item.size === 75 || item.size === 25) && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTileSide(item.id);
                      }}
                      title="将互补组件切换至左/右对调排列"
                      className="absolute top-2.5 right-10 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-primary rounded-xl shadow-xs"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {/* 磁贴卸载把手 */}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => { e.stopPropagation(); handleRemoveTile(item.id); }}
                    title="从桌面卸载此磁贴"
                    className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-destructive rounded-xl shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>

                  {/* 磁贴实际视图渲染 */}
                  <div
                    ref={(el) => {
                      if (el) {
                        tileRefs.current.set(item.id, el);
                      } else {
                        tileRefs.current.delete(item.id);
                      }
                    }}
                    data-tile-measure-id={item.id}
                    className="h-full flex flex-col [&>*]:flex-1"
                  >
                    {renderTileContentById(item.id, item.size)}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
