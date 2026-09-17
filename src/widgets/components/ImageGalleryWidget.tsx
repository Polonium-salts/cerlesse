import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Images,
  ImageOff,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert,
  Loader2,
  Plus
} from "lucide-react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import type { SearchSynthesisResult } from "../../types.js";
import type { TileWidth } from "../../lib/tileLayoutEngine.js";

/** 图库单张图片条目 */
export interface GalleryImage {
  id: string;
  /**
   * 网格用的图片地址（优先缩略图，省流量）。
   * 已归一化：仅接受 http/https。
   */
  src: string;
  /**
   * 灯箱放大用的大图地址（优先原图）。
   * 缺原图时会回落成 src，因此渲染层必须把它当作「可能等于 src」，
   * 而不能假定它一定更大、更清晰。
   */
  fullSrc: string;
  /** 无障碍替代文本 / 图注 */
  alt: string;
  /** 图片所在原始网页（用于溯源跳转） */
  pageUrl?: string;
  /** 图片来源域名（用于角标展示） */
  domain?: string;
  /** 图片信源描述（图库名 / 引擎 / 研报等） */
  source?: string;
  /** 原始分辨率，如 "1920x1080"（仅图片检索会给） */
  resolution?: string;
}

export interface ImageGalleryData {
  query: string;
  images: GalleryImage[];
}

export interface ImageGalleryWidgetProps {
  data: ImageGalleryData;
  size?: TileWidth;
  isCompact?: boolean;
  /** Live Tile 是否已翻到背面：翻面时收起灯箱，避免两面状态打架 */
  isFlipped?: boolean;
  openUrl?: (url: string) => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  onOpenImagePage?: () => void;
}

/**
 * 图库初始收录的最大图片数（增加到 120，配合分页组件浏览，不破坏排版高度）。
 */
const GALLERY_MAX_IMAGES = 120;

/** 取域名用于角标展示（失败时返回 undefined，绝不抛错） */
function hostnameOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 校验并归一化图片地址。
 * 只接受 http/https —— data:/blob:/相对路径 无法在磁贴内安全稳定地加载，
 * 一旦放行就会退化成一片破图，不如直接不收录。
 */
function normalizeImageUrl(raw?: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/** 从 Markdown 摘要中抽取内嵌配图（AI 研报有时会输出 ![](url)） */
function extractMarkdownImages(markdown: string): Array<{ src: string; alt: string }> {
  if (!markdown) return [];
  const out: Array<{ src: string; alt: string }> = [];
  const re = /!\[([^\]]*)\]\(\s*(https?:\/\/[^)\s]+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    out.push({ alt: match[1] || "", src: match[2] });
  }
  return out;
}

/**
 * 数据清洗管道：把图片检索产出 / 网页检索缩略图 / 研报配图收敛为图库私有数据。
 *
 * 三个来源按优先级排列，任一为空都不影响其余：
 *   1. SearXNG 图片检索 (relatedImages) —— 主来源。这是唯一「真的在做图片搜索」的通道，
 *      量最足、最贴题，且带原图与分辨率；
 *   2. 网页检索结果的 thumbnail —— 替代来源。图片检索未开跑（或没搜到）时的兜底，
 *      但 SearXNG 的 general 类目只有部分结果带图；
 *   3. 研报 Markdown 内嵌配图 —— 补充来源，AI 综合时偶尔会附图。
 *
 * 三者按「图 + 出处」去重并统一限条。全部为空时返回空数组，由组件渲染空态兜底。
 */
export function buildImageGalleryData(result?: SearchSynthesisResult): ImageGalleryData {
  const query = (result?.query || "").trim();
  const images: GalleryImage[] = [];
  const seen = new Set<string>();

  const push = (params: {
    grid?: string;
    full?: string;
    alt?: string;
    pageUrl?: string;
    source?: string;
    domain?: string;
    resolution?: string;
  }) => {
    if (images.length >= GALLERY_MAX_IMAGES) return;

    const grid = normalizeImageUrl(params.grid);
    if (!grid) return;
    const full = normalizeImageUrl(params.full) || grid;

    const key = full || grid;
    if (seen.has(key)) return;
    seen.add(key);

    images.push({
      id: `gallery_img_${images.length}`,
      src: grid,
      fullSrc: full,
      alt: params.alt?.trim() || (query ? `${query} 相关图片` : "相关图片"),
      pageUrl: params.pageUrl,
      domain: params.domain || hostnameOf(params.pageUrl) || hostnameOf(grid),
      source: params.source,
      resolution: params.resolution
    });
  };

  // 1. SearXNG 图片检索产出（主来源）
  for (const img of result?.relatedImages || []) {
    push({
      grid: img.thumbnailUrl || img.imageUrl,
      full: img.imageUrl,
      alt: img.title,
      pageUrl: img.pageUrl,
      source: img.source,
      domain: img.domain,
      resolution: img.resolution
    });
  }

  // 2. 网页检索结果自带的缩略图（替代来源）
  for (const r of result?.filteredResults || []) {
    push({
      grid: r.thumbnail,
      alt: r.title,
      pageUrl: r.url,
      source: r.displayDomain || r.engine || "全网检索"
    });
  }

  // 3. 研报 Markdown 内嵌配图（补充来源）
  for (const m of extractMarkdownImages(result?.summary || "")) {
    push({ grid: m.src, alt: m.alt || query, source: "AI 研报配图" });
  }

  return { query, images };
}

/**
 * 相关图片小组件 (正面)
 *
 * 以自适应网格墙呈现检索到的相关图片：支持分页浏览与动态异步加载更多图片；
 * 点击任意缩略图进入磁贴内灯箱放大预览，可左右切换并一键跳转图片原始出处。
 */
export const ImageGalleryWidget: React.FC<ImageGalleryWidgetProps> = ({
  data,
  size = 75,
  isCompact,
  isFlipped,
  openUrl,
  onExecuteSearch,
  onOpenImagePage
}) => {
  const { query, images } = data;

  // 异步加载更多的附加图片
  const [extraImages, setExtraImages] = useState<GalleryImage[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [apiPage, setApiPage] = useState(1);
  const [hasMoreFromApi, setHasMoreFromApi] = useState(true);

  // 网格图加载失败：按地址记录后从网格中剔除，避免留下破图占位。
  const [failed, setFailed] = useState<Set<string>>(new Set());
  // 灯箱大图加载失败记录
  const [failedFull, setFailedFull] = useState<Set<string>>(new Set());
  // 灯箱当前索引（null = 未打开）
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // 检索关键词切换时重置增量状态
  useEffect(() => {
    setExtraImages([]);
    setApiPage(1);
    setHasMoreFromApi(true);
    setLoadMoreError(null);
    setCurrentPage(1);
  }, [query]);

  // 合并初始图片与后续异步加载的图片（按大图/小图去重）
  const allImages = useMemo(() => {
    const list = [...images];
    const seen = new Set(list.map((x) => x.fullSrc || x.src));
    for (const extra of extraImages) {
      const key = extra.fullSrc || extra.src;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(extra);
      }
    }
    return list;
  }, [images, extraImages]);

  const markFailed = useCallback((url: string) => {
    setFailed((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const markFullFailed = useCallback((url: string) => {
    setFailedFull((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const visible = useMemo(
    () => allImages.filter((img) => !failed.has(img.src)),
    [allImages, failed]
  );

  // 分页状态：一页显示 18 个图片（桌面端 6 列 × 3 行一次性完整铺满呈现，无需滚动）
  const pageSize = 18;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

  // 当前页图片切片
  const pagedImages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, currentPage, pageSize]);

  // 如果有效图片数量变动导致当前页越界，则收敛到最后一页
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // 图片集合内容指纹，变化时清空灯箱与破图记录
  const imageSignature = useMemo(
    () => allImages.map((img) => `${img.src}~${img.fullSrc}`).join("|"),
    [allImages]
  );

  useEffect(() => {
    setActiveIndex(null);
    setFailed(new Set());
    setFailedFull(new Set());
  }, [imageSignature]);

  // 翻到背面时收起灯箱
  useEffect(() => {
    if (isFlipped) setActiveIndex(null);
  }, [isFlipped]);

  // 灯箱越界保护
  useEffect(() => {
    if (activeIndex !== null && activeIndex >= visible.length) {
      setActiveIndex(visible.length > 0 ? visible.length - 1 : null);
    }
  }, [visible.length, activeIndex]);

  // 灯箱内切图时，同步更新网格当前页码，使用户关闭灯箱后处于对应页
  useEffect(() => {
    if (activeIndex !== null) {
      const targetPage = Math.floor(activeIndex / pageSize) + 1;
      if (targetPage !== currentPage && targetPage <= totalPages) {
        setCurrentPage(targetPage);
      }
    }
  }, [activeIndex, pageSize, totalPages, currentPage]);

  // 灯箱打开时聚焦
  useEffect(() => {
    if (activeIndex !== null) dialogRef.current?.focus();
  }, [activeIndex]);

  // 异步加载更多图片
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMoreFromApi || !query) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = apiPage + 1;
      const res = await fetch(
        `/api/images?q=${encodeURIComponent(query)}&page=${nextPage}&limit=36`
      );
      if (!res.ok) {
        throw new Error("加载图片失败，请稍后重试");
      }
      const json = await res.json();
      const rawList: any[] = Array.isArray(json.images) ? json.images : [];
      if (rawList.length === 0) {
        setHasMoreFromApi(false);
      } else {
        const newItems: GalleryImage[] = [];
        for (const item of rawList) {
          const grid = normalizeImageUrl(item.thumbnailUrl || item.imageUrl);
          const full = normalizeImageUrl(item.imageUrl) || grid;
          if (!grid) continue;
          newItems.push({
            id: `gallery_api_${item.id || Math.random().toString(36).substring(2, 9)}`,
            src: grid,
            fullSrc: full || grid,
            alt: item.title?.trim() || (query ? `${query} 相关图片` : "相关图片"),
            pageUrl: item.pageUrl,
            domain: item.domain || hostnameOf(item.pageUrl) || hostnameOf(grid),
            source: item.source,
            resolution: item.resolution
          });
        }
        if (newItems.length === 0) {
          setHasMoreFromApi(false);
        } else {
          setExtraImages((prev) => [...prev, ...newItems]);
          setApiPage(nextPage);
          // 自动跳转到新加载的图片所在页
          setCurrentPage((prev) => prev + 1);
        }
      }
    } catch (err: any) {
      setLoadMoreError(err?.message || "网络异常，未能加载更多图片");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreFromApi, query, apiPage]);

  const openImageSearch = useCallback(() => {
    if (onOpenImagePage) {
      onOpenImagePage();
      return;
    }
    if (!query) return;
    if (onExecuteSearch) {
      onExecuteSearch(`${query} 图片`, false);
    } else if (openUrl) {
      openUrl(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`);
    }
  }, [query, onExecuteSearch, openUrl, onOpenImagePage]);

  const active = activeIndex !== null ? visible[activeIndex] : null;

  const lightboxSrc = active
    ? (failedFull.has(active.fullSrc) ? active.src : active.fullSrc)
    : null;

  const step = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      setActiveIndex((prev) => {
        const base = prev ?? 0;
        return (base + delta + visible.length) % visible.length;
      });
    },
    [visible.length]
  );

  const headerBadge = (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className="text-[11px] h-5 font-normal text-muted-foreground whitespace-nowrap"
      >
        第 {currentPage} / {totalPages} 页 · 共 {visible.length} 张
      </Badge>
      {totalPages > 1 && (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="上一页"
          >
            <ChevronLeft className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              if (currentPage < totalPages) {
                setCurrentPage((p) => p + 1);
              } else if (hasMoreFromApi && !isLoadingMore) {
                handleLoadMore();
              }
            }}
            disabled={(currentPage >= totalPages && !hasMoreFromApi) || isLoadingMore}
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title={currentPage < totalPages ? "下一页" : "加载更多"}
          >
            {isLoadingMore && currentPage === totalPages ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </Button>
        </div>
      )}
    </div>
  );

  if (visible.length === 0) {
    return (
      <IOSWidget
        id="widget-image-gallery"
        data-widget-id="image_gallery"
        data-width="75"
        size={size}
        title="相关图片"
        icon={<Images className="size-4 text-primary" />}
        className="w-full h-full border-border/80 bg-card"
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 p-6 text-center border border-dashed border-border rounded-xl">
          <ImageOff className="size-7 text-muted-foreground/50" />
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            本轮检索未返回可用图片
          </p>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed max-w-[22rem]">
            检索信源中暂无缩略图或研报配图。可尝试在线加载更多或切换至图片专区。
          </p>
          <div className="flex items-center gap-2">
            {query && (
              <Button
                size="sm"
                variant="default"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-1.5 whitespace-nowrap"
                title="尝试加载更多图片"
              >
                {isLoadingMore ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                <span>加载图片</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={openImageSearch}
              className="gap-1.5 whitespace-nowrap"
              title="进入图片专区或发起图片检索"
            >
              <Images className="size-3.5" />
              <span>进入图片图库专区</span>
            </Button>
          </div>
        </div>
      </IOSWidget>
    );
  }

  return (
    <IOSWidget
      id="widget-image-gallery"
      data-widget-id="image_gallery"
      data-width="75"
      size={size}
      title="相关图片"
      icon={<Images className="size-4 text-primary" />}
      badge={headerBadge}
      className="w-full h-full border-border/80 bg-card"
    >
      <div className="flex flex-col gap-2.5">
        {/* 图片网格墙：一次性完整呈现当前页的图片 */}
        <div
          className={cn(
            "grid gap-2",
            isCompact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          )}
        >
          {pagedImages.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                const gIdx = visible.findIndex((v) => v.id === img.id);
                setActiveIndex(gIdx >= 0 ? gIdx : 0);
              }}
              title={img.alt}
              className="group/img relative overflow-hidden rounded-lg border border-border/70 bg-muted/30 aspect-[4/3] cursor-pointer transition-colors hover:border-primary/40"
            >
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => markFailed(img.src)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-105"
              />
              {/* 底部图源渐隐角标：常态只显示域名，避免遮挡画面 */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4">
                <span className="truncate text-[10px] font-medium text-white/95">
                  {img.domain || img.source || ""}
                </span>
                {img.pageUrl && (
                  <ExternalLink className="size-3 shrink-0 text-white/85" />
                )}
              </span>
            </button>
          ))}
        </div>

        {/* 底部行动条与分页控制 */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
              <ShieldAlert className="size-3 shrink-0" />
              <span className="truncate hidden sm:inline">公开信源，版权归原作者</span>
              <span className="truncate sm:hidden">公开信源</span>
            </span>
            {loadMoreError && (
              <span className="text-[11px] text-destructive truncate max-w-[140px]" title={loadMoreError}>
                {loadMoreError}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* 分页控制区 */}
            {totalPages > 1 && (
              <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="上一页"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>

                {/* 数字页码 pills */}
                <div className="flex items-center gap-0.5 px-0.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 5) return true;
                      return Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages;
                    })
                    .map((p, idx, arr) => {
                      const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsisBefore && (
                            <span className="text-[10px] text-muted-foreground px-0.5 select-none">…</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={cn(
                              "h-5 min-w-[20px] px-1 text-[11px] font-medium rounded transition-colors cursor-pointer",
                              currentPage === p
                                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (currentPage < totalPages) {
                      setCurrentPage((p) => p + 1);
                    } else if (hasMoreFromApi && !isLoadingMore) {
                      handleLoadMore();
                    }
                  }}
                  disabled={(currentPage >= totalPages && !hasMoreFromApi) || isLoadingMore}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title={currentPage < totalPages ? "下一页" : "加载更多"}
                >
                  {isLoadingMore && currentPage === totalPages ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </Button>
              </div>
            )}

            {/* 加载更多图片按钮 */}
            {hasMoreFromApi && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore || !query}
                className="h-6.5 px-2 text-xs gap-1 border-border/70 hover:bg-muted/70 whitespace-nowrap"
                title={query ? `从网络继续加载更多「${query}」相关图片` : "暂无检索词"}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="size-3 animate-spin text-primary" />
                    <span>加载中...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3 text-muted-foreground" />
                    <span>加载更多</span>
                  </>
                )}
              </Button>
            )}

            {/* 进入图片专区 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={openImageSearch}
              disabled={!query}
              className="h-6.5 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 whitespace-nowrap"
              title={query ? `进入图片图库专区查看更多「${query}」高清大图` : "暂无可检索的主题词"}
            >
              <Images className="size-3.5" />
              <span className="hidden sm:inline">图库专区</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 磁贴内灯箱：绝对定位覆盖内容区，不跳出磁贴、不破坏栅格 */}
      {active && !isFlipped && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="图片放大预览"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Escape") setActiveIndex(null);
            else if (e.key === "ArrowRight") step(1);
            else if (e.key === "ArrowLeft") step(-1);
          }}
          className="absolute inset-0 z-30 flex flex-col bg-background/95 backdrop-blur-sm outline-none"
        >
          <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-border/50">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate" title={active.alt}>
                {active.alt}
              </p>
              {(active.domain || active.source || active.resolution) && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {[active.domain || active.source, active.resolution]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setActiveIndex(null)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="关闭预览 (Esc)"
            >
              <X />
            </Button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center p-2">
            <img
              src={lightboxSrc || active.src}
              alt={active.alt}
              referrerPolicy="no-referrer"
              onError={() => {
                // 原图与网格图是两套独立资源：只有两者都已判死，这一格才算真坏
                if (lightboxSrc === active.fullSrc && active.fullSrc !== active.src) {
                  markFullFailed(active.fullSrc);
                } else {
                  markFailed(active.src);
                }
              }}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/50">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => step(-1)}
                disabled={visible.length < 2}
                className="text-muted-foreground hover:text-foreground"
                title="上一张 (←)"
              >
                <ChevronLeft />
              </Button>
              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                {(activeIndex ?? 0) + 1} / {visible.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => step(1)}
                disabled={visible.length < 2}
                className="text-muted-foreground hover:text-foreground"
                title="下一张 (→)"
              >
                <ChevronRight />
              </Button>
            </div>
            {active.pageUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openUrl?.(active.pageUrl!)}
                className="h-7 shrink-0 gap-1 px-2 text-xs whitespace-nowrap"
                title="跳转图片原始出处"
              >
                <ExternalLink className="size-3.5" />
                <span>查看来源</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </IOSWidget>
  );
};

/**
 * 相关图片小组件 (Live Tile 背面)
 * 以图源清单呈现每张图片的出处，便于快速溯源与逐条跳转。
 */
export const ImageGalleryBackWidget: React.FC<ImageGalleryWidgetProps> = ({
  data,
  openUrl
}) => {
  const { images } = data;
  const traced = images.filter((img) => Boolean(img.pageUrl));

  return (
    <IOSWidget
      title="图源清单"
      icon={<Images className="size-4 text-primary" />}
      badge={
        <Badge
          variant="outline"
          className="text-[11px] h-5 font-normal text-muted-foreground whitespace-nowrap"
        >
          {traced.length} 个来源
        </Badge>
      }
      className="w-full h-full border-border/80 bg-card"
    >
      {traced.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 p-6 text-center border border-dashed border-border rounded-xl">
          <Images className="size-7 text-muted-foreground/50" />
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            暂无带出处的图片
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            点击右上角翻转按钮返回图片墙
          </p>
        </div>
      ) : (
        <div className="flex flex-col h-full gap-2">
          <ul className="flex-1 space-y-1.5 overflow-y-auto">
            {traced.map((img) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => img.pageUrl && openUrl?.(img.pageUrl)}
                  className="group/src w-full flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 hover:border-primary/30 p-2 text-left transition-colors cursor-pointer"
                  title={`打开 ${img.pageUrl}`}
                >
                  <img
                    src={img.src}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-10 shrink-0 rounded-md object-cover border border-border/60 bg-muted/40"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-foreground/90 truncate">
                      {img.alt}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {img.domain || img.source || "未知来源"}
                    </span>
                  </span>
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover/src:text-primary" />
                </button>
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            点击条目直达图片原始页面，点击右上角翻转按钮返回图片墙
          </div>
        </div>
      )}
    </IOSWidget>
  );
};
