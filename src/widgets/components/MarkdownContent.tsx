import React, { useState, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { cn } from "../../lib/utils.js";
import { getUiStrings } from "../../lib/appLanguage.js";
import { ExternalLink } from "lucide-react";
import {
  CitationMarker,
  SourceFavicon,
  isBareUrlLabel,
  isExternalUrl,
  nodeToText,
  prettySourceUrl
} from "./SourceLink.js";
import type { SourceCitation } from "./SourceLink.js";
// KaTeX / highlight.js 的 CSS 统一在 src/index.css 里 @import，
// 保持项目「单一全局样式入口」的约定，也避免 Node 侧单测加载 CSS 失败。

// SourceCitation 的唯一定义处在 SourceLink.tsx（角标 / 预览卡 / 背面信源列表共用），
// 这里再导出一次是为了不改动既有引用方的 import 路径。
export type { SourceCitation };

export interface MarkdownContentProps {
  children: string;
  className?: string;
  isStreaming?: boolean;
  sources?: SourceCitation[];
  onOpenUrl?: (url: string) => void;
  /** 全局语言设置（settings.language）；只影响代码块复制按钮这类界面文案 */
  language?: string;
}

/**
 * 递归转换文本节点中的 [1], [2], [source-1] 以及文本标题/摘要引用为交互式信源角标
 */
function renderChildrenWithCitations(
  children: React.ReactNode,
  sources?: SourceCitation[],
  onOpenUrl?: (url: string) => void,
  language?: string
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
        <CitationMarker
          key={`cite-${matchStart}-${citationIndex}`}
          index={citationIndex}
          source={matchedSource}
          onOpenUrl={onOpenUrl}
          language={language}
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
        {renderChildrenWithCitations(child, sources, onOpenUrl, language)}
      </React.Fragment>
    ));
  }

  return children;
}

/**
 * 逐行配对 ``` / ~~~ 围栏代码块。
 *
 * 为什么不能用单个全局正则：围栏正则里的空白类（\s* / \s+）能跨行吃掉换行，
 * 于是上一个代码块的**结束**围栏会被当成下一个块的**开始**围栏，
 * 「工具调用 JSON 块紧跟在普通代码块之后」这种真实排版就整块漏过。
 * 只有逐行状态机才能把开闭标记正确配对。
 */
interface FenceBlock {
  /** 起始围栏所在行号 */
  start: number;
  /** 结束围栏所在行号（未闭合时为最后一行） */
  end: number;
  /** 起始围栏的 info string（已转小写） */
  lang: string;
  /** 围栏体内的文本 */
  body: string;
  closed: boolean;
}

function scanFenceBlocks(lines: string[]): Map<number, FenceBlock> {
  const blocks = new Map<number, FenceBlock>();
  let i = 0;
  while (i < lines.length) {
    const open = /^[ \t]*(`{3,}|~{3,})[ \t]*([^\s`]*)[ \t]*$/.exec(lines[i]);
    if (!open) {
      i++;
      continue;
    }
    const marker = open[1];
    const fenceChar = marker[0];
    // fenceChar 只可能是 ` 或 ~，都不是正则元字符，直接拼进量词即可
    const closeRe = new RegExp(`^[ \\t]*${fenceChar}{${marker.length},}[ \\t]*$`);
    let j = i + 1;
    while (j < lines.length && !closeRe.test(lines[j])) j++;
    const closed = j < lines.length;
    const end = closed ? j : lines.length - 1;
    blocks.set(i, {
      start: i,
      end,
      lang: (open[2] || "").toLowerCase(),
      body: lines.slice(i + 1, end).join("\n"),
      closed
    });
    i = closed ? j + 1 : lines.length;
  }
  return blocks;
}

/** 围栏体是否是「模型吐出来的工具调用转录」 */
function isToolCallTranscript(lang: string, body: string): boolean {
  if (lang && !["json", "javascript", "js"].includes(lang)) return false;
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return (
      !!parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof parsed.name === "string" &&
      (parsed.arguments !== undefined || parsed.parameters !== undefined) &&
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.name)
    );
  } catch {
    // 不是合法 JSON（例如流式输出被截断），保守当作普通示例代码保留
    return false;
  }
}

/**
 * 剔除围栏代码块里的纯工具调用转录，其他代码块原样保留。
 */
export function stripToolCallFences(text: string): string {
  if (!text.includes("```") && !text.includes("~~~")) return text;
  const lines = text.split("\n");
  const blocks = scanFenceBlocks(lines);
  if (blocks.size === 0) return text;

  const drop = new Set<number>();
  for (const block of blocks.values()) {
    if (!block.closed) continue;
    if (!isToolCallTranscript(block.lang, block.body)) continue;
    for (let k = block.start; k <= block.end; k++) drop.add(k);
  }
  if (drop.size === 0) return text;
  return lines.filter((_, idx) => !drop.has(idx)).join("\n");
}

/**
 * 把单行 `$$…$$` 归一成 remark-math 认得的块式写法：
 *
 * $$
 * E = mc^2
 * $$
 *
 * 围栏代码块内部原样保留（代码示例里的 $$ 不是公式）。
 */
export function normalizeSingleLineDisplayMath(text: string): string {
  if (!text.includes("$$")) return text;
  const lines = text.split("\n");
  const fences = scanFenceBlocks(lines);
  const fenceLines = new Set<number>();
  for (const block of fences.values()) {
    for (let k = block.start; k <= block.end; k++) fenceLines.add(k);
  }

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fenceLines.has(i)) {
      out.push(line);
      continue;
    }
    // 必须是整行都是 $$…$$，且中间非空；行内混排（“见 $$x$$ ”）留给 inlineMath
    const m = /^[ \t]*\$\$(.+?)\$\$[ \t]*$/.exec(line);
    if (m && m[1].trim()) {
      out.push("$$");
      out.push(m[1].trim());
      out.push("$$");
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * 预处理并清洗大模型生成的 Markdown 文本：
 * 1. 过滤未捕获的模型协议标签与工具调用泄漏（如 <|tool_call|>call:search_web{...}<|tool_call|>、<tool_call> 等）
 * 1b. 剔除围栏代码块里的纯工具调用转录（逐行配对围栏，不误伤普通 JSON 示例）
 * 1c. 单行 $$…$$ 展公式归一为块式，否则不会被 KaTeX 渲染成独立公式
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

  // 1b. 剔除围栏代码块里的「纯工具调用转录」。
  // 实际观察到模型会把一次未执行的调用包成 JSON 代码块吐在正文里：
  //   ```json
  //   {"name": "search_web", "arguments": {"query": "..."}}
  //   ```
  // 旧的 startsWith("{") 兜底只认裸 JSON，被 ``` 围栏包住就漏过去了，
  // 于是机器调用痕迹直接混在回答正文里。这里只删「解析后确实是工具调用对象」的块，
  // 普通的 JSON 示例代码（没有 name/arguments 结构）必须原样保留。
  //
  // 必须逐行配对围栏，不能用单个全局正则：旧正则的 \s* 会跨行吃掉换行，
  // 于是「上一个代码块的结束围栏」被误当成「下一个块的开始围栏」，
  // 工具调用块紧跟在普通代码块之后时就整块漏过（已在真实 UI 上复现）。
  clean = stripToolCallFences(clean);

  // 1c. 单行 $$…$$ 展公式归一为三行块。
  // remark-math 只有在 $$ 独占行时才产出 display(math) 节点；
  // 模型最常见的写法 `$$E=mc^2$$` 会被当成 inlineMath 挤在段落里。
  // 这里只在围栏之外做归一，避免改掉代码示例里的 $$ 字面量。
  clean = normalizeSingleLineDisplayMath(clean);

  // 2. 修复畸形 Markdown 表格
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
 * 带语言标签与一键复制的代码块。
 *
 * 为什么要自己包一层：GFM 的 ```lang 围栏本来会被 remark-gfm 解析成
 * <pre><code class="language-js">，但既没有语言标识也无法复制。
 * AI 回答里代码块出现频率很高，这两件事直接决定它可不可用。
 */
function CodeBlock({ children, className, language: uiLanguage }: { children?: React.ReactNode; className?: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const ui = getUiStrings(uiLanguage);

  // react-markdown 把语言放在 <code class="language-xxx"> 上，
  // 因此这里从子元素的 className 里反推语言标签。
  let language = "";
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const cls = (child.props as { className?: string })?.className || "";
      const m = cls.match(/language-([\w+#.-]+)/);
      if (m) language = m[1];
    }
  });

  const handleCopy = () => {
    const text = React.Children.toArray(children)
      .map((c) => (React.isValidElement(c) ? String((c.props as { children?: React.ReactNode })?.children ?? "") : ""))
      .join("");
    if (!text) return;
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 first:mt-0 group/code relative overflow-hidden rounded-lg border border-border/70 bg-muted/60">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/80 px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          title={ui.mdCopy}
        >
          {copied ? ui.aiCopied : ui.mdCopy}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-foreground">
        {children}
      </pre>
    </div>
  );
}

/**
 * shadcn/ui 语汇 + GFM 规范 + KaTeX 数学 + 代码高亮 + 信源角标 + 流式动效
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  children,
  className,
  isStreaming = false,
  sources = [],
  onOpenUrl,
  language
}) => {
  const processedText = useMemo(() => preprocessMarkdown(children), [children]);

  return (
    <div className={cn("max-w-none text-[15px] leading-7", className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, errorColor: "#ef4444", strict: false }],
          [rehypeHighlight, { detect: true, ignoreMissing: true }]
        ]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 first:mt-0 text-lg sm:text-xl font-bold tracking-tight text-foreground border-b border-border/40 pb-2">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2.5 first:mt-0 text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span className="inline-block w-1.5 h-4 bg-primary rounded-full shrink-0" />
              <span>{renderChildrenWithCitations(children, sources, onOpenUrl, language)}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 first:mt-0 text-sm sm:text-base font-semibold text-foreground/95">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-4 mb-1.5 first:mt-0 text-[13px] sm:text-sm font-semibold text-foreground/90">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-3.5 text-[15px] leading-7 text-foreground">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-3.5 ml-5 list-disc space-y-2 text-[15px] leading-7 text-foreground marker:text-muted-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3.5 ml-5 list-decimal space-y-2 text-[15px] leading-7 text-foreground marker:text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-7">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-5 first:mt-0 border-l-2 border-primary/50 bg-primary/5 px-4 py-3.5 rounded-r-lg italic text-muted-foreground leading-7">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-5 first:mt-0 w-full overflow-x-auto rounded-xl border border-border/80 bg-background/50 shadow-xs">
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
          code: ({ children, className: codeClass }) => {
            // 围栏代码块交给 CodeBlock（带语言标签与复制），这里只管行内代码
            const isBlock = /language-/.test(codeClass || "");
            if (isBlock) {
              return <code className={cn("font-mono text-xs", codeClass)}>{children}</code>;
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <CodeBlock language={language}>{children}</CodeBlock>,
          // GFM 删除线
          del: ({ children }) => (
            <del className="text-muted-foreground line-through">{children}</del>
          ),
          // GFM 任务列表勾选框
          input: (props) => (
            <input
              {...props}
              disabled
              className="mr-1.5 h-3.5 w-3.5 accent-primary align-middle cursor-default"
            />
          ),
          // 表格单元格对齐（GFM :---: / ---: 语法）
          th: ({ children, style }) => (
            <th style={style} className="px-4 py-3 font-semibold text-foreground text-[13px] whitespace-nowrap">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </th>
          ),
          td: ({ children, style }) => (
            <td style={style} className="px-4 py-3 text-[13px] text-foreground/90 leading-6 align-top">
              {renderChildrenWithCitations(children, sources, onOpenUrl, language)}
            </td>
          ),
          // 注意：这里刻意不启用 rehype-raw。AI 回答的正文本质上是被检索内容影响的
          // 模型输出，让它能解析任意 HTML 就等于把 onerror / <script> 交给 React 挂载，
          // 代价与收益不成比例。代价是 <sup>/<sub>/<kbd> 这类只能靠裸 HTML 触发的元素
          // 不会被渲染（它们会以字面量出现在正文里）；GFM / CommonMark 能表达的全部元素
          // （含删除线、任务列表、表格对齐、图片、上下标以外的排版）都已覆盖。
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || ""}
              loading="lazy"
              className="my-4 first:mt-0 max-h-72 rounded-lg border border-border/60 object-contain"
            />
          ),
          // 链接：外链图标改成悬停时才淡入 —— 之前每个链接都常驻一个图标，
          // 在密集的正文里噪音盖过内容本身。
          // 裸 URL（模型直接把地址写进正文）换成 host + 路径的可读形态并补站点色块，
          // 与角标预览卡、背面信源列表共用同一套 host 格式化。
          a: ({ children, href }) => {
            const target = (href || "").trim();
            const external = isExternalUrl(target);
            const label = nodeToText(children);
            const bare = external && isBareUrlLabel(label, target);

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (onOpenUrl && external) {
                    e.preventDefault();
                    onOpenUrl(target);
                  }
                }}
                title={external ? prettySourceUrl(target, 60) : label || undefined}
                className={cn(
                  "group/link break-words transition-colors",
                  external &&
                    "cursor-pointer text-primary underline decoration-primary/35 decoration-1 underline-offset-[3px] hover:decoration-primary focus-visible:decoration-primary"
                )}
              >
                {bare && (
                  <SourceFavicon
                    url={target}
                    className="mr-1 size-3.5 rounded-[4px] align-[0.125em] text-[9px]"
                  />
                )}
                <span>{bare ? prettySourceUrl(target, 44) : children}</span>
                {external && (
                  <ExternalLink className="ml-0.5 inline-block size-3 align-[0.125em] opacity-0 transition-opacity group-hover/link:opacity-70 focus-visible:opacity-70" />
                )}
              </a>
            );
          },
          hr: () => <hr className="my-6 border-border" />
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
