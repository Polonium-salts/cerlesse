import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
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
  TileLayoutInput,
  TILE_COLUMN_GAP_PX,
  TILE_ROW_GAP_PX,
  TILE_ROW_UNIT_PX,
  TILE_CONTENT_MAX_HEIGHT_PX,
  ARCHETYPE_RATIOS,
  resolveTileRatio,
  tileSizeFromSpan,
  tileSizeFromPlannedSize,
  getTileColumnSpan
} from "../../lib/tileLayoutEngine.js";
import { MANIFEST_MIN_SPANS } from "../../widgets/manifests/index.js";
import { WidgetRegistry } from "../../widgets/registry.js";
import { WidgetRuntime } from "../../widgets/runtime.js";
import { resolveDynamicCapabilityWidgets, getWidgetLabel } from "../../lib/adaptiveLayout.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs.js";

/** 磁贴内容的实测结果：所需高度 + 测量时所在的列跨度 */
interface ContentMetric {
  heightPx: number;
  span: number;
}

/**
 * 实测高度缓存，带 query 标记。
 * 换了检索词就整体作废 —— 否则新的（往往更短的）内容会撑在上一轮留下的高磁贴里。
 */
interface ContentMetricsState {
  query: string;
  map: Record<string, ContentMetric>;
}

const EMPTY_CONTENT_METRICS: Record<string, ContentMetric> = {};

interface TileDesktopViewProps {
  strategy: AdaptiveLayoutStrategy;
  enabledWidgets: ResultWidgetKey[];
  widgetPlan?: WidgetPlan;
  customCards?: CustomCardData[];
  activeResult: SearchSynthesisResult;
  isWideCanvas?: boolean;
  onOpenMarketplace: () => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
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

  /**
   * 各磁贴内容的实测高度。
   *
   * 清单里的 ratio 只能表达「形状语汇」，而内容量是每次检索都不同的动态量 ——
   * 静态比例必然只能取一个平均值：猜大了留白，猜小了裁切（即"小组件没有完整加载"）。
   * 因此在首帧渲染后量出每张磁贴内容的自然高度，回灌求解器把磁贴增高到刚好容纳。
   */
  const [metricsState, setMetricsState] = useState<ContentMetricsState>({ query: "", map: {} });
  const contentMetrics =
    metricsState.query === activeResult.query ? metricsState.map : EMPTY_CONTENT_METRICS;
  /** 磁贴根节点，供实测回路读取内容自然高度 */
  const tileElRefs = useRef(new Map<string, HTMLDivElement>());

  // 注册中心补全版本号：注册中心是模块级单例，补登记不会自动触发 React 更新，
  // 需要此信号让磁贴重新解析模块。
  const [registryRevision, setRegistryRevision] = useState(0);

  /** 解析小组件模块；registryRevision 参与解析，手动补全后即可重新命中 */
  const resolveWidgetModule = (id: string) => {
    void registryRevision;
    return WidgetRegistry.get(id);
  };

  /** 兜底补全：重新向注册中心登记官方清单后重渲染 */
  const handleRecoverWidget = () => {
    WidgetRegistry.rehydrate();
    setRegistryRevision((prev) => prev + 1);
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

  // 自适应计算当前生效列数 (12, 6, 4)
  const activeColumns = useMemo(() => {
    if (selectedCols > 0) return selectedCols;
    if (containerWidth >= 960) return 12;
    if (containerWidth >= 580) return 6;
    return 4;
  }, [selectedCols, containerWidth]);

  /**
   * 磁贴的最小可用跨度 = 声明宽度减一档。
   *
   * 求解器的跨度弹性本意是闭合空洞，但此前的底线是「整行 1/3」（12 列时 = 4 格），
   * 对 6 / 8 格磁贴等于**放任连降两档**：实测 16 张里有 9 张被改窄，wide(8 格) 被压成
   * 6 格、large(6 格) 被压成 4 格 —— 面积直接少掉 1/3，内容于是被挤压换行甚至裁切，
   * 观感正是"小组件没有完整加载出来"。
   *
   * 现在只允许收窄一档（填缝仍然是必要的：8+6 > 12，不靠收窄就无法拼满整行，
   * 实测完全禁用收窄会让空洞从 ~400 格暴涨到 ~3500 格），但不许连降两档。
   */
  const minSpanFor = (id: string, size: TileSize) => {
    // 优先取插件清单声明的 grid.minSpan —— 内容密集的组件可在自己的 JSON 里
    // 声明"宁可有空洞，也不许被压到这个宽度以下"（如 CLI 命令块收窄后会换行截断）。
    const declared = MANIFEST_MIN_SPANS[id];
    if (typeof declared === "number") return declared;
    return Math.max(2, getTileColumnSpan(size, activeColumns) - 1);
  };

  // 固定比例核心：磁贴高度不再由「栅格行跨度 × 行高」推导，而是恒等于 宽度 / 固有宽高比。
  // 旧方案令行高 = 列宽，但间距不参与等比，导致同一组件在不同断点发生比例漂移；
  // 现在比例由 CSS aspect-ratio 精确锁定，与容器宽度、列数、内容多寡全部解耦。

  // 1. 整理当前待呈现在桌面的组件 ID 列表
  const activeKeys = useMemo(() => {
    const rawList = enabledWidgets && enabledWidgets.length > 0
      ? [...enabledWidgets]
      : (strategy.componentOrder && strategy.componentOrder.length > 0 
          ? [...strategy.componentOrder] 
          : resolveDynamicCapabilityWidgets(strategy.intentType || "balanced"));
    const list = rawList.filter(Boolean);
    // 过滤掉未在注册中心登记的小组件（暂未加载的直接不加载）
    return list.filter((k) => Boolean(resolveWidgetModule(String(k))));
  }, [enabledWidgets, strategy.componentOrder, registryRevision]);

  // 2. 小组件排版 Agent 排版决策：磁贴宽度与视觉焦点一律以 Agent 决策单为准
  //    （排版 Agent 是"如何摆放"的唯一权威；用户手动调整优先级更高，见下方三级尺寸优先级）
  const layoutDecision = strategy.layoutAgentDecision;
  const agentSpans = useMemo<Partial<Record<string, number>>>(() => {
    return { ...(strategy.customWidgetSpans || {}), ...(layoutDecision?.spans || {}) };
  }, [strategy.customWidgetSpans, layoutDecision?.spans]);
  const agentFocusKey = layoutDecision?.emphasizedWidget || strategy.emphasizedWidget;

  // 3. 组装 TileLayoutInput 数组（解构 customCards，映射 Agent Planner 推荐与用户尺寸）
  const tileInputs: TileLayoutInput[] = useMemo(() => {
    const plannedMap = new Map(widgetPlan?.widgets?.map(pw => [pw.type, pw]) || []);
    const inputs: TileLayoutInput[] = [];

    for (const key of activeKeys) {
      if (key === "custom_cards") {
        customCards.forEach((card, idx) => {
          const cardKey = `custom_card__${card.id}`;
          if (hiddenTileIds.has(cardKey) || hiddenTileIds.has(card.id)) return;
          
          // 宽度档位可调；宽高比由卡片原型固定
          // （download_hub 固定 4:5，在 4 格宽时恰好渲染为 4x5，不随宽度或内容变形）
          // 独有卡片的宽度以卡片自身声明的 colSpan 为准（卡片上可直接切换宽度），
          // 保证磁贴宽度与卡片宽度标签口径一致（原实现直接取原型默认值，会与之漂移）；
          // 排版 Agent 对该槽位的作用体现在启停、阅读序与焦点地位上。
          const declaredCardSize = tileSizeFromSpan(card.colSpan);
          const size: TileSize = userSizes[cardKey] || userSizes[card.id] || declaredCardSize || (
            card.archetype === "timeline" || card.archetype === "parameter_matrix" 
              ? "large" 
              : "medium"
          );

          inputs.push({
            id: cardKey,
            size,
            ratio: resolveTileRatio(cardKey, ARCHETYPE_RATIOS[card.archetype]),
            priority: 110 - idx * 5,
            isEmphasized: idx === 0,
            // 可收窄一档，但不得连降两档 —— 否则多步骤清单 / 命令块会被挤到换行截断
            minSpan: minSpanFor(cardKey, size),
            // 实测内容高度：让卡片长到刚好装下全部内容
            contentHeightPx: contentMetrics[cardKey]?.heightPx,
            contentSpan: contentMetrics[cardKey]?.span
          });
        });
        continue;
      }

      if (hiddenTileIds.has(String(key))) continue;

      const planned = plannedMap.get(key);
      const keyStr = String(key);
      // 注：weather / stock 为历史遗留 ID，不在 ResultWidgetKey 联合类型内，故按字符串比较
      const module = resolveWidgetModule(keyStr);
      // 暂未加载或未注册的小组件直接不加载
      if (!module) continue;
      const isEmphasized = key === agentFocusKey || key === strategy.layoutPlan?.featured;
      let priority = (planned?.priority ?? 50) + (isEmphasized ? 50 : 0);
      if (keyStr === "related_links") {
        priority += 200; // 官网跳转组件默认保持在最上方
      }

      // 尺寸四级优先级：
      //   用户自定义 > 小组件排版 Agent 栅格跨度 > 小组件自身固有宽度 > Planner 规划尺寸 > 兜底
      //
      // 「小组件自身固有宽度」一律从注册中心读取该模块声明的 defaultSize（磁贴口径 TileSize），
      // 于是每个小组件都能按自身内容形态单独定宽，不再依赖此处的硬编码特判 ——
      // 原实现只特殊处理了 ai_overview / metrics_telemetry，其余全部落到 "medium"，
      // 再叠加 WidgetPlannedSize→TileSize 的隐式强转（整体缩水一档），内容因此被挤压裁切。
      const agentSize = tileSizeFromSpan(agentSpans[keyStr]);
      const moduleSize = module?.defaultSize;
      const plannedSize = tileSizeFromPlannedSize(planned?.size);
      const size: TileSize = userSizes[keyStr] || agentSize || moduleSize || plannedSize || "medium";

      inputs.push({
        id: keyStr,
        size,
        priority,
        isEmphasized,
        // 允许求解器收窄一档以闭合空洞，但不许连降两档：
        // 实测原实现会把 16 张里的 9 张改窄，其中 wide(8 格) 被压成 6 格、
        // large(6 格) 被压成 4 格 —— 这正是"小组件内容没有完整加载出来"的直接原因。
        minSpan: minSpanFor(keyStr, size),
        // 实测内容高度：磁贴按内容增高，保证组件一次性完整呈现
        contentHeightPx: contentMetrics[keyStr]?.heightPx,
        contentSpan: contentMetrics[keyStr]?.span
      });
    }

    return inputs;
  }, [activeKeys, customCards, hiddenTileIds, userSizes, widgetPlan?.widgets, strategy, agentSpans, agentFocusKey, activeColumns, registryRevision, contentMetrics]);

  // 4. 调用 TileLayoutEngine 二维装箱求解
  const layoutSolution = useMemo(() => {
    return solveTileLayout(tileInputs, {
      totalColumns: activeColumns,
      containerWidth,
      columnGap: TILE_COLUMN_GAP_PX,
      rowGap: TILE_ROW_GAP_PX
    });
  }, [tileInputs, activeColumns, containerWidth]);

  /**
   * 实测每张磁贴内容的自然高度，回灌求解器让磁贴"长到刚好容纳"。
   *
   * 收敛性：增高只改变高度、不改变宽度，而内容的自然高度只由宽度决定 ——
   * 所以"量一次 → 长一次"即可到达不动点：第二轮 shortfall 归零，不再产生更新。
   * 反过来若内容只需要更矮，本轮量不出 shortfall，故高度只增不减；
   * 换检索词时由 query 标记整体作废，从清单比例重新开始量。
   */
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = 0;
      const spanById = new Map(layoutSolution.items.map((item) => [item.id, item.w]));
      const updates: Record<string, ContentMetric> = {};

      tileElRefs.current.forEach((el, id) => {
        const span = spanById.get(id);
        if (!span) return;
        // 内容宿主：优先匹配 data-ios-content-host，支持各类容器精准测量超出量
        const host =
          el.querySelector<HTMLElement>("[data-ios-content-host]") ||
          el.querySelector<HTMLElement>("[data-tile-content-host]") ||
          el.querySelector<HTMLElement>(".overflow-y-auto") ||
          (el.querySelector<HTMLElement>(":scope > div > div") as HTMLElement | null);
        if (!host) return;
        const shortfall = host.scrollHeight - host.clientHeight;
        if (shortfall <= 2) return;
        const needed = Math.min(
          TILE_CONTENT_MAX_HEIGHT_PX,
          Math.round(el.offsetHeight + shortfall)
        );
        const prev = contentMetrics[id];
        if (prev && prev.span === span && Math.abs(prev.heightPx - needed) <= 2) return;
        updates[id] = { heightPx: needed, span };
      });

      if (Object.keys(updates).length === 0) return;
      setMetricsState((prev) => ({
        query: activeResult.query,
        map: { ...(prev.query === activeResult.query ? prev.map : {}), ...updates }
      }));
    });

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [
    layoutSolution,
    contentMetrics,
    activeResult.query,
    activeResult.filteredResults,
    activeResult.filteredResults?.length,
    activeResult.executionTimeMs
  ]);

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
    const widgetModule = resolveWidgetModule(item.id);
    if (!widgetModule) {
      // 暂未加载的小组件直接不加载
      return null;
    }

    // 注入上下文操作
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-sm text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* OS 标识图标 */}
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black">
            ⊞
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground">
              Live Tile 桌面系统
            </span>
            <Badge
              variant="secondary"
              className="font-medium cursor-help"
              title={[
                `${layoutSolution.items.length} 张磁贴 · ${activeColumns} 栅格列 · 瀑布流错落装箱`,
                `错落：${layoutSolution.staggeredCount} 张磁贴独占顶线（共 ${layoutSolution.topLineCount} 条顶线），顶部不逐行对齐`,
                `参差：桌面下沿起伏 ${Math.round(layoutSolution.raggednessPx)}px（最高列 ${Math.round(
                  Math.max(...layoutSolution.columnHeights)
                )}px / 最低列 ${Math.round(Math.min(...layoutSolution.columnHeights))}px）`,
                `各列深度(px)：[${layoutSolution.columnHeights.map((h) => Math.round(h)).join(", ")}]`,
                layoutSolution.adjustedSpanCount > 0
                  ? `窄缝闭合：${layoutSolution.adjustedSpanCount} 张磁贴宽度微调一档，封住塞不进磁贴的窄缝`
                  : "",
                layoutSolution.gapCount > 0
                  ? `内部空洞：仅 ${layoutSolution.gapCount} 个栅格单元（绝不为凑满而拉伸磁贴、破坏固有比例）`
                  : "内部零空洞",
                ...(layoutDecision
                  ? [
                    "",
                    `${layoutDecision.agentName} 排版决策单`,
                    `焦点组件：${getWidgetLabel(agentFocusKey)}`,
                    `求解方式：${layoutDecision.llmRefined ? "大模型精修" : "确定性装箱"} · 耗时 ${layoutDecision.executionTimeMs}ms`,
                    ...layoutDecision.reasoning
                  ]
                  : [])
              ].filter(Boolean).join("\n")}
            >
              <span>{layoutSolution.items.length} 磁贴</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{activeColumns} 栅格列</span>
            </Badge>
          </div>
        </div>

        {/* 右侧桌面控制动作 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 列数切换 */}
          <Tabs
            value={selectedCols === 0 ? "auto" : selectedCols === 12 ? "12" : "6"}
            onValueChange={(v) => setSelectedCols(v === "auto" ? 0 : v === "12" ? 12 : 6)}
          >
            <TabsList>
              <TabsTrigger value="auto" title="根据视口宽度自适应栅格数">自适应</TabsTrigger>
              <TabsTrigger value="12" title="锁定 12 列原生 Windows Phone 桌面栅格">12列</TabsTrigger>
              <TabsTrigger value="6" title="锁定 6 列紧凑平板栅格">6列</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 打开磁贴商店 */}
          <Button size="sm" onClick={onOpenMarketplace}>
            <Store />
            <span>小组件商店</span>
          </Button>

          {/* 还原 Agent 推荐 */}
          {(Object.keys(userSizes).length > 0 || hiddenTileIds.size > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToAgentLayout}
              className="text-muted-foreground"
              title="放弃手动调整，还原为小组件排版 Agent 决策单给出的栅格跨度与视觉焦点"
            >
              <RotateCcw />
              <span>还原推荐</span>
            </Button>
          )}

          {/* 保存桌面 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveDesktop}
            className="text-muted-foreground"
            title="将当前桌面磁贴布局保存到本地"
          >
            {showSavedToast ? <Check /> : <BookmarkCheck />}
            <span>{showSavedToast ? "已保存桌面" : "保存桌面"}</span>
          </Button>
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
        }`}
        style={{
          gridAutoFlow: "dense",
          // 列间距固定；垂直留白由装箱算法自行控制，故 rowGap 必须为 0
          columnGap: `${TILE_COLUMN_GAP_PX}px`,
          rowGap: "0px",
          // 细粒度行单位：磁贴位置按像素精确换算，误差不超过 ±2px
          gridAutoRows: `${TILE_ROW_UNIT_PX}px`
        }}
      >
        <AnimatePresence>
          {layoutSolution.items.map((item) => {
            return (
              <motion.div
                key={item.id}
                ref={(el) => {
                  if (el) tileElRefs.current.set(item.id, el);
                  else tileElRefs.current.delete(item.id);
                }}
                layout="position"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                style={{
                  gridColumn: item.gridStyle.gridColumn,
                  gridRow: item.gridStyle.gridRow,
                  // 高度 = max(宽度 / 固有比例, 内容实测高度)：比例给出形状下限，
                  // 内容更多时磁贴随之让高，保证组件一次性完整呈现、不产生滚动。
                  // 这里用显式像素高度而非 CSS aspect-ratio —— 后者会与实测高度冲突。
                  height: `${item.pixelHeight}px`,
                  alignSelf: "start"
                }}
                className="relative group flex flex-col min-w-0 overflow-hidden transition-all rounded-2xl md:rounded-3xl"
              >
                {/* 磁贴卸载把手：右上角悬浮显现，避免遮挡标题与图标 */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => { e.stopPropagation(); handleRemoveTile(item.id); }}
                  title="从桌面卸载此磁贴"
                  className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-destructive rounded-xl shadow-xs"
                >
                  <Trash2 />
                </Button>

                {/* 磁贴实际视图渲染（固定比例：内容撑满磁贴，无任何滚动） */}
                <div className="h-full min-h-0 flex flex-col [&>*]:flex-1 [&>*]:min-h-0">
                  {renderTileContent(item)}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
