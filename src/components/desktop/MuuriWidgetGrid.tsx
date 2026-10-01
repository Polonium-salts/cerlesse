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
  // 布局防抖计时器与 rAF 句柄
  const layoutDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const prevItemsSigRef = useRef<string>("");

  // 统一的重排通道：合并同一帧内的多次重排请求，统一使用平滑动画，决不用 layout(true) 强制打断动画导致抽搐
  const scheduleLayout = useCallback((_reason?: string, instant = false) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const grid = gridInstanceRef.current;
      if (!grid || isDraggingRef.current) return;
      try {
        grid.refreshItems();
        grid.layout(instant);
      } catch (e) {
        console.warn("Muuri layout execution notice:", e);
      }
    });
  }, []);

  // 同步 React DOM 节点与 Muuri 内部 item 列表并触发布局
  const syncAndLayout = useCallback(() => {
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
        if (roRef.current) {
          itemsToRemove.forEach(item => {
            const el = item.getElement();
            if (el) roRef.current?.unobserve(el);
          });
        }
      }

      // 2. 将 React 新增渲染的 DOM 节点交由 Muuri 托管并加入 RO 监听
      const trackedElements = new Set(grid.getItems().map(it => it.getElement()).filter(Boolean));
      const elementsToAdd = domElements.filter(el => !trackedElements.has(el));
      if (elementsToAdd.length > 0) {
        grid.add(elementsToAdd, { layout: false });
        if (roRef.current) {
          elementsToAdd.forEach(el => {
            roRef.current?.observe(el);
            // 预置初始 border-box 尺寸，避免首次 RO 回调误报尺寸变化
            itemDimensionsRef.current.set(el, {
              w: Math.round(el.offsetWidth),
              h: Math.round(el.offsetHeight)
            });
          });
        }
      }

      // 3. 按照 items 的确定 ID 序列排列内部索引（彻底避免受 DOM 查询次序扰动）
      const itemIdOrder = new Map<string, number>();
      items.forEach((item, index) => itemIdOrder.set(item.id, index));
      grid.sort((a, b) => {
        const elA = a.getElement();
        const elB = b.getElement();
        const idA = elA?.getAttribute("data-muuri-id") || "";
        const idB = elB?.getAttribute("data-muuri-id") || "";
        const idxA = itemIdOrder.has(idA) ? (itemIdOrder.get(idA) as number) : 9999;
        const idxB = itemIdOrder.has(idB) ? (itemIdOrder.get(idB) as number) : 9999;
        return idxA - idxB;
      }, { layout: false });

      // 4. 统一走 scheduleLayout 进行带平滑动画的排版
      scheduleLayout("sync");
    } catch (e) {
      console.warn("Muuri layout sync error:", e);
    }
  }, [items, scheduleLayout]);

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
        // 由外层 ResizeObserver 统一接管容器宽度监听，关闭 Muuri 自身内部重复的 window.resize 监听
        layoutOnResize: false,
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
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        grid.destroy();
        gridInstanceRef.current = null;
        isDraggingRef.current = false;
      };
    } catch (e) {
      console.error("Failed to initialize Muuri grid:", e);
    }
  }, [fillGaps, dragEnabled, dragHandle, dragSortAction]);

  // 当 items 列表发生真实增减或尺寸变化时，才调用增量同步
  useEffect(() => {
    if (!gridInstanceRef.current || !isReady) return;
    const currentSig = items.map(it => `${it.id}:${it.size}`).join(",");
    if (currentSig === prevItemsSigRef.current) {
      return; // 磁贴 ID 序列与栅格尺寸未改变，无需重新排版与触发动画
    }
    prevItemsSigRef.current = currentSig;
    syncAndLayout();
  }, [items, isReady, syncAndLayout]);

  // 监听容器宽度与卡片物理尺寸变化（仅在 isReady 时挂载一次，不随 items 频繁重建）
  useEffect(() => {
    if (!containerRef.current || !gridInstanceRef.current || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      if (isDraggingRef.current || !gridInstanceRef.current) return;

      let hasActualResize = false;

      for (const entry of entries) {
        const target = entry.target as HTMLElement;

        // 如果是外部容器尺寸变动：只在容器「宽度」发生实质断点变化（如窗口缩放/侧边栏展开）时重排，
        // 阈值提高至 18px，坚决过滤滚动条隐现产生的 15-17px 突变
        if (target === containerRef.current) {
          const newWidth = Math.round(entry.contentRect.width);
          if (newWidth > 0 && Math.abs(newWidth - prevContainerWidthRef.current) >= 18) {
            prevContainerWidthRef.current = newWidth;
            hasActualResize = true;
          }
          continue;
        }

        // 如果是子卡片：其宽度由 CSS 百分比严格锁定，只检测内容自然「高度」变化（如异步加载图片、流式文本渲染）
        const box = entry.borderBoxSize?.[0];
        const newH = Math.round(box ? box.blockSize : target.offsetHeight);
        const prev = itemDimensionsRef.current.get(target);

        // 首次见到的元素只记录基准尺寸，不触发重排（因为 syncAndLayout 已经完成初次排版）
        if (!prev) {
          itemDimensionsRef.current.set(target, { w: Math.round(target.offsetWidth), h: newH });
          continue;
        }

        // 仅在卡片内部高度实质变化超过 6px 阈值时触发重排
        if (Math.abs(prev.h - newH) >= 6) {
          itemDimensionsRef.current.set(target, { w: Math.round(target.offsetWidth), h: newH });
          hasActualResize = true;
        }
      }

      if (!hasActualResize) return;

      // 防抖合并布局请求：流式内容生成或图片加载时平滑重排，延时 150ms 避免中途打断 250ms 动画
      if (layoutDebounceTimerRef.current) {
        clearTimeout(layoutDebounceTimerRef.current);
      }

      layoutDebounceTimerRef.current = setTimeout(() => {
        scheduleLayout("resizeObserver");
      }, 150);
    });

    roRef.current = ro;
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
      roRef.current = null;
      if (layoutDebounceTimerRef.current) {
        clearTimeout(layoutDebounceTimerRef.current);
      }
    };
  }, [isReady, scheduleLayout]);

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
