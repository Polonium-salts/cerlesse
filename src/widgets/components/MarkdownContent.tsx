import React, { useState, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
 * 递归转换文本节点中的 [1], [2], [source-1] 以及文本标题/摘要引用为交互式信源角标
 */
function renderChildrenWithCitations(
  children: React.ReactNode,
  sources?: SourceCitation[],
  onOpenUrl?: (url: string) => void
): React.ReactNode {
  if (typeof children === "string") {
    // 匹配常规数字角标 [1], [2], [source-1] 以及模型意外输出的文本标题/摘要引用 [Title: Snippet]
    const bracketRegex = /\[([^\]\n]+)\]/g;
    if (!bracketRegex.test(children)) {
      return children;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const matchIter = children.matchAll(/\[([^\]\n]+)\]/g);

    for (const match of matchIter) {
      const matchStart = match.index ?? 0;
      const rawContent = match[1].trim();

      // 跳过纯空内容
      if (!rawContent) continue;

      let citationIndex: number | undefined;
      let matchedSource: SourceCitation | undefined;

      // 1. 检查是否为标准数字引用 [1], [2], [source-1]
      const numMatch = rawContent.match(/^(?:source-)?(\d+)$/i);
      if (numMatch) {
        citationIndex = parseInt(numMatch[1], 10);
        matchedSource = sources ? sources[citationIndex - 1] : undefined;
      } else {
        // 2. 检查是否为带有标题、冒号或长摘要的畸变引用（如 [Google Play], [bilibili: 官方主站...]）
        // 尝试在信源中模糊匹配标题或关键词，映射为正确的数字角标
        const titleKey = rawContent.split(/[:：]/)[0].trim().toLowerCase();
        if (sources && sources.length > 0) {
          const foundIdx = sources.findIndex((s) => {
            const sTitle = (s.title || "").toLowerCase();
            const sUrl = (s.url || "").toLowerCase();
            return (
              (titleKey.length >= 2 && (sTitle.includes(titleKey) || titleKey.includes(sTitle))) ||
              (rawContent.length >= 3 && (sTitle.includes(rawContent.toLowerCase()) || rawContent.toLowerCase().includes(sTitle))) ||
              (sUrl && rawContent.toLowerCase().includes(sUrl))
            );
          });
          if (foundIdx !== -1) {
            citationIndex = foundIdx + 1;
            matchedSource = sources[foundIdx];
          }
        }

        // 如果信源中没精准匹配到，但文本很长或带有冒号，说明是残留的 snippet 引用
        // 如果没有匹配到任何信源且很短（可能是普通括号文本如 [可选]），则保持原样
        if (citationIndex === undefined) {
          const looksLikeCitation =
            rawContent.includes(":") ||
            rawContent.includes("：") ||
            rawContent.length > 15 ||
            /http|\.com|\.org|官网|官方|主页|下载|百科|搜索/i.test(rawContent);
          if (!looksLikeCitation) {
            continue;
          }
          citationIndex = 1;
          matchedSource = sources ? sources[0] : undefined;
        }
      }

      if (matchStart > lastIndex) {
        parts.push(children.slice(lastIndex, matchStart));
      }

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

    return parts.length > 0 ? <>{parts}</> : children;
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
 * 预处理并清洗大模型生成的 Markdown 文本：
 * 1. 过滤未捕获的模型协议标签与工具调用泄漏（如 <|tool_call|>call:search_web{...}<|tool_call|>、<tool_call> 等）
 * 2. 修复常见残缺或合并的表格语法（如 |维度／信源 [1] |bing||:---:|:---:||证据提炼|... 重排为标准 GFM 表格）
 * 3. 规范化段落与标题间的空行，保证 Markdown 标题与列表正常渲染
 */
export function preprocessMarkdown(text: string): string {
  if (!text) return "";
  let clean = text;

  // 1. 移除模型内部协议标签与泄漏的工具调用
  clean = clean.replace(/<\|tool_call\|>[\s\S]*?<\|tool_call\|>/g, "");
  clean = clean.replace(/<\|.*?\|>/g, "");
  clean = clean.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
  clean = clean.replace(/\[TOOL_REQUEST\][\s\S]*?\[\/TOOL_REQUEST\]/gi, "");
  clean = clean.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, "");
  clean = clean.replace(/^call:[a-zA-Z0-9_]+\(\{[\s\S]*?\}\)\s*$/gm, "");

  // 2. 修复行首/行中的伪标题（如「关于「...」」「背景与原理解析」「关键维度多维对比」「检索证据与来源」没有加 # 的情况）
  clean = clean.replace(/^([ \t]*)(关于[「『“"].*?[」』”].*?)$/gm, "$1## $2");
  clean = clean.replace(/^([ \t]*)(背景与原理解析|核心原理解析|原理解析|关键维度多维对比|多维对比矩阵|对比分析|检索证据与来源|核心信源证据|参考资料|事实依据)$/gm, "$1### $2");

  // 3. 修复畸形 Markdown 表格
  const lines = clean.split("\n");
  const processedLines: string[] = [];
  let tableHeaderGenerated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测含有 |:---|:---| 且带有内容单元格的行
    if (line.includes("|:---") || line.includes("|---") || (line.includes("|") && line.includes(":---:"))) {
      if (/\|.*?[^\s:-]+.*?\|.*?(?::---|-{3,}).*?\|/.test(line)) {
        const rawCells = line
          .split(/\|+/)
          .map(c => c.trim())
          .filter(c => c && !/^:?-+:?$/.test(c));

        if (!tableHeaderGenerated && rawCells.length > 0) {
          processedLines.push("");
          processedLines.push("| 维度 / 信源 | 渠道来源 | 证据提炼与结论 |");
          processedLines.push("| :--- | :--- | :--- |");
          tableHeaderGenerated = true;
        }

        if (rawCells.length > 0) {
          // 清洗单元格前缀中的「维度／信源」「证据提炼」等标签
          const normalized = rawCells.map(c => c.replace(/^(维度[／/]?信源|证据提炼|渠道)\s*[:：]?\s*/i, "").trim());
          processedLines.push("| " + normalized.join(" | ") + " |");
          continue;
        }
      }
    } else {
      if (tableHeaderGenerated && !line.trim().startsWith("|")) {
        tableHeaderGenerated = false;
      }
    }

    processedLines.push(line);
  }

  clean = processedLines.join("\n");

  // 4. 保证标题行前后的空行，避免 Markdown 粘连为普通段落
  clean = clean.replace(/([^\n])\n(#{1,6}\s+)/g, "$1\n\n$2");
  clean = clean.replace(/(#{1,6}\s+[^\n]+)\n([^\n#])/g, "$1\n\n$2");

  return clean.trim();
}

/**
 * shadcn/ui 语汇 + GFM 规范 (表格/列表/代码块/信源) + 流式动效 Markdown 渲染器
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  children,
  className,
  isStreaming = false,
  sources = [],
  onOpenUrl
}) => {
  const processedText = useMemo(() => preprocessMarkdown(children), [children]);

  return (
    <div className={cn("max-w-none text-sm leading-relaxed", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-2.5 first:mt-0 text-base sm:text-lg font-bold tracking-tight text-foreground border-b border-border/40 pb-1.5">
              {renderChildrenWithCitations(children, sources, onOpenUrl)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 first:mt-0 text-sm sm:text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span className="inline-block w-1.5 h-4 bg-primary rounded-full shrink-0" />
              <span>{renderChildrenWithCitations(children, sources, onOpenUrl)}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3.5 mb-1.5 text-xs sm:text-sm font-semibold text-foreground/95">
              {renderChildrenWithCitations(children, sources, onOpenUrl)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-3 mb-1 text-xs font-semibold text-foreground/90">
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
            <blockquote className="my-3 border-l-2 border-primary/50 bg-primary/5 px-3.5 py-2 rounded-r-lg italic text-muted-foreground">
              {renderChildrenWithCitations(children, sources, onOpenUrl)}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3.5 w-full overflow-x-auto rounded-xl border border-border/80 bg-background/50 shadow-xs">
              <table className="w-full text-left text-xs border-collapse divide-y divide-border/70">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60 text-foreground font-semibold text-xs border-b border-border/70">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/40 text-foreground/90">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-muted/30 even:bg-muted/10">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2.5 font-semibold text-foreground text-xs whitespace-nowrap">
              {renderChildrenWithCitations(children, sources, onOpenUrl)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2.5 text-xs text-foreground/90 leading-relaxed align-top">
              {renderChildrenWithCitations(children, sources, onOpenUrl)}
            </td>
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
        {processedText}
      </Markdown>

      {/* 流式生成时光标脉冲 */}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-primary rounded-xs animate-pulse ml-0.5 align-middle shadow-xs shadow-primary/50" />
      )}
    </div>
  );
};
