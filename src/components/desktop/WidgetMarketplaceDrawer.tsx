import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Store,
  Sparkles,
  Plus,
  Check,
  Search,
  Layers,
  Wand2,
  Trash2,
  Maximize2
} from "lucide-react";
import { WidgetRegistry } from "../../widgets/registry.js";
import { WidgetModule, WidgetCategoryType } from "../../widgets/sdk/types.js";
import { TileSize } from "../../lib/tileLayoutEngine.js";
import { CustomCardData } from "../../types.js";

interface WidgetMarketplaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTileIds: string[];
  customCards?: CustomCardData[];
  onAddTile: (id: string, size?: TileSize) => void;
  onRemoveTile: (id: string) => void;
  onOpenForgeModal?: () => void;
}

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "all", label: "全部磁贴" },
  { id: "synthesis", label: "综合提炼" },
  { id: "analysis", label: "深入分析" },
  { id: "action", label: "快捷行动" },
  { id: "portal", label: "权威存证" },
  { id: "custom", label: "AI 专属定制" }
];

export const WidgetMarketplaceDrawer: React.FC<WidgetMarketplaceDrawerProps> = ({
  isOpen,
  onClose,
  activeTileIds,
  customCards = [],
  onAddTile,
  onRemoveTile,
  onOpenForgeModal
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  // 预览所选尺寸状态
  const [previewSizes, setPreviewSizes] = useState<Record<string, TileSize>>({});

  // 获取所有已注册的官方与动态模块
  const allModules = useMemo(() => {
    return WidgetRegistry.getAll();
  }, [isOpen]);

  // 过滤模块列表
  const filteredModules = useMemo(() => {
    const activeSet = new Set(allModules.map(m => m.id));

    // 也确保 customCards 包含在列表内
    const list = [...allModules];
    customCards.forEach(card => {
      const cardKey = `custom_card__${card.id}`;
      if (!activeSet.has(cardKey)) {
        list.push({
          id: cardKey,
          name: card.title,
          version: "1.0.0",
          description: card.subtitle || "AI 专属独有业务卡片",
          category: "custom",
          defaultSize: "medium",
          supportedSizes: ["small", "medium", "large", "full"]
        });
      }
    });

    return list.filter(mod => {
      // 避免重复带 custom_card__ 前缀和纯 ID 的重复显示
      if (mod.category === "custom" && !String(mod.id).startsWith("custom_card__")) {
        return false;
      }

      if (selectedCategory !== "all" && mod.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = mod.name.toLowerCase().includes(q);
        const matchDesc = mod.description?.toLowerCase().includes(q) || false;
        return matchName || matchDesc;
      }
      return true;
    });
  }, [allModules, customCards, selectedCategory, searchQuery]);

  const activeIdSet = useMemo(() => new Set(activeTileIds), [activeTileIds]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 背景毛玻璃遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer"
          />

          {/* 抽屉侧边栏 */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative w-full max-w-md h-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border-l border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl flex flex-col z-10"
          >
            {/* 抽屉头部 */}
            <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    小组件商店 / 磁贴库
                  </h3>
                  <p className="text-xs text-zinc-500">
                    自由探索官方小组件与 AI 专属磁贴
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 搜索与分类导航 */}
            <div className="p-4 space-y-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50">
              {/* 搜索栏 */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="搜索小组件名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
                />
              </div>

              {/* 分类胶囊标签 */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? "bg-blue-600 text-white shadow-2xs font-semibold"
                        : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 小组件列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredModules.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  没有找到符合条件的小组件
                </div>
              ) : (
                filteredModules.map((module) => {
                  const modId = String(module.id);
                  const isOnDesktop = activeIdSet.has(modId) 
                    || (modId.startsWith("custom_card__") && activeIdSet.has("custom_cards"));
                  const chosenSize = previewSizes[modId] || (module.defaultSize as TileSize) || "medium";

                  const IconComp = typeof module.icon === "function" ? module.icon : Layers;

                  return (
                    <div
                      key={modId}
                      className="p-3.5 rounded-2xl bg-white dark:bg-zinc-850/80 border border-zinc-200/80 dark:border-zinc-750/80 shadow-2xs hover:shadow-sm transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/40 dark:border-blue-900/40">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {module.name}
                              </span>
                              {module.category === "custom" && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                  AI专属
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400">v{module.version}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                              {module.description || "全景桌面交互小组件"}
                            </p>
                          </div>
                        </div>

                        {/* 上架/下架操作按钮 */}
                        <div className="shrink-0">
                          {isOnDesktop ? (
                            <button
                              onClick={() => onRemoveTile(modId)}
                              className="px-2.5 py-1 rounded-xl text-xs font-medium bg-zinc-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-950/40 dark:text-zinc-300 dark:hover:text-rose-400 border border-zinc-200/60 dark:border-zinc-700/60 transition-colors flex items-center gap-1 cursor-pointer"
                              title="从桌面卸载此磁贴"
                            >
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>已添加</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onAddTile(modId, chosenSize)}
                              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                              title="添加到当前桌面"
                            >
                              <Plus className="w-3 h-3" />
                              <span>添加</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 磁贴尺寸选择器 */}
                      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 text-zinc-400">
                        <span>支持尺寸规格:</span>
                        <div className="flex items-center gap-1">
                          {(module.supportedSizes || ["small", "medium", "large", "full"]).map((s) => (
                            <button
                              key={s}
                              onClick={() => setPreviewSizes(prev => ({ ...prev, [modId]: s as TileSize }))}
                              className={`px-1.5 py-0.5 rounded font-mono transition-all cursor-pointer ${
                                chosenSize === s
                                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                              }`}
                            >
                              {s === "small" ? "2x2" : s === "medium" ? "4x2" : s === "wide" ? "6x2" : s === "large" ? "4x4" : "全宽"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 抽屉底部快捷触发区 */}
            <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/70 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  onOpenForgeModal?.();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>AI 动态锻造全新独有小组件</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
