import React, { useState, useMemo, useEffect } from "react";
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
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Send,
  MessageSquare,
  CornerDownLeft
} from "lucide-react";
import { SearchSynthesisResult, ChatTurn } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { MarkdownContent, SourceCitation } from "./MarkdownContent.js";
import { Button } from "../../components/ui/button.js";
import { Badge } from "../../components/ui/badge.js";

export interface AiAnswerWidgetProps {
  result?: SearchSynthesisResult | any;
  query?: string;
  summary?: string;
  isStreaming?: boolean;
  isProviderError?: boolean;
  errorText?: string;
  onRetry?: () => void;
  ratioMode?: "flexible" | "strict";
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  onAskFollowUp?: (question: string) => Promise<void> | void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
  flipTile?: () => void;
}

function cleanAdFromSummary(text: string): string {
  if (!text) return "";
  let clean = text.trim();
  clean = clean.replace(/^[【\[(（]?(?:广告|商业推广|推广|赞助商?|AD|Sponsored|Advertisement)[】\])）]?[:：·\-\s]+/i, "");
  clean = clean.replace(/[【\[(（]?(?:广告|商业推广|推广|赞助商?|AD|Sponsored|Advertisement)[】\])）]?$/i, "");

  // 清洗泄露的伪工具交互转录与原始检索结果 JSON 块
  clean = clean.replace(/(?:^|\n)(?:Tool:\s*[a-zA-Z0-9_]+|Query:\s*[^\n]+|Language:\s*[^\n]+|Recency Days:\s*[^\n]+|Arguments:\s*\{[\s\S]*?\}|Result:\s*\{[\s\S]*?\})\s*(?=\n|$)/gi, "");
  clean = clean.replace(/search_web\s+query="[^"]*"[^\n]*/gi, "");
  clean = clean.replace(/\{\s*"results"\s*:\s*\[[\s\S]*?\]\s*\}/gi, "");

  // 逐行剔除包含明确广告特征的行
  const lines = clean.split("\n");
  const filteredLines = lines.filter((line) => {
    const l = line.trim();
    if (!l) return true;
    if (/^[【\[(（]?(?:广告|商业推广|推广|赞助商?|AD|Sponsored)[】\])）]/i.test(l)) return false;
    if (/(?:商业推广|广告推广|赞助商链接|推广链接|点击进入|立即购买|限时抢购|招商加盟|加微信|加V:|免费领取优惠券)/i.test(l)) {
      return false;
    }
    return true;
  });
  clean = filteredLines.join("\n").trim();

  // 若全文主要是营销广告词或纯机器转录，彻底清空
  if (
    (clean.length < 240 && /(?:商业推广|广告推广|赞助商链接|推广链接|点击进入|立即购买|限时抢购|招商加盟|加微信|加V:)/i.test(clean)) ||
    clean.startsWith("{") ||
    clean.startsWith("search_web")
  ) {
    return "";
  }
  return clean.trim();
}

/**
 * AI 智能回答小组件 (正面)
 * 沉浸式展示基于全网多信源的 AI 深度综合回答、核心要点结论与智能拓展追问
 */
export const AiAnswerWidget: React.FC<AiAnswerWidgetProps> = ({
  result,
  query: customQuery,
  summary: customSummary,
  isStreaming = false,
  isProviderError = false,
  errorText,
  onRetry,
  ratioMode = "flexible",
  onExecuteSearch,
  onAskFollowUp,
  openUrl,
  copyText,
  flipTile
}) => {
  const [copied, setCopied] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth < 768 : false;
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const effectiveQuery = (customQuery || result?.query || "智能检索").trim();
  const rawSummary =
    customSummary ||
    result?.summary ||
    result?.answer ||
    result?.content ||
    result?.chatText ||
    result?.text ||
    result?.finalResponse ||
    result?.markdown ||
    (typeof result === "string" ? result : "");
  const extractedSummary = (typeof rawSummary === "string" ? rawSummary : String(rawSummary || "")).trim();
  const summary = cleanAdFromSummary(extractedSummary);
  const filteredResults = result?.filteredResults || [];
  const sourcesCount = filteredResults.length;

  const cleanSummaryFromSources = useMemo(() => {
    if (summary) return summary;
    if (!filteredResults || filteredResults.length === 0) return "";
    const cleanItems = filteredResults.filter((s: any) => {
      const text = `${s.title || ""} ${s.snippet || ""}`;
      return !/^[【\[(（]?(?:广告|商业推广|推广|赞助商?)[】\])）]|(?:商业推广|赞助商链接|推广链接|广告推广|正品低价)/i.test(text);
    });
    if (cleanItems.length === 0) return "";
    const primary = cleanItems[0];
    const lead = `${cleanAdFromSummary(primary.snippet || primary.title)} [1]`;
    const rest = cleanItems
      .slice(1, 4)
      .map((s: any, idx: number) => {
        const snip = cleanAdFromSummary(s.snippet || s.title);
        return snip ? `- **${s.title}**：${snip} [${idx + 2}]` : null;
      })
      .filter(Boolean);
    return rest.length > 0 ? `${lead}\n\n${rest.join("\n")}` : lead;
  }, [summary, filteredResults]);

  const effectiveSummary = summary || cleanSummaryFromSources;
  const keyTakeaways = result?.keyTakeaways || [];
  const followUpQuestions = result?.followUpQuestions || [];
  const modelUsed = result?.modelUsed || (summary ? "AI 深度推理引擎" : "AI 权威信源综合");
  const executionTimeMs = result?.executionTimeMs || 0;

  // 会话轮次解析：支持从 result.chatTurns 恢复多轮追问上下文
  const chatTurns: ChatTurn[] = useMemo(() => {
    if (result?.chatTurns && Array.isArray(result.chatTurns) && result.chatTurns.length > 0) {
      return result.chatTurns;
    }
    return [];
  }, [result?.chatTurns]);

  // 新增消息或流式片段到达时自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatTurns, effectiveSummary, isStreaming]);

  // 将信源转换为 Markdown 可溯源引用的格式
  const citations: SourceCitation[] = useMemo(() => {
    return filteredResults.map((item: any, idx: number) => ({
      index: idx + 1,
      title: item.title,
      url: item.url,
      snippet: item.snippet
    }));
  }, [filteredResults]);

  const handleCopy = () => {
    let textToCopy = `${effectiveQuery ? `### ${effectiveQuery}\n\n` : ""}${effectiveSummary}`;
    if (chatTurns.length > 0) {
      textToCopy = chatTurns
        .map((t) => `${t.role === "user" ? "Q" : "A"}: ${t.content}`)
        .join("\n\n");
    }
    if (copyText) {
      copyText(textToCopy);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollowUpSubmit = async (textToSubmit?: string) => {
    const q = (textToSubmit ?? inputText).trim();
    if (!q || isStreaming || isSubmitting) return;

    setInputText("");
    setIsSubmitting(true);
    try {
      if (onAskFollowUp) {
        await onAskFollowUp(q);
      } else if (onExecuteSearch) {
        onExecuteSearch(q);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUpClick = (question: string) => {
    handleFollowUpSubmit(question);
  };

  return (
    <IOSWidget
      id="ai_answer"
      title="AI 智能回答"
      icon={<Sparkles className="size-4 text-primary" />}
      ratioMode={ratioMode}
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          {isStreaming ? (
            <Badge variant="secondary" className="text-[11px] h-5 gap-1 font-normal bg-primary/15 text-primary border-primary/30 animate-pulse">
              <span className="size-1.5 rounded-full bg-primary animate-ping" />
              <span>正在思考中</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px] h-5 gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              <Bot className="size-3" />
              <span className="truncate max-w-[120px]">{modelUsed}</span>
            </Badge>
          )}

          {executionTimeMs > 0 && !isStreaming && (
            <Badge variant="outline" className="text-[11px] h-5 gap-1 text-muted-foreground font-normal">
              <Timer className="size-3" />
              <span>{(executionTimeMs / 1000).toFixed(1)}s</span>
            </Badge>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-1">
          {effectiveSummary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              title="复制对话全文"
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
          )}

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
      className={`w-full transition-all duration-300 ${
        isStreaming ? "border-primary/40 ring-1 ring-primary/15 shadow-sm" : "border-border/80"
      } bg-card`}
      contentClassName="p-3 sm:p-4 flex flex-col h-[520px] max-h-[580px] gap-2.5 overflow-hidden"
    >
      {/* 状态：Provider Error 局部克制提示 */}
      {isProviderError && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                AI 服务暂时不可用，已为你保留网页搜索结果
              </p>
              {errorText && (
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                  {errorText}
                </p>
              )}
            </div>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2.5 text-xs gap-1 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 self-end sm:self-auto cursor-pointer shrink-0"
            >
              <RefreshCw className="size-3" />
              <span>重试</span>
            </Button>
          )}
        </div>
      )}

      {/* 消息滚动容器：承载首轮全景研报与后续多轮对话 */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin">
        {chatTurns.length > 0 ? (
          // 多轮对话模式
          chatTurns.map((turn, index) => {
            if (turn.role === "user") {
              return (
                <div key={turn.id || index} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary text-primary-foreground px-3.5 py-2 text-xs sm:text-sm shadow-xs leading-relaxed break-words">
                    {turn.content}
                  </div>
                </div>
              );
            }

            // Assistant 回答
            const isFirstAssistantTurn = index <= 1;
            const turnText = cleanAdFromSummary(turn.content || (isFirstAssistantTurn ? effectiveSummary : ""));

            return (
              <div key={turn.id || index} className="flex gap-2.5 items-start">
                <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="size-3.5" />
                </div>
                <div className="flex-1 bg-background/50 rounded-2xl rounded-tl-xs border border-border/60 p-3 text-xs sm:text-sm text-foreground shadow-xs space-y-2">
                  {turnText ? (
                    <MarkdownContent
                      className="leading-relaxed text-xs sm:text-sm"
                      isStreaming={turn.isStreaming}
                      sources={citations}
                      onOpenUrl={openUrl}
                    >
                      {turnText}
                    </MarkdownContent>
                  ) : turn.isStreaming ? (
                    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground animate-pulse">
                      <span className="size-1.5 rounded-full bg-primary animate-ping" />
                      <span>正在组织深度回答...</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">暂无回答内容</p>
                  )}
                </div>
              </div>
            );
          })
        ) : effectiveSummary ? (
          // 首轮单次研报渲染（向后兼容）
          <div className="bg-background/40 rounded-xl border border-border/60 p-3.5 sm:p-4">
            <MarkdownContent
              className="leading-relaxed text-sm"
              isStreaming={isStreaming}
              sources={citations}
              onOpenUrl={openUrl}
            >
              {effectiveSummary}
            </MarkdownContent>
          </div>
        ) : isStreaming ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-primary/30 bg-primary/[0.02] rounded-xl animate-pulse">
            <Sparkles className="size-6 text-primary mb-2 animate-spin" />
            <p className="text-xs sm:text-sm font-medium text-foreground">
              Codex 智能体正在流式组织深度回答...
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              根据全网检索的权威信源交叉验证并撰写报告
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <Bot className="size-7 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs sm:text-sm font-medium">暂无 AI 回答内容</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              可尝试重新检索或追问细节
            </p>
          </div>
        )}

        {/* 智能拓展追问推荐气泡 */}
        {followUpQuestions.length > 0 && !isStreaming && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <HelpCircle className="size-3 text-primary" />
              <span>智能推荐追问：</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {followUpQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleFollowUpClick(q)}
                  disabled={isStreaming || isSubmitting}
                  className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/80 transition-all text-foreground text-left cursor-pointer disabled:opacity-50"
                  title={`点击追问: ${q}`}
                >
                  <span className="truncate max-w-[240px] sm:max-w-[340px]">{q}</span>
                  <ArrowRight className="size-2.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部追问输入框（钉在底部） */}
      <div className="pt-2 border-t border-border/50 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFollowUpSubmit();
          }}
          className="flex items-center gap-1.5"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleFollowUpSubmit();
                }
              }}
              placeholder="向 AI 追问或补充细节... (Enter 发送)"
              disabled={isStreaming || isSubmitting}
              className="w-full bg-background/80 border border-border/80 rounded-xl px-3 py-1.5 pr-8 text-xs sm:text-sm placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all"
            />
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground text-xs"
              >
                ×
              </button>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!inputText.trim() || isStreaming || isSubmitting}
            className="h-8 px-3 rounded-xl text-xs gap-1 cursor-pointer shrink-0"
          >
            <Send className="size-3" />
            <span className="hidden sm:inline">发送</span>
          </Button>
          {onExecuteSearch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onExecuteSearch(effectiveQuery, true)}
              disabled={isStreaming || isSubmitting}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl shrink-0"
              title="重新全网深度搜索"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
        </form>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-1.5 px-0.5">
          <span className="flex items-center gap-1">
            <BookOpen className="size-2.5 text-primary/70" />
            基于 {sourcesCount} 个权威信源多轮推理
          </span>
          <span className="italic truncate max-w-[160px]">
            {effectiveQuery}
          </span>
        </div>
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
  summary: customSummary,
  openUrl,
  copyText,
  flipTile
}) => {
  const [copiedRaw, setCopiedRaw] = useState(false);
  const rawSummary =
    customSummary ||
    result?.summary ||
    result?.answer ||
    result?.content ||
    result?.chatText ||
    result?.text ||
    result?.finalResponse ||
    result?.markdown ||
    (typeof result === "string" ? result : "");
  const extractedSummary = (typeof rawSummary === "string" ? rawSummary : String(rawSummary || "")).trim();
  const summary = cleanAdFromSummary(extractedSummary);
  const filteredResults = result?.filteredResults || [];

  const cleanSummaryFromSources = useMemo(() => {
    if (summary) return summary;
    if (!filteredResults || filteredResults.length === 0) return "";
    const cleanItems = filteredResults.filter((s: any) => {
      const text = `${s.title || ""} ${s.snippet || ""}`;
      return !/^[【\[(（]?(?:广告|商业推广|推广|赞助商?)[】\])）]|(?:商业推广|赞助商链接|推广链接|广告推广|正品低价)/i.test(text);
    });
    if (cleanItems.length === 0) return "";
    const primary = cleanItems[0];
    const lead = `${cleanAdFromSummary(primary.snippet || primary.title)} [1]`;
    const rest = cleanItems
      .slice(1, 4)
      .map((s: any, idx: number) => {
        const snip = cleanAdFromSummary(s.snippet || s.title);
        return snip ? `- **${s.title}**：${snip} [${idx + 2}]` : null;
      })
      .filter(Boolean);
    return rest.length > 0 ? `${lead}\n\n${rest.join("\n")}` : lead;
  }, [summary, filteredResults]);

  const effectiveSummary = summary || cleanSummaryFromSources;
  const modelUsed = result?.modelUsed || (summary ? "Deep Reasoning Agent" : "AI 权威信源综合");
  const executionTimeMs = result?.executionTimeMs || 0;

  const handleCopyRaw = () => {
    if (copyText) {
      copyText(effectiveSummary);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(effectiveSummary);
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
      className="w-full h-auto border-border/80 bg-card"
      contentClassName="p-4 sm:p-5 flex flex-col gap-4"
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
        <div className="space-y-1.5">
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
