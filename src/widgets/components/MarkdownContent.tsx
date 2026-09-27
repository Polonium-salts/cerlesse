import React from "react";
import Markdown from "react-markdown";
import { cn } from "../../lib/utils.js";

/**
 * shadcn/ui Typography 语汇的 Markdown 正文渲染器（小组件共用）
 * ============================================================
 * AI 深度研报与分面专题研报都要渲染 Markdown，此前各自内联一份映射表，
 * 一旦调整排版就要改两处。这里收敛为单一实现：
 *
 *   · 标题 —— font-semibold + tracking-tight，层级只靠字号区分
 *   · 正文 —— text-sm leading-6 text-foreground
 *   · 列表 —— marker 弱化为 text-muted-foreground
 *   · 引用 —— border-l-2 border-border + italic + text-muted-foreground
 *   · 行内码 —— bg-muted rounded 小块
 *   · 链接 —— 下划线 + underline-offset-4，符合 shadcn 规范
 *
 * 颜色全部走语义令牌，明暗主题无需 dark: 分支。
 */
export const MarkdownContent: React.FC<{
  children: string;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn("max-w-none text-sm", className)}>
    <Markdown
      components={{
        h1: ({ children }) => (
          <h1 className="mt-4 mb-2 first:mt-0 text-base font-semibold tracking-tight text-foreground">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-4 mb-2 first:mt-0 text-sm font-semibold tracking-tight text-foreground">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 mb-1.5 text-sm font-medium text-foreground">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-3 mb-1.5 text-sm font-medium text-foreground">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="my-2.5 text-sm leading-6 text-foreground">{children}</p>
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
        li: ({ children }) => <li className="leading-6">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-foreground">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-border pl-4 italic text-muted-foreground">
            {children}
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
            className="font-medium text-foreground underline underline-offset-4"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-4 border-border" />
      }}
    >
      {children}
    </Markdown>
  </div>
);
