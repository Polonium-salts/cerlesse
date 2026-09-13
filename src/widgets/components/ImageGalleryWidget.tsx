import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Images,
  ImageOff,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert
} from "lucide-react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import type { SearchSynthesisResult } from "../../types.js";

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
  isCompact?: boolean;
  /** Live Tile 是否已翻到背面：翻面时收起灯箱，避免两面状态打架 */
  isFlipped?: boolean;
  openUrl?: (url: string) => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
}

/**
 * 图库最多呈现的图片数。
 *
 * 这不是性能限制而是排版护栏：磁贴会为内容让高（见 TileDesktopView 的实测回路），
 * 无上限时一次检索的几十张缩略图会把单张磁贴拉成数千像素的长条，
 * 整面磁贴墙的节奏被一张卡吃干。12 张足够铺满一屏再留一点余量。
 */
const GALLERY_MAX_IMAGES = 12;

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

  /**
   * 收录一张图。
   *
   * 去重键用「大图地址」而非网格地址：同一张原图在不同来源里可能挂着不同的缩略图 URL，
   * 用缩略图去重会把它当成两张不同的图重复铺出来。
   */
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
 * 以自适应网格墙呈现检索到的相关图片：点击任意缩略图进入磁贴内灯箱放大预览，
 * 可左右切换并一键跳转图片原始出处。无图时给出「去图片搜索」的行动入口而非空白卡。
 */
export const ImageGalleryWidget: React.FC<ImageGalleryWidgetProps> = ({
  data,
  isCompact,
  isFlipped,
  openUrl,
  onExecuteSearch
}) => {
  const { query, images } = data;

  // 网格图加载失败：按地址记录后从网格中剔除，避免留下破图占位。
  // 刻意用地址而非条目 id 作键 —— id 是按序号生成的，换检索词后同一序号会指向
  // 另一张图，用 id 记录会让新一轮的图片被上一轮的失败记录误伤。
  const [failed, setFailed] = useState<Set<string>>(new Set());
  // 灯箱大图加载失败：单独记账。图库里的 thumb 与 orig 往往是两套独立资源
  // （不同 CDN、各自的防盗链策略），一格坏掉不该把另一格也判死。
  const [failedFull, setFailedFull] = useState<Set<string>>(new Set());
  // 灯箱当前索引（null = 未打开）
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

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
    () => images.filter((img) => !failed.has(img.src)),
    [images, failed]
  );

  /**
   * 图片集合的内容指纹。
   * 换检索词（或该组件的图片集发生任何变化）时用它清空灯箱索引与破图记录：
   * 否则上一轮的索引会指向新一轮的另一张图，上一轮的破图记录也会误伤新图片。
   */
  const imageSignature = useMemo(
    () => images.map((img) => `${img.src}~${img.fullSrc}`).join("|"),
    [images]
  );

  useEffect(() => {
    setActiveIndex(null);
    setFailed(new Set());
    setFailedFull(new Set());
  }, [imageSignature]);

  // 翻到背面时收起灯箱：两面同时有交互态会让用户不知身在何处
  useEffect(() => {
    if (isFlipped) setActiveIndex(null);
  }, [isFlipped]);

  // 图片被剔除后索引可能越界，收敛到最后一张，避免灯箱指向空位
  useEffect(() => {
    if (activeIndex !== null && activeIndex >= visible.length) {
      setActiveIndex(visible.length > 0 ? visible.length - 1 : null);
    }
  }, [visible.length, activeIndex]);

  // 灯箱打开时聚焦到对话框，让键盘方向键 / Esc 立即可用
  useEffect(() => {
    if (activeIndex !== null) dialogRef.current?.focus();
  }, [activeIndex]);

  const openImageSearch = useCallback(() => {
    if (!query) return;
    if (onExecuteSearch) {
      onExecuteSearch(`${query} 图片`, false);
    } else if (openUrl) {
      openUrl(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`);
    }
  }, [query, onExecuteSearch, openUrl]);

  const active = activeIndex !== null ? visible[activeIndex] : null;

  /**
   * 灯箱实际加载的地址：优先原图，原图已判死则回落网格图。
   * 回落之后仍是同一张图，只是清晰度差一档 —— 远好过弹出一个空灯箱。
   */
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
    <Badge
      variant="outline"
      className="text-[11px] h-5 font-normal text-muted-foreground whitespace-nowrap"
    >
      共 {visible.length} 张
    </Badge>
  );

  if (visible.length === 0) {
    return (
      <IOSWidget
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
            检索信源中暂无缩略图或研报配图。可切换至图片搜索直接查看该主题的相关图片。
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={openImageSearch}
            disabled={!query}
            className="gap-1.5 whitespace-nowrap"
            title={query ? `搜索「${query}」的相关图片` : "暂无可检索的主题词"}
          >
            <Search className="size-3.5" />
            <span>搜索相关图片</span>
          </Button>
        </div>
      </IOSWidget>
    );
  }

  return (
    <IOSWidget
      title="相关图片"
      icon={<Images className="size-4 text-primary" />}
      badge={headerBadge}
      className="w-full h-full border-border/80 bg-card"
    >
      <div className="flex flex-col h-full gap-2.5">
        {/* 图片网格墙：窄栏 2 列，常规 2→3 列，所有图片等比裁剪保证栅格整齐 */}
        <div
          className={cn(
            "grid gap-1.5 sm:gap-2",
            isCompact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
          )}
        >
          {visible.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
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

        {/* 底部行动条 */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
            <ShieldAlert className="size-3 shrink-0" />
            <span className="truncate">图片来自公开检索信源，版权归原作者所有</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={openImageSearch}
            disabled={!query}
            className="h-7 shrink-0 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 whitespace-nowrap"
            title={query ? `在图片搜索中查看更多「${query}」相关图片` : "暂无可检索的主题词"}
          >
            <Search className="size-3.5" />
            <span>更多图片</span>
          </Button>
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
