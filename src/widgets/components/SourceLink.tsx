/**
 * 链接与信源的统一展示语言。
 * ========================================================================
 * AI 智能回答里链接出现在四个位置，它们必须看起来像同一套东西：
 *   1. 正文行内引用角标 `[1]`（MarkdownContent 的 InlineCitationPill）
 *   2. 正文 markdown 链接 `[文字](url)` / 裸 URL
 *   3. 段落 / 列表项末尾常显的信源卡（SourceInlineCard）
 *   4. 背面「核心参引网页与文档」列表
 * 四处共用本文件的 host 格式化、favicon 色块、预览卡内容。
 *
 * 「常显信源卡」是刻意加的：链接信息只挂在悬停上时，只有把指针移上去才存在，
 * 读回答的人根本看不出「这句话是从哪个页面来的」。现在引用信息直接穿插在正文里。
 *
 * 为什么预览卡用 createPortal 挂到 body，而不是就地一个 absolute 浮层：
 *   AI 回答的正文装在 `overflow-y-auto` 的滚动容器里（磁贴高度有限），
 *   就地浮层在段落靠右时会被容器横向裁掉一半，在磁贴靠右时还会被相邻磁贴盖住；
 *   磁贴翻转时祖先带 transform，连 `position: fixed` 都会被重新绑定到那个
 *   transformed 元素上。挂到 body 的 fixed 浮层不受 overflow / transform 影响。
 *
 * favicon 不用外部服务（google s2 之类）：那会把用户的检索主题泄露给第三方，
 * 而且离线/内网直接失效。这里用 host 哈希出的稳定色块 + 首字母，纯本地。
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Search } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { getUiStrings } from "../../lib/appLanguage.js";

/**
 * 信源引用。正文角标、预览卡、背面列表共用这一个结构。
 * （原先定义在 MarkdownContent.tsx，这里作为唯一定义处并由那边再导出，
 *   避免 MarkdownContent ↔ SourceLink 互相 import 形成环。）
 */
export interface SourceCitation {
  /** 1 起的引用序号，对应正文里的 `[1]` */
  index?: number;
  title: string;
  url: string;
  snippet?: string;
}

/** 预览卡与视口边缘的最小留白 */
const VIEWPORT_PAD = 10;
/** 浮层与锚点之间的间距 */
const ANCHOR_GAP = 8;
/** 浮层层级：必须高于 Muuri 拖拽层的 z-index:50 */
const PREVIEW_Z = 100;

// ============================================================
// 纯函数：URL / host 格式化（可单测，不碰 DOM）
// ============================================================

/** 是否是外部可跳转链接（http/https） */
export function isExternalUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return /^https?:\/\//i.test(raw.trim());
}

/**
 * 取可读主机名：去协议、去 www.。
 * 无法解析（相对路径、javascript: 等）返回空串 —— 调用方据此判定「不可跳转」，
 * 不猜、不把原始字符串当域名显示。
 */
export function formatSourceHost(raw: string | undefined | null): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (!isExternalUrl(value)) return "";
  try {
    const url = new URL(value);
    if (!url.hostname) return "";
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/** 超长时中间省略，保留首尾（域名头和扩展名都留着才认得出是哪个站） */
export function middleTruncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  const keep = Math.max(4, Math.floor((maxLen - 1) / 2));
  return `${value.slice(0, keep)}…${value.slice(-(maxLen - 1 - keep))}`;
}

/**
 * 链接的展示形态：去协议、去 www.、去结尾斜杠与查询串；超长则中间省略。
 * 裸 URL 塞进正文时比原始链接可读得多（`https://www.x.com/a/b` → `x.com/a/b`）。
 */
export function prettySourceUrl(raw: string | undefined | null, maxLen = 46): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (!isExternalUrl(value)) return middleTruncate(value, maxLen);
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "");
    const path = `${url.pathname}${url.search}${url.hash}`.replace(/\/+$/, "");
    const display = path && path !== "/" ? `${host}${path}` : host;
    return middleTruncate(display, maxLen);
  } catch {
    return middleTruncate(value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^www\./i, ""), maxLen);
  }
}

/**
 * 判断链接文字是不是「模型直接把 URL 当正文写出来了」。
 * 这类链接展示原始 URL 很占版面，必须换成 host + 路径的可读形态。
 */
export function isBareUrlLabel(label: string, href: string | undefined | null): boolean {
  const text = (label || "").trim();
  const target = (href || "").trim();
  if (!text || !target) return false;
  const bare = text.replace(/^[<(\[]+|[>)\]]+$/g, "").trim();
  if (!bare) return false;
  if (/^https?:\/\//i.test(bare)) return true;
  // 少数模型写成 "example.com/a" 或 "www.example.com" 而不带协议。
  // TLD 必须≥2 个字母，否则 "3.14"、"v1.2" 这类正常文本会被误判成链接。
  if (!/\s/.test(bare) && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|\?|#|$)/i.test(bare)) return true;
  return false;
}

/**
 * URL 归一化键：判断「正文里的链接」和「检索结果信源」是不是同一个页面。
 * 只抹平不影响定位的差异（大小写、www.、结尾斜杠），查询串与 hash 一律保留 ——
 * 同一站点的不同页面不能被当成同一个信源，否则溯源就成了假的。
 */
export function canonicalUrlKey(raw: string | undefined | null): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (!isExternalUrl(value)) return value.replace(/\/+$/, "").toLowerCase();
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./i, "");
    const port = url.port ? `:${url.port}` : "";
    const path = `${url.pathname}${url.search}`.replace(/\/+$/, "");
    return `${host}${port}${path}`;
  } catch {
    return value.replace(/\/+$/, "").toLowerCase();
  }
}

/** 由 host 稳定推导出的一组颜色（同一个站永远同一个颜色） */
export function sourceHostColors(host: string): { bg: string; fg: string } {
  const key = host || "?";
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return {
    bg: `hsl(${hue} 68% 50% / 0.16)`,
    fg: `hsl(${hue} 58% 42%)`
  };
}

/** 没有 host 时的回退图标文案 */
function sourceInitial(host: string): string {
  const first = host.replace(/[^a-z0-9]/i, "").charAt(0);
  return (first || "?").toUpperCase();
}

/** 把 React 节点摊平成纯文本（用于判断链接文字是不是裸 URL） */
export function nodeToText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => nodeToText(child)).join("");
  if (React.isValidElement(node)) {
    return nodeToText((node.props as { children?: React.ReactNode })?.children);
  }
  return "";
}

/** 供外部（正文 markdown 链接）复用的图标块 */
export function SourceFavicon({ url, className }: { url?: string; className?: string }) {
  const host = formatSourceHost(url);
  const colors = useMemo(() => sourceHostColors(host), [host]);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] font-semibold leading-none select-none",
        className
      )}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {sourceInitial(host)}
    </span>
  );
}

// ============================================================
// 预览卡（portal + 视口避让）
// ============================================================

interface PreviewPosition {
  top: number;
  left: number;
}

/**
 * 把浮层贴到锚点上方；上方空间不够就翻到下方；左右再做视口夹取。
 * 定位在 useLayoutEffect 里做（浏览器绘制前），所以不会有「先出现在左上角再跳」的闪烁。
 */
function useAnchoredPosition(open: boolean, anchor: HTMLElement | null, cardRef: React.RefObject<HTMLDivElement>) {
  const [position, setPosition] = useState<PreviewPosition | null>(null);

  const place = useCallback(() => {
    const card = cardRef.current;
    if (!anchor || !card) return;
    const anchorRect = anchor.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;

    let top = anchorRect.top - height - ANCHOR_GAP;
    if (top < VIEWPORT_PAD) {
      // 上方放不下（角标在首行，或浮层比视口还高）→ 落到下方
      const below = anchorRect.bottom + ANCHOR_GAP;
      top = Math.min(below, window.innerHeight - height - VIEWPORT_PAD);
    }
    const centered = anchorRect.left + anchorRect.width / 2 - width / 2;
    const left = Math.max(
      VIEWPORT_PAD,
      Math.min(centered, window.innerWidth - width - VIEWPORT_PAD)
    );
    setPosition({ top: Math.max(VIEWPORT_PAD, top), left });
  }, [anchor, cardRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
    // 滚动容器滚动时让浮层跟着锚点走，而不是悬停在旧位置
    const onReflow = () => place();
    window.addEventListener("resize", onReflow);
    document.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      document.removeEventListener("scroll", onReflow, true);
    };
  }, [open, place]);

  return position;
}

interface SourcePreviewCardProps {
  /** 角标序号；常显信源卡没有序号，可以省略 */
  index?: number;
  source: SourceCitation | undefined;
  onOpenUrl?: (url: string) => void;
  /** 供外层判断焦点/鼠标是否仍在这张卡上（只有浮层形态需要） */
  cardRef?: React.RefObject<HTMLDivElement>;
  style?: React.CSSProperties;
  language?: string;
  /**
   * `popover`（默认）：悬停角标时出现的浮层；
   * `inline`：直接穿插在正文里的常显信源卡，宽度跟着正文走、去掉浮层阴影与入场动画。
   * 两者共用同一套排版与配色（深色卡面 + 图标/标题行 + 灰色摘要行），
   * 区别只在动作：inner 卡整张就是链接，浮层卡另有复制 / 打开按钮。
   */
  variant?: "popover" | "inline";
}

/**
 * 信源卡本体：角标 hover / focus 的浮层与正文里的常显卡共用。
 *
 * 版式（两行，与「链接预览卡」的通行样式一致）：
 *   第一行：站点色块 + 加粗标题（单行省略），右侧留给域名或操作；
 *   第二行：灰色摘要（单行省略），整行从卡片左内边距起排、不与标题缩进对齐。
 *
 * 为什么正文里的卡不再挂一个「新标签页打开」按钮：
 *   按钮把卡片撑到三行，而 `inline` 形态在正文里是成组出现的，三行卡会盖过正文本身。
 *   整张卡就是链接（`<a>` 包住卡片内容）后，标题与摘要全都能点，卡片只剩两行。
 *   复制按钮留在悬停浮层里 —— 那里有空间，也不影响正文密度。
 */
export function SourcePreviewCard({
  index,
  source,
  onOpenUrl,
  cardRef,
  style,
  language,
  variant = "popover"
}: SourcePreviewCardProps) {
  const t = getUiStrings(language);
  const [copied, setCopied] = useState(false);
  const inline = variant === "inline";
  const rawUrl = (source?.url || "").trim();
  const url = isExternalUrl(rawUrl) ? rawUrl : "";
  const host = formatSourceHost(url);
  const title =
    source?.title?.trim() ||
    (index !== undefined ? t.linkCitationLabel(index) : "") ||
    prettySourceUrl(url, 60) ||
    t.linkUnmatchedSource;
  const snippet = (source?.snippet || "").trim();

  const openUrl = useCallback(() => {
    if (!url) return;
    if (onOpenUrl) onOpenUrl(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }, [url, onOpenUrl]);

  const copyUrl = useCallback(() => {
    if (!url) return;
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => undefined);
    } else {
      done();
    }
  }, [url]);

  // 卡片内容（两行版式）。inline 与 popover 共用，区别只在外层的容器元素与动作区。
  const content = (
    <>
      {/* 第一行：图标 + 加粗标题（单行省略）+ 右侧槽位 */}
      <div className="flex min-w-0 items-center gap-2">
        <SourceFavicon url={url} className="size-4 rounded-[5px] text-[10px]" />
        <span
          className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-foreground"
          title={title}
        >
          {title}
        </span>
        {inline ? (
          // 域名直接顶到标题右侧：正文里没有第二行可以安放它，而域名是溯源的第一判断依据
          <span
            className="shrink-0 max-w-[42%] truncate font-mono text-[10px] leading-5 text-muted-foreground/80"
            title={url || undefined}
          >
            {url ? host || prettySourceUrl(url, 32) : t.linkUnmatchedSource}
          </span>
        ) : (
          url && (
            <button
              type="button"
              onClick={copyUrl}
              title={copied ? t.linkCopied : t.linkCopyUrl}
              aria-label={copied ? t.linkCopied : t.linkCopyUrl}
              className="shrink-0 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          )
        )}
      </div>

      {/* 第二行：灰色摘要（单行省略，全文在 title 与悬停浮层里） */}
      {snippet && (
        <p
          className={cn(
            "mt-1 truncate text-xs leading-5 text-muted-foreground",
            // 浮层卡里 extra 的复制/打开按钮占位更宽，摘要放宽到两行
            !inline && "line-clamp-2 whitespace-normal"
          )}
          title={snippet}
        >
          {snippet}
        </p>
      )}

      {/* popover 专属：完整链接 + 打开按钮 */}
      {!inline && (
        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/80">
            {url ? prettySourceUrl(url, 52) : ""}
          </span>
          {url ? (
            <button
              type="button"
              onClick={openUrl}
              title={t.linkOpenInTab}
              className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>{t.linkOpenInTab}</span>
              <ExternalLink className="size-3" />
            </button>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
              <Search className="size-3" />
              {t.linkUnmatchedSource}
            </span>
          )}
        </div>
      )}
    </>
  );

  const shellClass = cn(
    "border border-border/80 bg-popover text-popover-foreground",
    inline
      // shadow-sm 只为亮色主题——亮色下卡面与页面同为白色，只靠边框会显得像一块空框；
      // 深色下卡面本身就是 13% 灰（与截图一致），阴影不可见也不影响。
      ? "group/src block w-full rounded-2xl px-3 py-2.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
      : "w-80 max-w-[calc(100vw-20px)] rounded-2xl p-3.5 shadow-2xl shadow-black/20 animate-in fade-in zoom-in-95 duration-150"
  );

  // 正文里的常显卡：整张就是链接，标题与摘要都能点开原文。
  // 对不上信源（没有可跳转 URL）时不包 <a>，既不假装能跳，也不给空 href。
  if (inline && url) {
    return (
      <a
        data-source-card="inline"
        role="group"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        title={t.linkOpenInTab}
        aria-label={`${title} — ${t.linkOpenInTab}`}
        onClick={(event) => {
          // 有宿主 openUrl 时走宿主通道，保持与 widget 约定的行为一致
          if (onOpenUrl) {
            event.preventDefault();
            onOpenUrl(url);
          }
        }}
        className={cn(shellClass, "cursor-pointer")}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      ref={cardRef}
      data-source-card={inline ? "inline" : undefined}
      role={inline ? "group" : "tooltip"}
      style={style}
      className={shellClass}
    >
      {content}
    </div>
  );
}

/**
 * 正文里常显的信源卡：把「这个链接到底是什么」直接穿插在引用它的段落后面，
 * 不再要求读者把指针悬停到角标上才能知道来源。
 */
export function SourceInlineCard(
  props: Omit<SourcePreviewCardProps, "variant" | "cardRef" | "style">
) {
  return <SourcePreviewCard {...props} variant="inline" />;
}

// ============================================================
// 行内引用角标
// ============================================================

interface CitationMarkerProps {
  index: number;
  source?: SourceCitation;
  onOpenUrl?: (url: string) => void;
  language?: string;
}

/** 鼠标移开 / 失焦后的关闭延迟，让指针能从容移进预览卡 */
const CLOSE_DELAY = 160;

/**
 * 正文里的行内引用角标：`[1]`。
 * 交互：悬停或键盘聚焦出预览卡，点击直接在新标签页打开原文。
 * 匹配不到信源时降级成灰色只读标记（不假装能跳转 —— AGENTS.md：不许声称没发生过的操作）。
 */
export function CitationMarker({ index, source, onOpenUrl, language }: CitationMarkerProps) {
  const t = getUiStrings(language);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  const rawUrl = (source?.url || "").trim();
  const url = isExternalUrl(rawUrl) ? rawUrl : "";
  const title = source?.title?.trim() || t.linkCitationLabel(index);
  const label = `${t.linkCitationLabel(index)}${url ? `：${title}` : ""}`;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const hide = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const position = useAnchoredPosition(open, triggerRef.current, cardRef);

  // Esc 关闭 + 点击别处关闭
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || cardRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const openTarget = useCallback(() => {
    if (!url) return;
    if (onOpenUrl) onOpenUrl(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }, [url, onOpenUrl]);

  // 匹配不到信源：只读角标，明确标注而不是给一个点了没反应的假按钮
  if (!url) {
    return (
      <span
        className="relative mx-0.5 inline-block align-super leading-none"
        title={t.linkUnmatchedSource}
        aria-label={label}
      >
        <span className="inline-flex h-[15px] min-w-[17px] items-center justify-center rounded-[5px] bg-muted px-1 align-top text-[10px] font-semibold leading-none tabular-nums text-muted-foreground/80 ring-1 ring-inset ring-border">
          {index}
        </span>
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openTarget}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={(event) => {
          // 焦点移进预览卡时不关闭（卡里有复制/打开按钮）
          if (cardRef.current?.contains(event.relatedTarget as Node)) return;
          setOpen(false);
        }}
        aria-label={label}
        aria-expanded={open}
        className={cn(
          "relative mx-0.5 inline-flex h-[15px] min-w-[18px] cursor-pointer items-center justify-center rounded-[5px] px-[3px] align-top text-[10px] font-semibold leading-none tabular-nums transition-all",
          "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25",
          "hover:bg-primary hover:text-primary-foreground hover:ring-primary focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:ring-primary focus-visible:outline-none",
          open && "bg-primary text-primary-foreground ring-primary"
        )}
      >
        {index}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, opacity: 0 }}
            className="fixed z-[100]"
          >
            <SourcePreviewCard
              index={index}
              source={source}
              onOpenUrl={onOpenUrl}
              cardRef={cardRef}
              language={language}
            />
          </div>,
          document.body
        )}
    </>
  );
}

// ============================================================
// 背面信源列表行
// ============================================================

interface SourceListItemProps {
  index: number;
  source: SourceCitation;
  onOpenUrl?: (url: string) => void;
  language?: string;
}

/**
 * 背面「核心参引网页与文档」的一行：favicon + 标题 + 域名 + 序号。
 * 右侧序号与正面角标 `[1]` 一一对应，方便对照。
 */
export function SourceListItem({ index, source, onOpenUrl, language }: SourceListItemProps) {
  const t = getUiStrings(language);
  const rawUrl = (source?.url || "").trim();
  const url = isExternalUrl(rawUrl) ? rawUrl : "";
  const host = formatSourceHost(url);
  const title = source?.title?.trim() || prettySourceUrl(url, 60) || t.linkCitationLabel(index);

  const body = (
    <>
      <SourceFavicon url={url} className="size-5 rounded-[6px] text-[11px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-5 text-foreground" title={title}>
          {title}
        </span>
        {host && (
          <span className="block truncate font-mono text-[10px] leading-4 text-muted-foreground/80">
            {host}
          </span>
        )}
      </span>
      <span className="shrink-0 inline-flex items-center gap-1.5">
        <span className="inline-flex h-[17px] min-w-[18px] items-center justify-center rounded-[5px] bg-primary/10 px-1 text-[10px] font-semibold tabular-nums leading-none text-primary ring-1 ring-inset ring-primary/20">
          {index}
        </span>
        <ExternalLink className="size-3 text-muted-foreground transition-colors group-hover/link:text-primary" />
      </span>
    </>
  );

  const className =
    "group/link flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 px-2.5 py-2 text-left transition-colors hover:border-primary/35 hover:bg-muted/50";

  if (!url) {
    return (
      <div className={cn(className, "cursor-default opacity-70")} title={t.linkUnmatchedSource}>
        {body}
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={t.linkOpenInTab}
      onClick={(event) => {
        // 有宿主 openUrl 时走宿主通道，保持与 widget 约定的行为一致
        if (onOpenUrl) {
          event.preventDefault();
          onOpenUrl(url);
        }
      }}
      className={cn(className, "cursor-pointer")}
    >
      {body}
    </a>
  );
}