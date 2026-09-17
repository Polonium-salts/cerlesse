import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RotateCcw,
  Store,
  Check,
  Trash2,
  BookmarkCheck,
  Columns3,
  ArrowLeftRight,
  Sparkles,
  GripVertical,
  LayoutGrid
} from "lucide-react";
import {
  ResultWidgetKey,
  AdaptiveLayoutStrategy,
  WidgetPlan,
  CustomCardData,
  SearchSynthesisResult
} from "../../types.js";
import {
  solveTileLayout,
  saveDesktopState,
  clearDesktopState,
  TileWidth,
  SolvedTileItem,
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
import { resolveDynamicCapabilityWidgets, getWidgetLabel } from "../../lib/adaptiveLayout.js";
import { MuuriWidgetGrid, MuuriWidgetItem } from "./MuuriWidgetGrid.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";

interface TileDesktopViewProps {
  strategy: AdaptiveLayoutStrategy;
  enabledWidgets: ResultWidgetKey[];
  widgetPlan?: WidgetPlan;
  customCards?: CustomCardData[];
  activeResult: SearchSynthesisResult;
  isWideCanvas?: boolean;
  onOpenMarketplace: () => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  onNavigateTab?: (tab: "bento" | "images" | "mindmap" | "comparison" | "sources" | "reasoning" | "custom_cards") => void;
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
  // 左右换位偏好：针对 75% 与 25% 互补小组件，支持在行内左侧或右侧互补对调
  const [userSides, setUserSides] = useState<Record<string, "left" | "right">>({});
  // 用户移除的小组件集合
  const [hiddenTileIds, setHiddenTileIds] = useState<Set<string>>(new Set());
  // 已保存提示 Toast 状态
  const [showSavedToast, setShowSavedToast] = useState(false);
  // 自动对齐提示
  const [showAlignToast, setShowAlignToast] = useState(false);
  // 容器物理宽度监听
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1280);

  // 规则：一次性显示所有内容无需手动向下滑动查看隐藏内容
  // 测量并存储每个小组件完整展示所需要的自然高度
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const tileRefs = useRef<Map<string, HTMLElement>>(new Map());

  // 注册中心补全版本号：注册中心是模块级单例，补登记不会自动触发 React 更新，
  // 需要此信号让磁贴重新解析模块。
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

  // 1. 整理当前待呈现在桌面的组件 ID 列表（严格根据搜索内容意图动态选型，自动剔除与搜索无关或无数据的组件）
  const activeKeys = useMemo(() => {
    const rawList = enabledWidgets && enabledWidgets.length > 0
      ? [...enabledWidgets]
      : (strategy.componentOrder && strategy.componentOrder.length > 0 
          ? [...strategy.componentOrder] 
          : resolveDynamicCapabilityWidgets(strategy.intentType || "balanced"));
    let list = [...rawList.filter(Boolean)];
    const query = (activeResult?.query || "").trim().toLowerCase();

    // 气象组件意图判定：仅当搜索词命中气象特征或由 Agent 显式规划时呈现
    const hasWeatherIntent = /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(query);
    const isWeatherPlanned = widgetPlan?.widgets?.some(w => (typeof w === "string" ? w : w?.type) === "weather");
    if ((hasWeatherIntent || isWeatherPlanned) && !list.includes("weather") && !hiddenTileIds.has("weather")) {
      list.unshift("weather");
    } else if (!hasWeatherIntent && !isWeatherPlanned) {
      list = list.filter(k => k !== "weather");
    }

    // 翻译组件判定：仅当搜索词命中翻译需求或由 Agent 显式规划时呈现
    const hasTranslationIntent = /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i.test(query);
    const isTranslationPlanned = widgetPlan?.widgets?.some(w => (typeof w === "string" ? w : w?.type) === "translation");
    if ((hasTranslationIntent || isTranslationPlanned) && !list.includes("translation") && !hiddenTileIds.has("translation")) {
      list.unshift("translation");
    } else if (!hasTranslationIntent && !isTranslationPlanned) {
      list = list.filter(k => k !== "translation");
    }

    // Token 消耗组件判定：仅当搜索词明确涉及 Token/模型消耗或由 Agent 显式规划时呈现，默认不加载
    const hasTokenIntent = /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i.test(query);
    const isTokenPlanned = widgetPlan?.widgets?.some(w => (typeof w === "string" ? w : w?.type) === "token_usage");
    if (!hasTokenIntent && !isTokenPlanned) {
      list = list.filter(k => k !== "token_usage");
    }

    // 图片组件判定：搜索图片或检索结果确实包含有效图片、或由 Agent 显式规划时保留
    const hasImages = Boolean(activeResult.relatedImages && activeResult.relatedImages.length > 0);
    const hasImageIntent = /(图片|壁纸|图库|照片|高清图|截图|image|photo|wallpaper|gallery)/i.test(query);
    const isImagePlanned = widgetPlan?.widgets?.some(w => (typeof w === "string" ? w : w?.type) === "image_gallery");
    if ((hasImageIntent || hasImages || isImagePlanned) && !list.includes("image_gallery") && !hiddenTileIds.has("image_gallery")) {
      list.push("image_gallery");
    } else if (!hasImageIntent && !hasImages && !isImagePlanned) {
      list = list.filter(k => k !== "image_gallery");
    }

    // 核心结论要点：只有存在真实 keyTakeaways 时才保留
    const hasTakeaways = Boolean(activeResult.keyTakeaways && activeResult.keyTakeaways.length > 0);
    if (!hasTakeaways) {
      list = list.filter(k => k !== "takeaways");
    }

    // 智能互补保障：若有 75% 宽度的组件（例如天气或图片），且列表中缺少 25% 宽度的组件，且存在核心要点，纳入互补
    const has75Widget = list.some(k => k === "image_gallery" || k === "weather");
    const has25Widget = list.some(k => k === "takeaways" || k === "token_usage");
    if (has75Widget && !has25Widget && !hiddenTileIds.has("takeaways") && hasTakeaways) {
      list.push("takeaways");
    }

    // 搜索引擎组件保障：如果查询包含搜索引擎相关意图，或由规划器点名，确保纳入桌面
    const hasSearchEngine = list.some(k => k === "search_engine");
    const hasSearchIntent = /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query);
    const isSearchEnginePlanned = widgetPlan?.widgets?.some(w => (typeof w === "string" ? w : w?.type) === "search_engine");
    if (!hasSearchEngine && !hiddenTileIds.has("search_engine")) {
      if (hasSearchIntent || isSearchEnginePlanned || strategy.intentType === "tool_discovery") {
        list.push("search_engine");
      }
    } else if (!hasSearchIntent && !isSearchEnginePlanned && strategy.intentType !== "tool_discovery" && strategy.intentType !== "official_portal") {
      list = list.filter(k => k !== "search_engine");
    }

    // 过滤与当前搜索词不相关的 custom_cards，去重
    const relevantCustomCards = customCards.filter(c => {
      if (c.isPinned) return true;
      const cardQ = (c.basedOnQuery || "").trim().toLowerCase();
      if (!cardQ) return true;
      return cardQ === query || query.includes(cardQ) || cardQ.includes(query);
    });

    if (relevantCustomCards.length > 0 && !list.includes("custom_cards") && !hiddenTileIds.has("custom_cards")) {
      list.push("custom_cards");
    } else if (relevantCustomCards.length === 0) {
      list = list.filter(k => k !== "custom_cards");
    }

    // 过滤掉未在注册中心登记的小组件，去重
    const uniqueKeys = Array.from(new Set(list));
    return uniqueKeys.filter((k) => k === "custom_cards" || Boolean(resolveWidgetModule(String(k))));
  }, [enabledWidgets, strategy.componentOrder, strategy.intentType, registryRevision, hiddenTileIds, activeResult.keyTakeaways, activeResult.query, activeResult.relatedImages, customCards, widgetPlan]);

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
      if (key === "custom_cards") {
        const query = (activeResult?.query || "").trim().toLowerCase();
        const relevantCards = customCards.filter(c => {
          if (c.isPinned) return true;
          const cardQ = (c.basedOnQuery || "").trim().toLowerCase();
          if (!cardQ) return true;
          return cardQ === query || query.includes(cardQ) || cardQ.includes(query);
        });

        const seenCards = new Set<string>();
        relevantCards.forEach((card, idx) => {
          const cardKey = `custom_card__${card.id}`;
          if (hiddenTileIds.has(cardKey) || hiddenTileIds.has(card.id)) return;
          if (seenCards.has(card.id) || seenCards.has(card.archetype)) return;
          seenCards.add(card.id);
          seenCards.add(card.archetype);
          
          const declaredCardWidth = tileWidthFromSpan(card.colSpan);
          const size: TileWidth = declaredCardWidth || (
            card.archetype === "timeline" || card.archetype === "parameter_matrix"
              ? 50
              : 25
          );

          const measuredHeight = contentHeights[cardKey];

          inputs.push({
            id: cardKey,
            size,
            preferredSide: userSides[cardKey] || userSides[card.id],
            ratio: resolveTileRatio(cardKey, ARCHETYPE_RATIOS[card.archetype]),
            priority: 110 - idx * 5,
            isEmphasized: idx === 0,
            contentHeightPx: measuredHeight,
            minSpan: minSpanFor(cardKey, size)
          });
        });
        continue;
      }

      if (hiddenTileIds.has(String(key))) continue;

      const planned = plannedMap.get(key);
      const keyStr = String(key);
      const module = resolveWidgetModule(keyStr);
      if (!module) continue;
      const isEmphasized = key === agentFocusKey || key === strategy.layoutPlan?.featured;
      let priority = (planned?.priority ?? 50) + (isEmphasized ? 30 : 0);
      const query = activeResult?.query || "";
      
      // 依据具体搜索结果意图动态设定优先级与展示尺寸 (Content Decision & Size Decision)
      if (keyStr === "weather") {
        priority = /(天气|气象|气温|下雨|温度|预报|weather|forecast)/i.test(query) ? 100 : 70;
      } else if (keyStr === "image_gallery") {
        priority = /(图片|壁纸|图库|照片|image|photo|wallpaper)/i.test(query) ? 98 : 65;
      } else if (keyStr === "search_engine") {
        priority = /(google|bing|baidu|百度|必应|谷歌|搜索引擎|search|engine|搜一下)/i.test(query) ? 95 : 60;
      } else if (keyStr === "related_links") {
        priority = (strategy.intentType === "official_portal" || strategy.intentType === "install" || /(官网|官方|下载|主页|portal|official|download)/i.test(query)) ? 92 : 55;
      } else if (keyStr === "ai_answer") {
        priority = 85;
      } else if (keyStr === "takeaways") {
        priority = 80;
      } else if (keyStr === "token_usage") {
        priority = 30;
      }

      // 尺寸决策：图片小组件 75%，天气 75%，搜索引擎直达 50%，Token 消耗 25%
      const agentSize = keyStr === "image_gallery" || keyStr === "weather" ? 75 : keyStr === "search_engine" ? 50 : keyStr === "token_usage" ? 25 : tileWidthFromSpan(agentSpans[keyStr]);
      const moduleSize = module?.width;
      const plannedSize = tileWidthFromPlannedSize(planned?.size);
      const size: TileWidth = keyStr === "image_gallery" || keyStr === "weather" ? 75 : keyStr === "search_engine" ? 50 : keyStr === "token_usage" ? 25 : (agentSize || moduleSize || plannedSize || 50);

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
    customCards,
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

  // 触发整行互补自动对齐重排（75%+25% 填满整行，50%+50% 填满整行）
  const handleAutoAlignRows = () => {
    clearDesktopState();
    setUserSides({});
    setShowAlignToast(true);
    setTimeout(() => setShowAlignToast(false), 2500);
  };

  // 恢复全部被隐藏的磁贴
  const handleRestoreAllTiles = () => {
    setUserSides({});
    setHiddenTileIds(new Set());
    clearDesktopState();
  };

  // 桌面布局引擎选择："muuri" (Muuri 动态交叉回填引擎) | "skyline" (2D Skyline 装箱引擎)
  const [layoutEngine, setLayoutEngine] = useState<"muuri" | "skyline">("muuri");

  // 保存当前桌面布局到本地
  const handleSaveDesktop = () => {
    saveDesktopState(layoutSolution.items);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  // 渲染单个磁贴内容
  const renderTileContentById = (id: string, size: TileWidth) => {
    // 若为自定义卡片
    if (id.startsWith("custom_card__")) {
      const cardId = id.replace("custom_card__", "");
      const card = customCards.find(c => c.id === cardId);
      if (!card) return null;

      const cardModule = WidgetRegistry.get(id) 
        || WidgetRegistry.registerCustomCard(card, {
            onUpdateCard,
            onDeleteCard
          });

      return (
        <WidgetRuntime
          key={id}
          module={cardModule}
          activeResult={activeResult}
          size={size}
          isCompact={size === 25}
          onResize={undefined}
          onExecuteSearch={onExecuteSearch}
        />
      );
    }

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
    return tileInputs.map((input) => ({
      id: input.id,
      size: input.size,
      priority: input.priority,
      node: (
        <div className="relative group flex flex-col min-w-0 transition-all rounded-2xl md:rounded-3xl h-full shadow-sm hover:shadow-md border border-border/40 bg-card overflow-hidden">
          {/* 磁贴拖拽把手 (Muuri Drag Handle) */}
          <div
            className="tile-drag-handle absolute top-2.5 left-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-card/90 backdrop-blur-sm border border-border/70 text-muted-foreground hover:text-primary rounded-xl cursor-grab active:cursor-grabbing shadow-xs"
            title="按住拖动磁贴重排"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

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
  }, [tileInputs, customCards, activeResult, onNavigateTab, onExecuteSearch, onUpdateCard, onDeleteCard]);

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
                `${layoutSolution.items.length} 张磁贴 · ${activeColumns} 栅格列 · 固定比例装箱`,
                `错落：${layoutSolution.staggeredCount} 张磁贴独占顶线（共 ${layoutSolution.topLineCount} 条顶线）`,
                `参差：桌面下沿起伏 ${Math.round(layoutSolution.raggednessPx)}px`,
                layoutSolution.gapCount > 0
                  ? `内部空洞：${layoutSolution.gapCount} 个栅格单元`
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
          {/* 排版引擎切换：Muuri 交叉回填 vs Skyline 2D 装箱 */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/60">
            <Button
              variant={layoutEngine === "muuri" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLayoutEngine("muuri")}
              className={`h-7 px-2.5 text-xs gap-1.5 rounded-md ${
                layoutEngine === "muuri" ? "shadow-xs font-semibold" : "text-muted-foreground"
              }`}
              title="Muuri 智能交叉填充：开启 fillGaps: true，大卡片与小卡片自由穿插，自动回填所有空隙"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Muuri 交叉填充</span>
            </Button>
            <Button
              variant={layoutEngine === "skyline" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLayoutEngine("skyline")}
              className={`h-7 px-2.5 text-xs gap-1.5 rounded-md ${
                layoutEngine === "skyline" ? "shadow-xs font-semibold" : "text-muted-foreground"
              }`}
              title="Skyline 2D 装箱引擎：基于天际线算法的高密度整行落位"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Skyline 装箱</span>
            </Button>
          </div>

          {/* 整行穿插排列 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoAlignRows}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs"
            title="优化小组件自动排列：支持75%与25%左右交替穿插、50%与双25%居中夹心穿插，整行对齐无缝消除留白"
          >
            {showAlignToast ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Columns3 className="w-3.5 h-3.5" />}
            <span>{showAlignToast ? "已穿插排列" : "穿插重排"}</span>
          </Button>

          {/* 打开磁贴商店 */}
          <Button size="sm" onClick={onOpenMarketplace} className="h-7 text-xs">
            <Store className="w-3.5 h-3.5" />
            <span>磁贴商店</span>
          </Button>

          {/* 恢复全部磁贴 */}
          {hiddenTileIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestoreAllTiles}
              className="text-muted-foreground h-7 text-xs"
              title="恢复被移除的桌面小组件"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复全部</span>
            </Button>
          )}

          {/* 保存桌面 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveDesktop}
            className="text-muted-foreground h-7 text-xs"
            title="将当前桌面磁贴布局保存到本地"
          >
            {showSavedToast ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <BookmarkCheck className="w-3.5 h-3.5" />}
            <span>{showSavedToast ? "已保存" : "保存"}</span>
          </Button>
        </div>
      </div>

      {/* 桌面磁贴网格主体 */}
      {layoutEngine === "muuri" ? (
        <MuuriWidgetGrid
          items={muuriItems}
          fillGaps={true}
          dragEnabled={true}
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
