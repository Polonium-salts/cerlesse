import React, { useState } from "react";
import Markdown from "react-markdown";
import { cn } from "../../lib/utils.js";
import { ExternalLink, BookOpen } from "lucide-react";

export interface SourceCitation {
  index?: number;
  title: string;
  url: string;
  snippet?: string;
}

export interface MarkdownContentProps {
  children: string;
  className?: string;
  isStreaming?: boolean;
  sources?: SourceCitation[];
  onOpenUrl?: (url: string) => void;
}

/**
 * 行内信源引用 Popover 触发组件
 */
function InlineCitationPill({
  index,
  source,
  onOpenUrl
}: {
  index: number;
  source?: SourceCitation;
  onOpenUrl?: (url: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const title = source?.title || `信源 [${index}]`;
  const url = source?.url || "#";
  const snippet = source?.snippet || "";

  return (
    <span
      className="relative inline-block align-super leading-none mx-0.5"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={() => {
          if (url && url !== "#") {
            if (onOpenUrl) onOpenUrl(url);
            else window.open(url, "_blank", "noopener,noreferrer");
          }
        }}
        className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
        title={title}
      >
        [{index}]
      </button>

      {isOpen && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 sm:w-72 p-2.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl text-left block pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground pb-1 border-b border-border/50">
            <span className="flex items-center gap-1.5 truncate">
              <BookOpen className="size-3 text-primary shrink-0" />
              <span className="truncate">{title}</span>
            </span>
            <ExternalLink className="size-3 text-muted-foreground shrink-0" />
          </span>
          {snippet && (
            <span className="block text-[11px] text-muted-foreground mt-1.5 line-clamp-3 leading-relaxed">
              {snippet}
            </span>
          )}
          <span className="block text-[10px] text-primary/80 font-mono truncate mt-1 pt-1 border-t border-border/40">
            {url}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * 递归转换文本节点中的 [1], [2], [source-1] 为交互式信源角标
 */
function renderChildrenWithCitations(
  children: React.ReactNode,
  sources?: SourceCitation[],
  onOpenUrl?: (url: string) => void
): React.ReactNode {
  if (typeof children === "string") {
    const citationRegex = /\[(?:source-)?(\d+)\]/g;
    if (!citationRegex.test(children)) {
      return children;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const matchIter = children.matchAll(/\[(?:source-)?(\d+)\]/g);

    for (const match of matchIter) {
      const matchStart = match.index ?? 0;
      if (matchStart > lastIndex) {
        parts.push(children.slice(lastIndex, matchStart));
      }

      const citationIndex = parseInt(match[1], 10);
      const matchedSource = sources ? sources[citationIndex - 1] : undefined;

      parts.push(
        <InlineCitationPill
          key={`cite-${matchStart}-${citationIndex}`}
          index={citationIndex}
          source={matchedSource}
          onOpenUrl={onOpenUrl}
        />
      );

      lastIndex = matchStart + match[0].length;
    }

    if (lastIndex < children.length) {
      parts.push(children.slice(lastIndex));
    }

    return <>{parts}</>;
  }

  if (Array.isArray(children)) {
    return children.map((child, idx) => (
      <React.Fragment key={idx}>
        {renderChildrenWithCitations(child, sources, onOpenUrl)}
      </React.Fragment>
    ));
  }

  return children;
}

/**
 * shadcn/ui 语汇 + 信源就地溯源 + 流式动效 Markdown 渲染器
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  children,
  className,
  isStreaming = false,
  sources = [],
  onOpenUrl
}) => (
  <div className={cn("max-w-none text-sm", className)}>
    <Markdown
      components={{
        h1: ({ children }) => (
          <h1 className="mt-4 mb-2 first:mt-0 text-base font-semibold tracking-tight text-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-4 mb-2 first:mt-0 text-sm font-semibold tracking-tight text-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 mb-1.5 text-sm font-medium text-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-3 mb-1.5 text-sm font-medium text-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </h4>
        ),
        p: ({ children }) => (
          <p className="my-2.5 text-sm leading-6 text-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="my-2.5 ml-4 list-disc space-y-1.5 text-sm text-foreground marker:text-muted-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2.5 ml-4 list-decimal space-y-1.5 text-sm text-foreground marker:text-muted-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-6">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-border pl-4 italic text-muted-foreground">
            {renderChildrenWithCitations(children, sources, onOpenUrl)}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5 text-foreground">
            {children}
          </pre>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (onOpenUrl && href) {
                e.preventDefault();
                onOpenUrl(href);
              }
            }}
            className="font-medium text-primary hover:underline underline-offset-4 inline-flex items-center gap-0.5"
          >
            <span>{children}</span>
            <ExternalLink className="size-3 inline-block opacity-70" />
          </a>
        ),
        hr: () => <hr className="my-4 border-border" />
      }}
    >
      {children}
    </Markdown>

    {/* 流式生成时光标脉冲 */}
    {isStreaming && (
      <span className="inline-block w-1.5 h-4 bg-primary rounded-xs animate-pulse ml-0.5 align-middle shadow-xs shadow-primary/50" />
    )}
  </div>
);
