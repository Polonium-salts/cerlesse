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
  Trash2,
  Maximize2
} from "lucide-react";
import { WidgetRegistry } from "../../widgets/registry.js";
import { WidgetModule, WidgetCategoryType } from "../../widgets/sdk/types.js";
import { TileSize } from "../../lib/tileLayoutEngine.js";
import { CustomCardData } from "../../types.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { Input } from "../ui/input.js";

interface WidgetMarketplaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTileIds: string[];
  customCards?: CustomCardData[];
  onAddTile: (id: string, size?: TileSize) => void;
  onRemoveTile: (id: string) => void;
}

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "all", label: "全部磁贴" },
  { id: "synthesis", label: "综合提炼" },
  { id: "analysis", label: "深入分析" },
  { id: "action", label: "快捷行动" },
  { id: "portal", label: "权威存证" }
];

export const WidgetMarketplaceDrawer: React.FC<WidgetMarketplaceDrawerProps> = ({
  isOpen,
  onClose,
  activeTileIds,
  customCards = [],
  onAddTile,
  onRemoveTile
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
            className="relative w-full max-w-md h-full bg-card/95 backdrop-blur-2xl border-l border-border shadow-2xl flex flex-col z-10"
          >
            {/* 抽屉头部 */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    小组件商店 / 磁贴库
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    自由探索官方小组件与 AI 专属磁贴
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                className="text-muted-foreground"
              >
                <X />
              </Button>
            </div>

            {/* 搜索与分类导航 */}
            <div className="p-4 space-y-3 border-b border-border bg-muted/40">
              {/* 搜索栏 */}
              <div className="relative">
                <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索小组件名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs bg-background"
                />
              </div>

              {/* 分类胶囊标签 */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="xs"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="shrink-0"
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 小组件列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredModules.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
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
                      className="p-3.5 rounded-xl bg-card border border-border shadow-sm transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {module.name}
                              </span>
                              {module.category === "custom" && (
                                <Badge variant="outline" className="text-xs font-bold">
                                  AI专属
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">v{module.version}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                              {module.description || "全景桌面交互小组件"}
                            </p>
                          </div>
                        </div>

                        {/* 上架/下架操作按钮 */}
                        <div className="shrink-0">
                          {isOnDesktop ? (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => onRemoveTile(modId)}
                              title="从桌面卸载此磁贴"
                            >
                              <Check />
                              <span>已添加</span>
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              onClick={() => onAddTile(modId, chosenSize)}
                              title="添加到当前桌面"
                            >
                              <Plus />
                              <span>添加</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 磁贴尺寸选择器 */}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border text-muted-foreground">
                        <span>支持尺寸规格:</span>
                        <div className="flex items-center gap-1">
                          {(module.supportedSizes || ["small", "medium", "large", "full"]).map((s) => (
                            <Button
                              key={s}
                              variant={chosenSize === s ? "default" : "outline"}
                              size="xs"
                              onClick={() => setPreviewSizes(prev => ({ ...prev, [modId]: s as TileSize }))}
                              className="font-mono px-1.5"
                            >
                              {s === "small" ? "2x2" : s === "medium" ? "4x2" : s === "wide" ? "6x2" : s === "large" ? "4x4" : "全宽"}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
