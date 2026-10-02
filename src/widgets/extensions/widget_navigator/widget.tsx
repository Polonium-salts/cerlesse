import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { WidgetNavigatorData, NavigatorWidgetItem } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { widgetNavigatorAdapter } from "./adapter.js";
import { MANIFEST_BY_ID } from "../../manifests/index.js";
import {
  Compass,
  ArrowUpRight,
  ArrowUp,
  Search,
  LocateFixed
} from "lucide-react";

export interface WidgetNavigatorProps {
  data?: WidgetNavigatorData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const WidgetNavigatorWidget: React.FC<WidgetNavigatorProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [filterQuery, setFilterQuery] = useState("");
  const [activeJumpId, setActiveJumpId] = useState<string | null>(null);
  const [domTiles, setDomTiles] = useState<Array<{ id: string; name: string; size?: number }>>([]);

  const data: WidgetNavigatorData =
    props.data ??
    (widgetNavigatorAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    ) as WidgetNavigatorData);

  // 动态感应当前真实挂载在桌面上的全部小组件 ID
  const refreshDomTiles = useCallback(() => {
    if (typeof document === "undefined") return;
    const tileEls = Array.from(document.querySelectorAll<HTMLElement>("[data-muuri-id]"));
    if (tileEls.length === 0) return;

    const list = tileEls.map((el) => {
      const id = el.getAttribute("data-muuri-id") || "";
      const manifest = MANIFEST_BY_ID[id];
      return {
        id,
        name: manifest?.name || id,
        size: manifest?.grid?.width || 50
      };
    }).filter(t => Boolean(t.id));

    if (list.length > 0) {
      setDomTiles(list);
    }
  }, []);

  useEffect(() => {
    refreshDomTiles();
    const timer = setTimeout(refreshDomTiles, 500);
    return () => clearTimeout(timer);
  }, [refreshDomTiles, data.totalWidgets]);

  // 融合从数据源和 DOM 检测到的有效小组件清单
  const activeItems: NavigatorWidgetItem[] = useMemo(() => {
    if (domTiles.length > 0) {
      return domTiles.map((tile) => {
        const manifest = MANIFEST_BY_ID[tile.id];
        return {
          id: tile.id,
          name: manifest?.name || tile.name,
          category: manifest?.category || "general",
          description: manifest?.description || "",
          size: tile.size || manifest?.grid?.width || 50,
          isResident: manifest?.presence === "resident"
        };
      });
    }
    return data.items || [];
  }, [domTiles, data.items]);

  // 过滤后的列表
  const filteredItems = useMemo(() => {
    if (!filterQuery.trim()) return activeItems;
    const q = filterQuery.trim().toLowerCase();
    return activeItems.filter(
      (it) => it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q)
    );
  }, [activeItems, filterQuery]);

  // 点击跳转到指定小组件位置并触发高亮脉冲
  const handleJumpToWidget = (widgetId: string) => {
    if (typeof document === "undefined") return;

    setActiveJumpId(widgetId);

    // 优先匹配 DOM 中的 muuri 磁贴或标准 card
    const targetEl =
      document.querySelector<HTMLElement>(`[data-muuri-id="${widgetId}"]`) ||
      document.querySelector<HTMLElement>(`[data-widget-id="${widgetId}"]`) ||
      document.getElementById(`tile-${widgetId}`);

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

      // 添加聚焦高亮环动效
      targetEl.classList.add("ring-4", "ring-emerald-500/80", "ring-offset-4", "ring-offset-background", "transition-all", "duration-500");
      setTimeout(() => {
        targetEl.classList.remove("ring-4", "ring-emerald-500/80", "ring-offset-4", "ring-offset-background");
      }, 1600);
    }

    setTimeout(() => {
      setActiveJumpId(null);
    }, 1200);
  };

  const handleScrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-indigo-500/10 via-card to-blue-500/5 rounded-2xl border border-indigo-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <Compass className="w-4 h-4 animate-spin-slow" />
            <span>桌面导览</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-mono">
            {activeItems.length} 个卡片
          </span>
        </div>
        <div className="my-2 space-y-1 overflow-y-auto max-h-[220px] pr-1">
          {activeItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => handleJumpToWidget(item.id)}
              className={`w-full px-2 py-1.5 rounded-lg border text-left text-xs flex items-center justify-between text-foreground transition-all group cursor-pointer ${
                activeJumpId === item.id
                  ? "bg-indigo-500/20 border-indigo-500 text-foreground"
                  : "bg-background/80 hover:bg-indigo-500/10 border-border/50"
              }`}
            >
              <span className="truncate flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{idx + 1}</span>
                <span className="truncate font-medium">{item.name}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {item.size && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted/60 text-muted-foreground">
                    {item.size}%
                  </span>
                )}
                <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-indigo-500" />
              </div>
            </button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>点击快速定位</span>
          <button
            onClick={handleScrollToTop}
            className="text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-0.5 text-[10px] cursor-pointer"
          >
            <span>回顶</span>
            <ArrowUp className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 flex flex-col justify-between h-full bg-gradient-to-br from-indigo-500/10 via-card to-blue-600/5 rounded-3xl border border-indigo-500/20 shadow-xs">
      <div>
        {/* 标题栏 */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Compass className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>桌面小组件导览</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono font-semibold">
                  {activeItems.length}
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">直达定位本次检索已加载的所有视图卡片</p>
            </div>
          </div>

          <button
            onClick={handleScrollToTop}
            title="平滑回到页面顶部"
            className="p-1.5 rounded-xl bg-background/80 hover:bg-accent border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">顶部</span>
          </button>
        </div>

        {/* 快速搜索过滤框 (多于 4 个时展现) */}
        {activeItems.length > 4 && (
          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="搜索当前小组件..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-background/80 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>
        )}

        {/* 小组件导览清单 */}
        <div className="space-y-1.5 overflow-y-auto max-h-[260px] pr-1">
          {filteredItems.map((item, idx) => {
            const isTarget = activeJumpId === item.id;
            const sizeLabel = item.size ? `${item.size}%` : "50%";

            return (
              <div
                key={item.id}
                onClick={() => handleJumpToWidget(item.id)}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                  isTarget
                    ? "bg-indigo-500/20 border-indigo-500 text-foreground shadow-xs"
                    : "bg-background/70 hover:bg-background border-border/50 hover:border-indigo-500/40 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-lg bg-muted/60 flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground group-hover:bg-indigo-500/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground">
                    {sizeLabel}
                  </span>
                  <div className="p-1 rounded-lg bg-transparent group-hover:bg-indigo-500/15 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-all">
                    <LocateFixed className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              未找到匹配的小组件
            </div>
          )}
        </div>
      </div>

      {/* 底部信息栏 */}
      <div className="pt-2.5 mt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 text-[10px]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          12 栅格自适应桌面
        </span>
        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
          点击即时跳转聚焦
        </span>
      </div>
    </div>
  );
};
