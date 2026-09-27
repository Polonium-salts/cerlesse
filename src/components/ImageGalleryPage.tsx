import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Images,
  Search,
  Sparkles,
  Download,
  Copy,
  Check,
  ExternalLink,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  X,
  LayoutGrid,
  Columns3,
  SlidersHorizontal,
  RefreshCw,
  Image as ImageIcon,
  ImageOff,
  Filter,
  Layers,
  ArrowUpDown,
  Compass,
  ArrowUpRight
} from "lucide-react";
import { Button } from "./ui/button.js";
import { Badge } from "./ui/badge.js";
import { cn } from "../lib/utils.js";
import type { SearchImage, SearchSynthesisResult, SearchResult } from "../types.js";

interface ImageGalleryPageProps {
  activeResult: SearchSynthesisResult | null;
  query: string;
  onExecuteSearch: (query: string, deep?: boolean) => void;
  isWideCanvas?: boolean;
}

type LayoutMode = "masonry" | "grid" | "cinematic";
type ResolutionFilter = "all" | "hd" | "web";

const PRESET_DISCOVERY_TOPICS = [
  { label: "航天深空", query: "詹姆斯韦伯望远镜 深空星系 高清" },
  { label: "赛博朋克", query: "赛博朋克 未来城市 概念设计" },
  { label: "自然风光", query: "国家地理 壮丽自然风光 摄影" },
  { label: "极简建筑", query: "极简主义 现代建筑设计" },
  { label: "微距摄影", query: "微距昆虫与植物 高清细节摄影" },
  { label: "概念艺术", query: "科幻游戏 概念原画 插画" }
];

export const ImageGalleryPage: React.FC<ImageGalleryPageProps> = ({
  activeResult,
  query,
  onExecuteSearch,
  isWideCanvas = false
}) => {
  const [searchInput, setSearchInput] = useState(query || activeResult?.query || "");
  const [images, setImages] = useState<SearchImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("masonry");
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>("all");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullWindow, setIsFullWindow] = useState(false);

  // 提取当前研报或结果中的初始图片集合
  useEffect(() => {
    const gathered: SearchImage[] = [];
    const seen = new Set<string>();

    const addImg = (img: SearchImage) => {
      if (!img.imageUrl || seen.has(img.imageUrl) || seen.has(img.thumbnailUrl)) return;
      seen.add(img.imageUrl);
      gathered.push(img);
    };

    // 1. 优先提取 agent 检索出的 relatedImages
    if (activeResult?.relatedImages && activeResult.relatedImages.length > 0) {
      activeResult.relatedImages.forEach(addImg);
    }

    // 2. 提取信源中的 thumbnail
    if (activeResult?.filteredResults) {
      activeResult.filteredResults.forEach((res, idx) => {
        if (res.thumbnail && /^https?:\/\//i.test(res.thumbnail)) {
          let domain: string | undefined;
          try {
            domain = new URL(res.url).hostname.replace(/^www\./, "");
          } catch {}
          addImg({
            id: `src-thumb-${idx}-${Math.random().toString(36).substring(2, 7)}`,
            imageUrl: res.thumbnail,
            thumbnailUrl: res.thumbnail,
            title: res.title || "信源配图",
            pageUrl: res.url,
            source: res.displayDomain || domain || res.engine,
            domain
          });
        }
      });
    }

    if (gathered.length > 0) {
      setImages(gathered);
    } else if (query || activeResult?.query) {
      // 若当前研报暂无图片，自动调用 /api/images 获取
      fetchImagesForQuery(query || activeResult?.query || "");
    }
  }, [activeResult, query]);

  // 同步搜索输入框
  useEffect(() => {
    if (query && query !== searchInput) {
      setSearchInput(query);
    }
  }, [query]);

  // 异步拉取独立图片接口
  const fetchImagesForQuery = async (targetQuery: string, append = false) => {
    if (!targetQuery.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(targetQuery.trim())}&limit=36`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      const newImages: SearchImage[] = Array.isArray(data.images) ? data.images : [];
      if (append) {
        setImages((prev) => {
          const seen = new Set(prev.map((i) => i.imageUrl));
          const additions = newImages.filter((i) => !seen.has(i.imageUrl));
          return [...prev, ...additions];
        });
      } else {
        setImages(newImages);
      }
    } catch (e) {
      console.warn("Failed to fetch dedicated images", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    fetchImagesForQuery(searchInput.trim());
    onExecuteSearch(searchInput.trim());
  };

  const handleLoadMore = () => {
    const currentQ = searchInput || query || activeResult?.query || "高清图片";
    fetchImagesForQuery(currentQ, true);
  };

  const handleImageError = (url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url));
  };

  const handleCopyLink = (url: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDownload = async (img: SearchImage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetUrl = img.imageUrl || img.thumbnailUrl;
    try {
      const response = await fetch(targetUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const cleanName = (img.title || "image").replace(/[\\/:*?"<>|]/g, "_").slice(0, 30);
      a.download = `${cleanName}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  // 提取当前图库的所有域名清单
  const availableDomains = useMemo(() => {
    const counts: Record<string, number> = {};
    images.forEach((img) => {
      const d = img.domain || "其他图源";
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [images]);

  // 过滤后的图片列表
  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      if (failedImageUrls.has(img.imageUrl) && failedImageUrls.has(img.thumbnailUrl)) {
        return false;
      }
      if (selectedDomain !== "all" && (img.domain || "其他图源") !== selectedDomain) {
        return false;
      }
      if (resolutionFilter === "hd") {
        const isHd = Boolean(
          img.resolution && (parseInt(img.resolution) >= 1200 || img.resolution.includes("1080") || img.resolution.includes("4K"))
        );
        return isHd || Boolean(img.imageUrl && !img.imageUrl.includes("thumb"));
      }
      return true;
    });
  }, [images, failedImageUrls, selectedDomain, resolutionFilter]);

  // 键盘快捷键支持 (灯箱模式)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeImageIndex === null) return;
      if (e.key === "Escape") {
        setActiveImageIndex(null);
        setZoomLevel(1);
      } else if (e.key === "ArrowLeft") {
        setActiveImageIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredImages.length - 1));
        setZoomLevel(1);
      } else if (e.key === "ArrowRight") {
        setActiveImageIndex((prev) => (prev !== null && prev < filteredImages.length - 1 ? prev + 1 : 0));
        setZoomLevel(1);
      } else if (e.key === "+" || e.key === "=") {
        setZoomLevel((z) => Math.min(z + 0.25, 3));
      } else if (e.key === "-") {
        setZoomLevel((z) => Math.max(z - 0.25, 0.5));
      } else if (e.key === "0") {
        setZoomLevel(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageIndex, filteredImages.length]);

  const activeImage = activeImageIndex !== null ? filteredImages[activeImageIndex] : null;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* 1. Dedicated Search & Controls Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索高清图片、设计素材、壁纸、图集..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background/80 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !searchInput.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg text-xs font-medium"
            >
              {isLoading ? <RefreshCw className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
              <span>搜图</span>
            </Button>
          </form>

          {/* Layout Controls & Refresh */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Layout Mode Toggle */}
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setLayoutMode("masonry")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  layoutMode === "masonry"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="瀑布流排版"
              >
                <Columns3 className="size-3.5" />
                <span className="hidden sm:inline">瀑布流</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("grid")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  layoutMode === "grid"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="标准网格"
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden sm:inline">网格</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("cinematic")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  layoutMode === "cinematic"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="大图画廊"
              >
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">画廊</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchImagesForQuery(searchInput || query || activeResult?.query || "精选图片")}
              disabled={isLoading}
              className="h-9 px-3 rounded-xl border-border/80 text-xs gap-1.5"
              title="重新获取最新图片"
            >
              <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
              <span className="hidden sm:inline">刷新</span>
            </Button>
          </div>
        </div>

        {/* Quick Filter Chips & Discovery Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs">
          {/* Preset Discovery Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground flex items-center gap-1 mr-1 text-[11px]">
              <Compass className="size-3" />
              灵感探索:
            </span>
            {PRESET_DISCOVERY_TOPICS.map((topic) => (
              <button
                key={topic.label}
                type="button"
                onClick={() => {
                  setSearchInput(topic.query);
                  fetchImagesForQuery(topic.query);
                  onExecuteSearch(topic.query);
                }}
                className="px-2.5 py-1 rounded-full bg-muted/70 hover:bg-primary/10 hover:text-primary border border-border/50 text-[11px] text-muted-foreground transition-all"
              >
                {topic.label}
              </button>
            ))}
          </div>

          {/* Image Count & Domain Filter */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] font-normal">
              已加载 {filteredImages.length} 张图片
            </Badge>

            {availableDomains.length > 1 && (
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="bg-muted/70 text-foreground border border-border/60 rounded-lg px-2 py-1 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="all">全部图源 ({images.length})</option>
                {availableDomains.slice(0, 8).map(([dom, count]) => (
                  <option key={dom} value={dom}>
                    {dom} ({count})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 2. Image Gallery Display Canvas */}
      {isLoading && images.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-4/3 rounded-xl bg-muted/60 animate-pulse border border-border/40 flex flex-col items-center justify-center p-3 text-muted-foreground/50"
            >
              <ImageIcon className="size-6 mb-2 animate-bounce" />
              <div className="h-2 w-16 bg-muted-foreground/20 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="py-16 sm:py-24 rounded-2xl border border-dashed border-border bg-card/40 flex flex-col items-center justify-center text-center p-6">
          <div className="size-14 rounded-2xl bg-muted/80 flex items-center justify-center mb-4 text-muted-foreground">
            <Images className="size-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">暂无符合条件的图片</h3>
          <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
            未能找到与 "{searchInput || query}" 相关的图片，您可以尝试更换关键词或点击上方探索标签。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {PRESET_DISCOVERY_TOPICS.slice(0, 3).map((topic) => (
              <Button
                key={topic.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput(topic.query);
                  fetchImagesForQuery(topic.query);
                  onExecuteSearch(topic.query);
                }}
                className="rounded-full text-xs"
              >
                搜索: {topic.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* MASONRY / WATERFALL MODE */}
          {layoutMode === "masonry" && (
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
              {filteredImages.map((img, idx) => (
                <div
                  key={img.id || `${img.imageUrl}-${idx}`}
                  onClick={() => setActiveImageIndex(idx)}
                  className="break-inside-avoid group relative rounded-xl overflow-hidden border border-border/70 bg-card hover:border-primary/50 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  <img
                    src={img.thumbnailUrl || img.imageUrl}
                    alt={img.title || "相关图片"}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => handleImageError(img.thumbnailUrl || img.imageUrl)}
                    className="w-full h-auto object-cover group-hover:scale-103 transition-transform duration-300 bg-muted"
                  />

                  {/* Badges Overlay */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.domain ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[10px] font-mono">
                        {img.domain}
                      </span>
                    ) : (
                      <span />
                    )}
                    {img.resolution && (
                      <span className="px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[10px] font-mono">
                        {img.resolution}
                      </span>
                    )}
                  </div>

                  {/* Action Bar Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end text-white">
                    <p className="text-xs font-medium line-clamp-1 mb-1.5" title={img.title}>
                      {img.title}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyLink(img.imageUrl, e)}
                          className="p-1 rounded-md bg-white/20 hover:bg-white/40 backdrop-blur-md transition-colors"
                          title="复制图片链接"
                        >
                          {copiedUrl === img.imageUrl ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownload(img, e)}
                          className="p-1 rounded-md bg-white/20 hover:bg-white/40 backdrop-blur-md transition-colors"
                          title="下载图片"
                        >
                          <Download className="size-3" />
                        </button>
                      </div>

                      {img.pageUrl && (
                        <a
                          href={img.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-[10px] text-white/80 hover:text-white underline underline-offset-2"
                        >
                          <span>出处</span>
                          <ArrowUpRight className="size-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STANDARD GRID MODE */}
          {layoutMode === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredImages.map((img, idx) => (
                <div
                  key={img.id || `${img.imageUrl}-${idx}`}
                  onClick={() => setActiveImageIndex(idx)}
                  className="group relative aspect-4/3 rounded-xl overflow-hidden border border-border/70 bg-card hover:border-primary/50 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  <img
                    src={img.thumbnailUrl || img.imageUrl}
                    alt={img.title || "相关图片"}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => handleImageError(img.thumbnailUrl || img.imageUrl)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 bg-muted"
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5 text-white">
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono truncate max-w-[70%]">
                        {img.domain || "图片"}
                      </span>
                      <Maximize2 className="size-3.5 text-white/80" />
                    </div>

                    <div>
                      <p className="text-xs font-medium line-clamp-1 mb-1.5" title={img.title}>
                        {img.title}
                      </p>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleCopyLink(img.imageUrl, e)}
                            className="p-1 rounded-md bg-white/20 hover:bg-white/40 backdrop-blur-md transition-colors"
                            title="复制图片链接"
                          >
                            {copiedUrl === img.imageUrl ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDownload(img, e)}
                            className="p-1 rounded-md bg-white/20 hover:bg-white/40 backdrop-blur-md transition-colors"
                            title="下载图片"
                          >
                            <Download className="size-3" />
                          </button>
                        </div>
                        {img.pageUrl && (
                          <a
                            href={img.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-white/80 hover:text-white"
                          >
                            来源网页
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CINEMATIC CARDS VIEW */}
          {layoutMode === "cinematic" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredImages.map((img, idx) => (
                <div
                  key={img.id || `${img.imageUrl}-${idx}`}
                  onClick={() => setActiveImageIndex(idx)}
                  className="group rounded-2xl overflow-hidden border border-border/80 bg-card hover:border-primary/50 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col cursor-pointer"
                >
                  <div className="relative aspect-16/10 w-full overflow-hidden bg-muted">
                    <img
                      src={img.thumbnailUrl || img.imageUrl}
                      alt={img.title || "相关图片"}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => handleImageError(img.thumbnailUrl || img.imageUrl)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      {img.domain && (
                        <Badge variant="secondary" className="bg-background/85 backdrop-blur-md text-[11px] shadow-2xs">
                          {img.domain}
                        </Badge>
                      )}
                      {img.resolution && (
                        <Badge variant="outline" className="bg-background/85 backdrop-blur-md text-[11px] shadow-2xs font-mono">
                          {img.resolution}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                        {img.title || "未命名图片"}
                      </h4>
                      {img.source && <p className="text-xs text-muted-foreground">{img.source}</p>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleCopyLink(img.imageUrl, e)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          {copiedUrl === img.imageUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                          <span>{copiedUrl === img.imageUrl ? "已复制" : "复制"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDownload(img, e)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Download className="size-3" />
                          <span>下载</span>
                        </Button>
                      </div>

                      {img.pageUrl && (
                        <a
                          href={img.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <span>查看原网页</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. Load More Action Bar */}
          <div className="pt-4 pb-8 flex flex-col items-center justify-center gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="rounded-full px-6 h-10 gap-2 border-border/80 hover:bg-muted shadow-2xs"
            >
              {isLoading ? <RefreshCw className="size-4 animate-spin" /> : <Images className="size-4 text-primary" />}
              <span className="font-medium">加载更多相关图片</span>
            </Button>
            <p className="text-[11px] text-muted-foreground">
              实时聚合 SearXNG 与高质量图库集群 · 支持点击任意图片进入全屏灯箱放大
            </p>
          </div>
        </>
      )}

      {/* 4. Fullscreen Interactive Lightbox Modal */}
      <AnimatePresence>
        {activeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col justify-between select-none"
            onClick={() => {
              setActiveImageIndex(null);
              setZoomLevel(1);
            }}
          >
            {/* Top Toolbar */}
            <div
              className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 bg-black/40 text-white z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="outline" className="text-white border-white/30 bg-white/10 font-mono text-xs shrink-0">
                  {activeImageIndex! + 1} / {filteredImages.length}
                </Badge>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-white truncate max-w-md sm:max-w-xl">
                    {activeImage.title || "图片全景预览"}
                  </h3>
                  {(activeImage.domain || activeImage.resolution) && (
                    <p className="text-[11px] text-white/60 truncate font-mono">
                      {[activeImage.domain, activeImage.resolution].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Action Tools */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title="缩小 (-)"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <span className="text-[11px] font-mono text-white/80 w-10 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title="放大 (+)"
                >
                  <ZoomIn className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel(1)}
                  className="text-white hover:bg-white/20 h-8 px-2 text-xs"
                  title="重置缩放 (0)"
                >
                  适应
                </Button>

                <div className="h-4 w-px bg-white/20 mx-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleCopyLink(activeImage.imageUrl, e)}
                  className="text-white hover:bg-white/20 h-8 px-2.5 text-xs gap-1.5"
                  title="复制原图链接"
                >
                  {copiedUrl === activeImage.imageUrl ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span className="hidden sm:inline">复制直链</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleDownload(activeImage, e)}
                  className="text-white hover:bg-white/20 h-8 px-2.5 text-xs gap-1.5"
                  title="下载图片"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">下载</span>
                </Button>

                {activeImage.pageUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(activeImage.pageUrl, "_blank", "noopener,noreferrer")}
                    className="h-8 px-2.5 text-xs gap-1.5 bg-white/10 hover:bg-white/20 border-white/20 text-white"
                  >
                    <ExternalLink className="size-3.5" />
                    <span className="hidden sm:inline">访问来源</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveImageIndex(null);
                    setZoomLevel(1);
                  }}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0 rounded-full ml-1"
                  title="关闭 (Esc)"
                >
                  <X className="size-5" />
                </Button>
              </div>
            </div>

            {/* Center Stage with Prev/Next Navigation */}
            <div
              className="flex-1 relative flex items-center justify-center p-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Prev Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredImages.length - 1));
                  setZoomLevel(1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-black/60 hover:bg-black/85 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                title="上一张 (←)"
              >
                <ChevronLeft className="size-6" />
              </button>

              {/* Main Image Display */}
              <div className="max-w-full max-h-full flex items-center justify-center overflow-auto p-2">
                <motion.img
                  key={activeImage.imageUrl}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: zoomLevel, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  src={activeImage.imageUrl || activeImage.thumbnailUrl}
                  alt={activeImage.title || "高清大图"}
                  referrerPolicy="no-referrer"
                  className="max-h-[82vh] max-w-[88vw] object-contain rounded-lg shadow-2xl transition-transform duration-100"
                />
              </div>

              {/* Next Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev !== null && prev < filteredImages.length - 1 ? prev + 1 : 0));
                  setZoomLevel(1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-black/60 hover:bg-black/85 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                title="下一张 (→)"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            {/* Bottom Info Bar */}
            <div
              className="px-6 py-2.5 bg-black/40 border-t border-white/10 text-white/70 text-xs flex items-center justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <span>提示: 支持使用键盘方向键 ← / → 切换图片，Esc 关闭预览</span>
              </div>
              <div className="flex items-center gap-3">
                {activeImage.source && <span>信源: {activeImage.source}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
