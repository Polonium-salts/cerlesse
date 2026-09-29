import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trash2,
  ArrowLeftRight,
  GripVertical,
  Sparkles,
  Lock,
  Unlock,
  Maximize2,
  Minimize2
} from "lucide-react";
import {
  ResultWidgetKey,
  AdaptiveLayoutStrategy,
  WidgetPlan,
  SearchSynthesisResult
} from "../../types.js";
import {
  solveTileLayout,
  packTiles,
  type PackInput,
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
import { MANIFEST_MIN_WIDTHS, MANIFEST_ITEM_HEIGHTS } from "../../widgets/manifests/index.js";
import { WidgetRegistry } from "../../widgets/registry.js";
import { WidgetRuntime } from "../../widgets/runtime.js";
import { resolveDynamicCapabilityWidgets } from "../../lib/adaptiveLayout.js";
import { evaluateWidgetApplicability } from "../../widgets/applicability.js";
import { WIDGET_ACTIVATION_POLICY, isAlwaysOnWidget } from "../../widgets/widgetContract.js";
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

const USER_OVERRIDES_KEY = "cerlesse_tile_user_overrides_v1";

export const TileDesktopView: React.FC<TileDesktopViewProps> = ({
  strategy,
  enabledWidgets,
  widgetPlan,
  activeResult,
  onExecuteSearch,
  onNavigateTab
}) => {
  // 用户持久化手动调整的尺寸覆盖
  const [userOverrides, setUserOverrides] = useState<Record<string, { size: TileWidth }>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(USER_OVERRIDES_KEY) : null;
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  // 左右换位偏好：针对 75% 与 25% 互补小组件，支持在行内左侧或右侧互补对调
  const [userSides, setUserSides] = useState<Record<string, "left" | "right">>({});
  // 用户移除的小组件集合
  const [hiddenTileIds, setHiddenTileIds] = useState<Set<string>>(new Set());
  // 锁定布局：锁定后 Agent 后续更新不改变磁贴位置和尺寸 (Section 4.9)
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(false);
  // 局部展开超长磁贴集合 (Section 4.2)
  const [expandedTileIds, setExpandedTileIds] = useState<Set<string>>(new Set());
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

    // 过滤用户已显式隐藏的组件及适用性网关未通过的组件
    const visibleList = list.filter(k => {
      if (hiddenTileIds.has(String(k))) return false;
      const app = evaluateWidgetApplicability(k, activeResult?.query, activeResult);
      return app.applicable;
    });

    // 将 sources 归一化为 related_links（信源存证与网站直达合并为一个组件，杜绝重复渲染）
    const canonicalized = visibleList.map(k => (String(k) === "sources" ? "related_links" : k) as ResultWidgetKey);
    const uniqueKeys = Array.from(new Set(canonicalized));

    // 确保信源存证与网站直达 (related_links) 永远排在第 1 位
    const targetIdx = uniqueKeys.indexOf("related_links");
    if (targetIdx > 0) {
      uniqueKeys.splice(targetIdx, 1);
      uniqueKeys.unshift("related_links");
    } else if (targetIdx < 0 && isAlwaysOnWidget("related_links")) {
      uniqueKeys.unshift("related_links");
    }

    return uniqueKeys;
  }, [enabledWidgets, strategy.componentOrder, strategy.intentType, registryRevision, hiddenTileIds, activeResult.keyTakeaways, activeResult.query, activeResult, widgetPlan]);


  // 4.6 防抖动的高度测量：120ms 防抖 + requestAnimationFrame 合并 + 量化 rowSpan 迟滞过滤
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      const updates: Record<string, number> = {};

      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const id = target.getAttribute("data-tile-measure-id");
        if (!id) continue;

        // 获取组件内容的自然真实高度（含背面最大值）
        const scrollH = target.scrollHeight;
        const offsetH = target.offsetHeight;
        const naturalH = Math.ceil(Math.max(scrollH, offsetH));

        if (naturalH > 0 && naturalH < 2400) {
          updates[id] = naturalH;
        }
      }

      if (Object.keys(updates).length === 0) return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          setContentHeights((prev) => {
            let hasDiff = false;
            const next = { ...prev };
            for (const [id, h] of Object.entries(updates)) {
              const oldH = prev[id] || 0;
              // 迟滞：仅当量化后的 rowSpan 单位发生变化才触发重排
              const oldRows = Math.ceil(oldH / TILE_ROW_UNIT_PX);
              const newRows = Math.ceil(h / TILE_ROW_UNIT_PX);
              if (oldRows !== newRows || Math.abs(oldH - h) >= TILE_ROW_UNIT_PX) {
                next[id] = h;
                hasDiff = true;
              }
            }
            return hasDiff ? next : prev;
          });
        });
      }, 120);
    });

    tileRefs.current.forEach((el, id) => {
      if (evaluateWidgetApplicability(id, activeResult?.query, activeResult).applicable) {
        ro.observe(el);
      }
    });

    return () => {
      ro.disconnect();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [activeKeys, activeResult]);

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
      const keyStr = String(key);
      const app = evaluateWidgetApplicability(keyStr, activeResult?.query, activeResult);
      if (!app.applicable) continue;

      const planned = plannedMap.get(key);
      const module = resolveWidgetModule(keyStr);
      const isEmphasized = key === agentFocusKey || key === strategy.layoutPlan?.featured;
      const priority = (planned?.priority ?? 50) + (isEmphasized ? 30 : 0);

      // 尺寸决策：用户显式手动调整的尺寸最高优先；其次为用户/Agent 动态 Span 设定，再为 Agent 规划尺寸，兜底为组件模块默认宽度
      const userOverriddenSize = userOverrides[keyStr]?.size;
      const plannedSize = tileWidthFromPlannedSize(planned?.size);
      const agentSpanSize = tileWidthFromSpan(agentSpans[keyStr]);
      const moduleSize = module?.width;
      let size: TileWidth = userOverriddenSize || agentSpanSize || plannedSize || moduleSize || 50;

      // 信源存证与网站直达小组件 (related_links / sources) 严格横向占据 2 格 (50%)
      if ((keyStr === "related_links" || keyStr === "sources") && !userOverriddenSize) {
        size = 50;
      }

      // 优化方案 D.1: ai_answer 在长篇回答时自动升至 75% 档位，提供宽阔舒适的阅读与排版空间
      if (keyStr === "ai_answer" && !userOverriddenSize && !agentSpans[keyStr]) {
        const textLen = (activeResult?.summary || "").length;
        if (textLen >= 600) {
          size = 75;
        }
      }

      const measuredHeight = contentHeights[keyStr];

      // 首帧高度预估（若小组件提供了 estimateItemCount 且配置了 itemHeightPx，在实测值到达前作为占位高度）
      let estimatedHeightPx: number | undefined;
      const itemHeightConfig = MANIFEST_ITEM_HEIGHTS[keyStr];
      const itemHeightPx = module?.itemHeightPx ?? itemHeightConfig?.itemHeightPx;
      const baseHeightPx = module?.baseHeightPx ?? itemHeightConfig?.baseHeightPx ?? 56;
      if (itemHeightPx && typeof module?.estimateItemCount === "function") {
        try {
          const count = module.estimateItemCount(null, activeResult);
          if (typeof count === "number" && count > 0) {
            estimatedHeightPx = baseHeightPx + count * itemHeightPx;
          }
        } catch {
          // ignore estimation error and fallback
        }
      }

      inputs.push({
        id: keyStr,
        size,
        height: module?.height ?? "auto",
        ratio: module?.ratio,
        ratioMode: module?.ratioMode ?? "flexible",
        ratioByBreakpoint: module?.ratioByBreakpoint,
        preferredSide: userSides[keyStr],
        priority,
        isEmphasized,
        contentHeightPx: measuredHeight,
        estimatedHeightPx,
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
    userOverrides,
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

  // Muuri 用 CSS 网格宽度分档铺排，遵循相同的 25/50/75/100% 尺寸契约。
  // 尺寸实际呈现由 Muuri 的 fillGaps 进行交叉补空，不使用手写 Skyline 坐标。
  const muuriTileInputs = useMemo(() => tileInputs.map((input) => {
    if (activeColumns === 12) return input;
    if (activeColumns === 4) {
      // 在移动端（4列）下单列流式排版，避免多列压挤导致文字换行异常
      const mobileSize: TileWidth = input.size === 25 ? 50 : 100;
      return { ...input, size: mobileSize };
    }
    const responsiveSize: TileWidth = input.size === 100
      ? 100
      : input.size === 75
        ? 75
        : input.size === 50
          ? 50
          : 25;
    return { ...input, size: responsiveSize };
  }), [tileInputs, activeColumns]);

  // 处理隐藏/移除磁贴
  const handleRemoveTile = (id: string) => {
    if (activeKeys.length <= WIDGET_ACTIVATION_POLICY.min) return;
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

  // 桌面布局引擎：TileLayoutEngine 为唯一权威几何求解器 ("skyline")
  // Muuri 已集成 gap-filling packing；让它成为实际桌面布局引擎，
  // 否则以前虽然有 Muuri 交叉装箱实现，页面始终走自定义 skyline 分支。
  const layoutEngine = "muuri" as const;

  // Muuri 拖拽与排序控制
  const [muuriDragEnabled] = useState<boolean>(true);
  const [muuriDragAction] = useState<"move" | "swap">("move");
  const [customMuuriOrder, setCustomMuuriOrder] = useState<string[]>([]);

  // 拖拽排序后更新顺序
  const handleMuuriOrderChange = (newOrder: string[]) => {
    setCustomMuuriOrder(newOrder);
  };

  // 处理用户手动调整尺寸
  const handleTileResize = (id: string, nextSize: TileWidth) => {
    setUserOverrides((prev) => {
      const next = { ...prev, [id]: { size: nextSize } };
      try {
        localStorage.setItem(USER_OVERRIDES_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist user tile override:", e);
      }
      return next;
    });
  };

  // 渲染单个磁贴内容
  const renderTileContentById = (id: string, size: TileWidth) => {
    // 官方或已注册模块
    const widgetModule = resolveWidgetModule(id);
    if (!widgetModule) {
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        return (
          <div
            data-widget-id={id}
            className="w-full h-full min-h-[140px] rounded-2xl md:rounded-3xl border border-dashed border-border/80 bg-muted/20 p-4 flex flex-col justify-center text-center items-center"
          >
            <div className="text-xs font-semibold text-muted-foreground">
              未注册的小组件
            </div>
            <div className="mt-1 text-[11px] font-mono text-muted-foreground/80">
              {id}
            </div>
          </div>
        );
      }
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
        onResize={(nextSize) => handleTileResize(id, nextSize)}
        onExecuteSearch={onExecuteSearch}
      />
    );
  };

  // 4.9 一键整理：清除用户手动偏离，恢复确定性紧凑排版
  const handleAutoRepack = () => {
    setUserOverrides({});
    setUserSides({});
    setCustomMuuriOrder([]);
    try {
      localStorage.removeItem(USER_OVERRIDES_KEY);
    } catch {}
  };

  const handleToggleLock = () => {
    setIsLayoutLocked(prev => !prev);
  };

  // Muuri 磁贴项列表 (带拖拽手柄、展开收起与卡片内容包装)
  const muuriItems: MuuriWidgetItem[] = useMemo(() => {
    const rawItems = muuriTileInputs.map((input) => {
      const isExpanded = expandedTileIds.has(input.id);
      const measuredH = contentHeights[input.id] || 0;
      const isOverflowing = measuredH > 4 * TILE_ROW_UNIT_PX;
      const maxAllowedHeightPx = (isExpanded ? 6 : 4) * TILE_ROW_UNIT_PX;

      return {
        id: input.id,
        size: input.size,
        priority: input.priority,
        node: (
          <div className="relative group flex flex-col min-w-0 transition-all rounded-2xl md:rounded-3xl h-auto shadow-sm hover:shadow-md border border-border/40 bg-card overflow-hidden">
            {/* 拖拽排序把手 */}
            {muuriDragEnabled && !isLayoutLocked && (
              <div
                className="muuri-drag-handle absolute top-2.5 left-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-foreground shadow-xs flex items-center justify-center"
                title="按住拖拽调整小组件位置"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}

            {/* 展开/收起把手 (超过 4 个 row 单位即 480px 时提供) */}
            {isOverflowing && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedTileIds(prev => {
                    const next = new Set(prev);
                    if (next.has(input.id)) next.delete(input.id);
                    else next.add(input.id);
                    return next;
                  });
                }}
                title={isExpanded ? "收起磁贴" : "展开至 6 单位高度"}
                className="absolute top-2.5 right-17 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-foreground rounded-xl shadow-xs"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
            )}

            {/* 75% 与 25% 互补磁贴左右排位切换把手 */}
            {(input.size === 75 || input.size === 25) && !isLayoutLocked && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTileSide(input.id);
                }}
                title="将互补组件切换至左/右对调排列"
                className="absolute top-2.5 right-9.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-primary rounded-xl shadow-xs"
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
              className="absolute top-2.5 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-destructive rounded-xl shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>

            {/* 磁贴视图内容：4.2 行高量化与内部滚动 */}
            <div
              ref={(el) => {
                if (el) {
                  tileRefs.current.set(input.id, el);
                } else {
                  tileRefs.current.delete(input.id);
                }
              }}
              data-tile-measure-id={input.id}
              style={{ maxHeight: `${maxAllowedHeightPx}px` }}
              className={`w-full h-auto flex flex-col flex-none ${isOverflowing ? "overflow-y-auto overscroll-contain" : ""}`}
            >
              {renderTileContentById(input.id, input.size)}
            </div>
          </div>
        )
      };
    });

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
  }, [muuriTileInputs, activeResult, customMuuriOrder, muuriDragEnabled, isLayoutLocked, expandedTileIds, contentHeights, onNavigateTab, onExecuteSearch]);

  return (
    <div className="w-full">
      {/* 4.9 布局控制栏：一键整理与锁定布局 */}
      <div className="flex items-center justify-between mb-3 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
          <span>12 栅格自适应磁贴桌面</span>
          <span className="text-[11px] text-muted-foreground/60">
            ({activeColumns} 列模式 · 行基准 {TILE_ROW_UNIT_PX}px)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleAutoRepack}
            title="对当前磁贴集合重新调用确定性装箱器进行紧凑排版"
            className="h-7 px-2.5 text-xs rounded-lg gap-1.5 hover:bg-accent/60 text-muted-foreground hover:text-foreground border border-border/50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>一键整理</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleToggleLock}
            title={isLayoutLocked ? "解锁磁贴拖拽与重排" : "锁定当前磁贴布局与尺寸"}
            className={`h-7 px-2.5 text-xs rounded-lg gap-1.5 border ${
              isLayoutLocked
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground hover:text-foreground border-border/50 hover:bg-accent/60"
            }`}
          >
            {isLayoutLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-primary" />
                <span>已锁定布局</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>锁定布局</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 桌面磁贴网格主体 */}
      {layoutEngine === "muuri" ? (
        <MuuriWidgetGrid
          items={muuriItems}
          fillGaps={true}
          dragEnabled={muuriDragEnabled && !isLayoutLocked}
          dragHandle=".muuri-drag-handle"
          dragSortAction={muuriDragAction}
          onOrderChange={handleMuuriOrderChange}
          columnGapPx={TILE_COLUMN_GAP_PX}
          rowGapPx={TILE_ROW_GAP_PX}
          totalColumns={activeColumns}
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
                  className="relative group flex flex-col min-w-0 transition-all rounded-2xl md:rounded-3xl h-auto"
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
                    className="w-full h-auto flex flex-col flex-none"
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
