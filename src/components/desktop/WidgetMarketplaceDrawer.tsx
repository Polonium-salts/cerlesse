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
  Maximize2,
  Globe,
  DownloadCloud,
  Loader2,
  ExternalLink,
  Info
} from "lucide-react";
import { WidgetRegistry } from "../../widgets/registry.js";
import { WidgetModule, WidgetCategoryType } from "../../widgets/sdk/types.js";
import { TileWidth, TILE_WIDTH_LABELS } from "../../lib/tileLayoutEngine.js";
import { CustomCardData } from "../../types.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { Input } from "../ui/input.js";

interface WidgetMarketplaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTileIds: string[];
  customCards?: CustomCardData[];
  onAddTile: (id: string, size?: TileWidth) => void;
  onRemoveTile: (id: string) => void;
}

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "all", label: "全部磁贴" },
  { id: "synthesis", label: "综合提炼" },
  { id: "analysis", label: "深入分析" },
  { id: "action", label: "快捷行动" },
  { id: "portal", label: "权威存证" },
  { id: "custom", label: "自定义/CDN" }
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
  const [previewSizes, setPreviewSizes] = useState<Record<string, TileWidth>>({});

  // 远程 CDN / jsDelivr 导入输入状态
  const [cdnInput, setCdnInput] = useState<string>("");
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showCdnGuide, setShowCdnGuide] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // 获取所有已注册的官方与社区远程小组件（严格隔离运行时 AI 动态卡片）
  const marketplaceModules = useMemo(() => {
    void refreshTick;
    return WidgetRegistry.getMarketplaceWidgets();
  }, [isOpen, refreshTick]);

  // 处理从 jsDelivr CDN 导入小组件
  const handleImportFromCdn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input = cdnInput.trim();
    if (!input) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const result = await WidgetRegistry.registerRemoteWidgetFromCdn(input);
      setImportStatus({
        type: "success",
        message: `成功导入小组件「${result.manifest.name}」v${result.manifest.version}！已加入小组件库。`
      });
      setCdnInput("");
      setRefreshTick(t => t + 1);

      // 自动上架到桌面
      onAddTile(String(result.module.id), result.module.width);
    } catch (err: any) {
      console.error("Failed to import remote widget from CDN:", err);
      setImportStatus({
        type: "error",
        message: err.message || "拉取远程清单失败，请检查仓库名、Tag版本或 CDN 路径是否有效。"
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 过滤模块列表
  const filteredModules = useMemo(() => {
    return marketplaceModules.filter(mod => {
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
  }, [marketplaceModules, selectedCategory, searchQuery]);

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

              {/* jsDelivr / GitHub 远程 CDN 导入栏 */}
              <div className="pt-2 border-t border-border/70 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    <span>从 jsDelivr / GitHub 导入小组件</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCdnGuide(v => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Info className="w-3 h-3" />
                    <span>{showCdnGuide ? "收起说明" : "查看格式"}</span>
                  </button>
                </div>

                <form onSubmit={handleImportFromCdn} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      placeholder="例: user/repo@v1.0.0 或 CDN 链接"
                      value={cdnInput}
                      onChange={(e) => setCdnInput(e.target.value)}
                      className="text-xs bg-background h-8 font-mono placeholder:font-sans"
                      disabled={isImporting}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="xs"
                    disabled={isImporting || !cdnInput.trim()}
                    className="h-8 shrink-0 flex items-center gap-1.5"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>拉取中</span>
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>导入</span>
                      </>
                    )}
                  </Button>
                </form>

                {/* 格式提示说明卡片 */}
                {showCdnGuide && (
                  <div className="p-2.5 rounded-lg bg-card border border-border/80 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed animate-in fade-in duration-150">
                    <div className="font-semibold text-foreground">支持的 jsDelivr CDN 格式：</div>
                    <ul className="list-disc pl-4 space-y-1 font-mono text-[10.5px]">
                      <li><span className="text-foreground">GitHub 简写：</span>user/repo 或 user/repo@v1.0.0</li>
                      <li><span className="text-foreground">GitHub URL：</span>https://github.com/user/repo</li>
                      <li><span className="text-foreground">npm 包简写：</span>npm:pkg@1.0.0</li>
                      <li><span className="text-foreground">完整 CDN：</span>https://cdn.jsdelivr.net/gh/.../dist/manifest.json</li>
                    </ul>
                    <p className="text-[10px] text-muted-foreground/90 pt-1 border-t border-border/50">
                      提示：仓库需包含 dist/manifest.json 清单文件。系统将通过 jsDelivr 全球加速自动拉取并挂载。
                    </p>
                  </div>
                )}

                {/* 导入状态反馈 */}
                {importStatus && (
                  <div
                    className={`p-2 rounded text-xs flex items-start justify-between gap-2 ${
                      importStatus.type === "success"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border border-destructive/20"
                    }`}
                  >
                    <span>{importStatus.message}</span>
                    <button
                      type="button"
                      onClick={() => setImportStatus(null)}
                      className="text-xs opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                )}
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
                  const chosenSize = previewSizes[modId] || (module.width as TileWidth) || 50;

                  const IconComp = typeof module.icon === "function" ? module.icon : Layers;
                  const isImageIcon = typeof module.icon === "string" && (module.icon.startsWith("http") || module.icon.startsWith("data:") || module.icon.endsWith(".svg") || module.icon.endsWith(".png"));

                  return (
                    <div
                      key={modId}
                      className="p-3.5 rounded-xl bg-card border border-border shadow-sm transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border overflow-hidden">
                            {isImageIcon ? (
                              <img src={module.icon as string} alt={module.name} className="w-5 h-5 object-contain" />
                            ) : (
                              <IconComp className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {module.name}
                              </span>
                              {module.category === "custom" && (
                                <Badge variant="outline" className="text-xs font-bold">
                                  {modId.startsWith("custom_card__") ? "AI专属" : "CDN插件"}
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

                      {/* 磁贴宽度选择器 */}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border text-muted-foreground">
                        <span>支持宽度规格:</span>
                        <div className="flex items-center gap-1">
                          {(module.supportedWidths || [25, 50, 75, 100]).map((w) => (
                            <Button
                              key={w}
                              variant={chosenSize === w ? "default" : "outline"}
                              size="xs"
                              onClick={() => setPreviewSizes(prev => ({ ...prev, [modId]: w }))}
                              className="font-mono px-1.5"
                            >
                              {TILE_WIDTH_LABELS[w] ?? `${w}%`}
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
