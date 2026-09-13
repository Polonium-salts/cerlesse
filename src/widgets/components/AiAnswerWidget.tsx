import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Bot,
  Timer,
  BookOpen,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  Share2,
  ExternalLink
} from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { MarkdownContent } from "./MarkdownContent.js";
import { Button } from "../../components/ui/button.js";
import { Badge } from "../../components/ui/badge.js";

export interface AiAnswerWidgetProps {
  result?: SearchSynthesisResult;
  query?: string;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
  flipTile?: () => void;
}

/**
 * AI 智能回答小组件 (正面)
 * 沉浸式展示基于全网多信源的 AI 深度综合回答、核心要点结论与智能拓展追问
 */
export const AiAnswerWidget: React.FC<AiAnswerWidgetProps> = ({
  result,
  query: customQuery,
  onExecuteSearch,
  openUrl,
  copyText,
  flipTile
}) => {
  const [copied, setCopied] = useState(false);

  const effectiveQuery = (customQuery || result?.query || "智能检索").trim();
  const summary = result?.summary || "";
  const keyTakeaways = result?.keyTakeaways || [];
  const followUpQuestions = result?.followUpQuestions || [];
  const modelUsed = result?.modelUsed || "AI 深度推理引擎";
  const executionTimeMs = result?.executionTimeMs || 0;
  const sourcesCount = result?.filteredResults?.length || 0;

  const handleCopy = () => {
    const textToCopy = `${effectiveQuery ? `### ${effectiveQuery}\n\n` : ""}${summary}`;
    if (copyText) {
      copyText(textToCopy);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollowUpClick = (question: string) => {
    if (onExecuteSearch) {
      onExecuteSearch(question);
    }
  };

  return (
    <IOSWidget
      title="AI 智能回答"
      icon={<Sparkles className="size-4 text-primary" />}
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[11px] h-5 gap-1 font-normal bg-primary/10 text-primary border-primary/20">
            <Bot className="size-3" />
            <span className="truncate max-w-[120px]">{modelUsed}</span>
          </Badge>
          {executionTimeMs > 0 && (
            <Badge variant="outline" className="text-[11px] h-5 gap-1 text-muted-foreground font-normal">
              <Timer className="size-3" />
              <span>{(executionTimeMs / 1000).toFixed(1)}s</span>
            </Badge>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            title="复制 AI 回答全文"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-600 font-medium">已复制</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>复制</span>
              </>
            )}
          </Button>

          {flipTile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={flipTile}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              title="翻转查看信源与元数据"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      }
      className="w-full h-full border-border/80 bg-card"
      contentClassName="overflow-y-auto p-3.5 sm:p-4 flex flex-col gap-3"
    >
      {/* 1. 核心结论要点 (Key Takeaways) */}
      {keyTakeaways.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
            <CheckCircle2 className="size-3.5" />
            <span>核心提炼与结论速览</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-foreground/90">
            {keyTakeaways.map((takeaway, idx) => (
              <li key={idx} className="flex items-start gap-1.5 bg-background/60 rounded-md p-2 border border-border/50">
                <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span className="leading-snug">{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. AI 深度回答正文 (Markdown Content) */}
      {summary ? (
        <div className="flex-1 bg-background/40 rounded-xl border border-border/60 p-3.5 sm:p-4">
          <MarkdownContent className="leading-relaxed text-sm">
            {summary}
          </MarkdownContent>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          <Bot className="size-7 text-muted-foreground/50 mb-1.5 animate-pulse" />
          <p className="text-xs sm:text-sm font-medium">正在生成 AI 综合智能回答...</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            正在调度智能体清洗信源并进行深度结构化提炼
          </p>
        </div>
      )}

      {/* 3. 智能拓展追问 (Follow-up Questions) */}
      {followUpQuestions.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HelpCircle className="size-3.5 text-primary" />
            <span>您可能还想探索：</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {followUpQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleFollowUpClick(q)}
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border transition-all text-foreground text-left cursor-pointer"
                title={`点击搜索: ${q}`}
              >
                <span className="truncate max-w-[240px] sm:max-w-[360px]">{q}</span>
                <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. 底部信源支持说明 */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
        <div className="flex items-center gap-2">
          <BookOpen className="size-3 text-primary/70" />
          <span>
            已综合参考全网 <strong className="text-foreground">{sourcesCount}</strong> 个权威信源数据
          </span>
        </div>
        {effectiveQuery && (
          <span className="truncate max-w-[200px] italic text-muted-foreground/70">
            主题: {effectiveQuery}
          </span>
        )}
      </div>
    </IOSWidget>
  );
};

/**
 * AI 智能回答小组件 (背面 - Live Tile 3D 反面)
 * 展示模型推理技术细节、原始 Markdown、信源索引与可操作面板
 */
export const AiAnswerBackWidget: React.FC<AiAnswerWidgetProps> = ({
  result,
  query: customQuery,
  openUrl,
  copyText,
  flipTile
}) => {
  const [copiedRaw, setCopiedRaw] = useState(false);
  const summary = result?.summary || "";
  const modelUsed = result?.modelUsed || "Deep Reasoning Agent";
  const executionTimeMs = result?.executionTimeMs || 0;
  const filteredResults = result?.filteredResults || [];

  const handleCopyRaw = () => {
    if (copyText) {
      copyText(summary);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(summary);
    }
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <IOSWidget
      title="AI 回答元数据与信源溯源"
      icon={<Bot className="size-4 text-primary" />}
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={flipTile}
            className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
            title="翻转回正文回答"
          >
            <RotateCcw className="size-3.5" />
            <span>返回正面</span>
          </Button>
        </div>
      }
      className="w-full h-full border-border/80 bg-card"
      contentClassName="overflow-y-auto p-4 sm:p-5 flex flex-col gap-4"
    >
      {/* 推理指标卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">推理模型</span>
          <span className="text-xs font-semibold text-foreground truncate mt-0.5" title={modelUsed}>
            {modelUsed}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">总耗时</span>
          <span className="text-xs font-semibold text-foreground mt-0.5">
            {(executionTimeMs / 1000).toFixed(2)} 秒
          </span>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">字数统计</span>
          <span className="text-xs font-semibold text-foreground mt-0.5">
            {summary.length} 字符
          </span>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">已研判信源</span>
          <span className="text-xs font-semibold text-foreground mt-0.5">
            {filteredResults.length} 篇
          </span>
        </div>
      </div>

      {/* 引用信源快速直达 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-primary" />
          核心参引网页与文档
        </span>
        <div className="max-h-[160px] overflow-y-auto space-y-1.5 no-scrollbar">
          {filteredResults.slice(0, 6).map((source, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/60 bg-background/40 hover:bg-muted/40 text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="truncate text-foreground" title={source.title}>
                  {source.title}
                </span>
              </div>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (openUrl) {
                    e.preventDefault();
                    openUrl(source.url);
                  }
                }}
                className="shrink-0 text-primary hover:underline flex items-center gap-0.5 text-[11px]"
              >
                <span>直达</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* 原始 Markdown 导出与复制 */}
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">需要将 AI 回答用于文档或研报？</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyRaw}
          className="text-xs h-7 gap-1.5"
        >
          {copiedRaw ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span>已复制 Markdown</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>复制 Markdown 原文</span>
            </>
          )}
        </Button>
      </div>
    </IOSWidget>
  );
};
