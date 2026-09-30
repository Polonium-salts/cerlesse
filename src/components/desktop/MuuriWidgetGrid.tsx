import React, { useEffect, useRef, useState, useCallback } from "react";
import Muuri from "muuri";
import { TileWidth } from "../../lib/tileLayoutEngine.js";
import { getMuuriCrossLayoutOptions, getMuuriItemWidthPercent } from "../../layout/muuriLayoutConfig.js";

export interface MuuriWidgetItem {
  id: string;
  size: TileWidth; // 25 | 50 | 75 | 100
  priority?: number;
  node: React.ReactNode;
}

interface MuuriWidgetGridProps {
  items: MuuriWidgetItem[];
  fillGaps?: boolean;
  dragEnabled?: boolean;
  dragHandle?: string;
  dragSortAction?: "move" | "swap";
  columnGapPx?: number;
  rowGapPx?: number;
  totalColumns?: number;
  onOrderChange?: (newOrder: string[]) => void;
}

/**
 * Muuri 驱动的高性能交叉填充磁贴网格 (Muuri Cross-Interlocking Tile Grid)
 * ============================================================
 * 架构规范：
 * React 管理小组件 → Muuri 管理位置/动画/拖拽 → Cross-Masonry 算法决定业务布局
 * 
 * 具备特性：
 * 1. layout.fillGaps: true 开启自动空隙回填，让小卡片自动钻入大卡片留下的空缺；
 * 2. 响应式分级宽度 (25% / 50% / 75% / 100%)，支持大卡片与小卡片自由穿插；
 * 3. 完美支持 dragEnabled + dragHandle 拖拽手柄，支持 move / swap 交换模式；
 * 4. 搭载平滑弹性动画曲线，卡片拖拽与搜索结果切换时自然浮动过渡；
 * 5. 防抖 ResizeObserver 监听卡片尺寸与容器宽度变化，彻底阻断无限重排抽搐与闪烁。
 */
export const MuuriWidgetGrid: React.FC<MuuriWidgetGridProps> = ({
  items,
  fillGaps = true,
  dragEnabled = true,
  dragHandle = ".muuri-drag-handle",
  dragSortAction = "move",
  columnGapPx = 12,
  rowGapPx = 12,
  totalColumns = 12,
  onOrderChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<Muuri | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 记录容器上一次的测量宽度，严格过滤高度变化，阻断无限回环
  const prevContainerWidthRef = useRef<number>(0);
  // 记录子卡片尺寸，过滤无实质变化的亚像素抖动
  const itemDimensionsRef = useRef<WeakMap<HTMLElement, { w: number; h: number }>>(new WeakMap());
  // 布局防抖计时器
  const layoutDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 同步 React DOM 节点与 Muuri 内部 item 列表并触发布局
  const syncAndLayout = useCallback((instant = false) => {
    const grid = gridInstanceRef.current;
    const container = containerRef.current;
    if (!grid || !container) return;

    try {
      const domElements = Array.from(container.querySelectorAll<HTMLElement>(":scope > .muuri-tile-item"));
      const domElementsSet = new Set(domElements);
      const currentMuuriItems = grid.getItems();

      // 1. 移除已从 React DOM 中卸载的项（removeElements: false，由 React 自身负责卸载 DOM）
      const itemsToRemove = currentMuuriItems.filter(item => {
        const el = item.getElement();
        return !el || !domElementsSet.has(el);
      });
      if (itemsToRemove.length > 0) {
        grid.remove(itemsToRemove, { removeElements: false, layout: false });
      }

      // 2. 将 React 新增渲染的 DOM 节点交由 Muuri 托管
      const trackedElements = new Set(grid.getItems().map(it => it.getElement()).filter(Boolean));
      const elementsToAdd = domElements.filter(el => !trackedElements.has(el));
      if (elementsToAdd.length > 0) {
        grid.add(elementsToAdd, { layout: false });
      }

      // 3. 按照 items 的当前 DOM 顺序排列内部索引
      const orderMap = new Map<HTMLElement, number>();
      domElements.forEach((el, index) => orderMap.set(el, index));
      grid.sort((a, b) => {
        const elA = a.getElement();
        const elB = b.getElement();
        const idxA = elA && orderMap.has(elA) ? (orderMap.get(elA) as number) : 9999;
        const idxB = elB && orderMap.has(elB) ? (orderMap.get(elB) as number) : 9999;
        return idxA - idxB;
      }, { layout: false });

      // 4. 刷新卡片外形尺寸并触发布局
      grid.refreshItems();
      grid.layout(instant);
    } catch (e) {
      console.warn("Muuri layout sync error:", e);
    }
  }, []);

  // 初始化 Muuri 网格
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const isTouchDevice = typeof window !== "undefined" && (
        window.matchMedia("(pointer: coarse)").matches ||
        "ontouchstart" in window ||
        Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
      );

      const grid = new Muuri(containerRef.current, {
        items: ".muuri-tile-item",
        dragEnabled: Boolean(dragEnabled),
        dragHandle: dragHandle || undefined,
        dragAxis: "xy",
        dragSort: Boolean(dragEnabled),
        dragStartPredicate: isTouchDevice
          ? { distance: 10, delay: 300 }
          : { distance: 5, delay: 0 },
        dragSortPredicate: {
          action: dragSortAction,
          threshold: 45
        },
        layout: getMuuriCrossLayoutOptions(fillGaps),
        layoutDuration: 250,
        layoutEasing: "ease-out",
        layoutOnResize: 100,
        dragRelease: {
          duration: 250,
          easing: "ease-out",
          useRequestAnimationFrame: true
        }
      });

      gridInstanceRef.current = grid;
      setIsReady(true);

      // 拖拽事件监听
      if (dragEnabled) {
        grid.on("dragStart", () => {
          isDraggingRef.current = true;
          setIsDragging(true);
        });

        grid.on("dragReleaseEnd", () => {
          isDraggingRef.current = false;
          setIsDragging(false);
          const currentItems = grid.getItems();
          const order = currentItems
            .map(it => {
              const el = it.getElement();
              return el?.getAttribute("data-muuri-id") || "";
            })
            .filter(Boolean);
          if (order.length > 0) {
            onOrderChange?.(order);
          }
        });

        grid.on("dragEnd", () => {
          isDraggingRef.current = false;
          setIsDragging(false);
        });
      }

      return () => {
        grid.destroy();
        gridInstanceRef.current = null;
        isDraggingRef.current = false;
      };
    } catch (e) {
      console.error("Failed to initialize Muuri grid:", e);
    }
  }, [fillGaps, dragEnabled, dragHandle, dragSortAction]);

  // 当 items 列表发生变化时，延迟一帧等 DOM 提交后同步并布局
  useEffect(() => {
    if (!gridInstanceRef.current || !isReady) return;

    const rafId = requestAnimationFrame(() => {
      syncAndLayout(false);
    });

    return () => cancelAnimationFrame(rafId);
  }, [items, isReady, syncAndLayout]);

  // 监听容器宽度与卡片物理尺寸变化（防抖处理，杜绝无限回环抽搐）
  useEffect(() => {
    if (!containerRef.current || !gridInstanceRef.current || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      if (isDraggingRef.current || !gridInstanceRef.current) return;

      let hasActualResize = false;
      let isContainerResize = false;

      for (const entry of entries) {
        const target = entry.target as HTMLElement;

        // 如果是外部容器尺寸变动：只在容器「宽度」发生实质变化（如窗口缩放/侧边栏展开）时重排，
        // 坚决忽略「高度」变化，因为 Muuri 自己设置高度会改变容器 height，监听高度会导致无限触发
        if (target === containerRef.current) {
          const newWidth = Math.round(entry.contentRect.width);
          if (newWidth > 0 && Math.abs(newWidth - prevContainerWidthRef.current) >= 3) {
            prevContainerWidthRef.current = newWidth;
            hasActualResize = true;
            isContainerResize = true;
          }
          continue;
        }

        // 如果是子卡片：检查宽度或高度是否发生实质变化（超过 3px 阈值过滤亚像素抖动）
        const newW = Math.round(entry.contentRect.width);
        const newH = Math.round(entry.contentRect.height);
        const prev = itemDimensionsRef.current.get(target);

        if (!prev || Math.abs(prev.w - newW) >= 3 || Math.abs(prev.h - newH) >= 3) {
          itemDimensionsRef.current.set(target, { w: newW, h: newH });
          hasActualResize = true;
        }
      }

      if (!hasActualResize) return;

      // 防抖合并布局请求：流式内容生成或图片加载时平滑重排，避免一帧内多次重复运算
      if (layoutDebounceTimerRef.current) {
        clearTimeout(layoutDebounceTimerRef.current);
      }

      layoutDebounceTimerRef.current = setTimeout(() => {
        if (!gridInstanceRef.current || isDraggingRef.current) return;
        try {
          gridInstanceRef.current.refreshItems();
          // 如果是卡片内部流式微动，使用瞬间/快速对齐避免动画抽搐；如果是容器宽度变化使用动画过渡
          gridInstanceRef.current.layout(isContainerResize ? false : true);
        } catch (e) {
          console.warn("Muuri layout resize notice:", e);
        }
      }, 60);
    });

    ro.observe(containerRef.current);
    prevContainerWidthRef.current = Math.round(containerRef.current.clientWidth);

    const itemEls = containerRef.current.querySelectorAll<HTMLElement>(":scope > .muuri-tile-item");
    itemEls.forEach(el => {
      ro.observe(el);
      itemDimensionsRef.current.set(el, {
        w: Math.round(el.offsetWidth),
        h: Math.round(el.offsetHeight)
      });
    });

    return () => {
      ro.disconnect();
      if (layoutDebounceTimerRef.current) {
        clearTimeout(layoutDebounceTimerRef.current);
      }
    };
  }, [items, isReady]);

  // Muuri 的 fillGaps 以真实 CSS item box 排列，宽度随当前断点变为确定百分比值。
  const getItemWidth = (size: TileWidth) => `${getMuuriItemWidthPercent(size, totalColumns)}%`;

  return (
    <div
      ref={containerRef}
      className={`muuri-grid relative w-full min-h-[300px] ${
        isDragging ? "muuri-grid-dragging select-none" : ""
      }`}
      style={{
        margin: `0 -${columnGapPx / 2}px`
      }}
    >
      {items.map((item) => {
        return (
          <div
            key={item.id}
            data-muuri-id={item.id}
            className="muuri-tile-item absolute block z-10"
            style={{
              width: getItemWidth(item.size),
              padding: `${rowGapPx / 2}px ${columnGapPx / 2}px`,
              boxSizing: "border-box"
            }}
          >
            <div className="muuri-item-content w-full h-auto relative">
              {item.node}
            </div>
          </div>
        );
      })}
    </div>
  );
};
