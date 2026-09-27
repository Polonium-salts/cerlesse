import React, { useEffect, useRef, useState } from "react";
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
 * 5. ResizeObserver 实时监听子项物理高度并触发布局重算。
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
  const [isReady, setIsReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 初始化 Muuri 网格
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const grid = new Muuri(containerRef.current, {
        items: ".muuri-tile-item",
        dragEnabled: Boolean(dragEnabled),
        dragHandle: dragHandle || undefined,
        dragAxis: "xy",
        dragSort: Boolean(dragEnabled),
        dragSortPredicate: {
          action: dragSortAction,
          threshold: 45
        },
        layout: getMuuriCrossLayoutOptions(fillGaps),
        layoutDuration: 300,
        layoutEasing: "ease",
        dragRelease: {
          duration: 300,
          easing: "ease",
          useRequestAnimationFrame: true
        }
      });

      gridInstanceRef.current = grid;
      setIsReady(true);

      // 拖拽事件监听
      if (dragEnabled) {
        grid.on("dragStart", () => {
          setIsDragging(true);
        });

        grid.on("dragReleaseEnd", () => {
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
      }

      return () => {
        grid.destroy();
        gridInstanceRef.current = null;
      };
    } catch (e) {
      console.error("Failed to initialize Muuri grid:", e);
    }
  }, [fillGaps, dragEnabled, dragHandle, dragSortAction]);

  // 当 items 列表发生变化时，刷新与重新布局
  useEffect(() => {
    if (!gridInstanceRef.current || !isReady) return;

    const grid = gridInstanceRef.current;
    
    // 延迟一帧让 DOM 完成更新后刷新网格
    const rafId = requestAnimationFrame(() => {
      try {
        grid.reloadItems();
        grid.refreshItems();
        grid.layout();
      } catch (e) {
        console.warn("Muuri layout refresh notice:", e);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [items, isReady]);

  // 监听容器或卡片物理尺寸变化
  useEffect(() => {
    if (!containerRef.current || !gridInstanceRef.current || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      if (gridInstanceRef.current && !isDragging) {
        gridInstanceRef.current.refreshItems().layout();
      }
    });

    ro.observe(containerRef.current);
    const itemEls = containerRef.current.querySelectorAll(".muuri-tile-item");
    itemEls.forEach(el => ro.observe(el));

    return () => ro.disconnect();
  }, [items, isReady, isDragging, totalColumns]);

  // Muuri 的 fillGaps 以真实 CSS item box 排列，宽度必须随当前断点变为确定像素值。
  const getItemWidth = (size: TileWidth) => `${getMuuriItemWidthPercent(size, totalColumns)}%`;

  return (
    <div
      ref={containerRef}
      className={`muuri-grid relative w-full transition-all duration-300 min-h-[300px] ${
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
            className="muuri-tile-item absolute block z-10 transition-shadow"
            style={{
              width: getItemWidth(item.size),
              padding: `${rowGapPx / 2}px ${columnGapPx / 2}px`,
              boxSizing: "border-box"
            }}
          >
            <div className="muuri-item-content w-full h-full relative">
              {item.node}
            </div>
          </div>
        );
      })}
    </div>
  );
};
