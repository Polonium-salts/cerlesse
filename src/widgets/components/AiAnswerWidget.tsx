import React, { useState, useMemo, useEffect } from "react";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Bot,
  Timer,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  CornerDownLeft
} from "lucide-react";
import { SearchSynthesisResult, ChatTurn, AgentStep } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { MarkdownContent, SourceCitation } from "./MarkdownContent.js";
import { SourceListItem } from "./SourceLink.js";
import { Button } from "../../components/ui/button.js";
import { Badge } from "../../components/ui/badge.js";
import { ReActLoopTimeline } from "./ReActLoopTimeline.js";
import { getUiStrings } from "../../lib/appLanguage.js";

export interface AiAnswerWidgetProps {
  result?: SearchSynthesisResult | any;
  query?: string;
  summary?: string;
  isStreaming?: boolean;
  isProviderError?: boolean;
  errorText?: string;
  onRetry?: () => void;
  ratioMode?: "flexible" | "strict";
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
  flipTile?: () => void;
  /**
   * ReAct-Read 循环思维链的真实执行步骤。
   * 来自 eventBridge 记录的 AgentStep[]，组件只做投影展示，不自行编造推理。
   */
  agentSteps?: AgentStep[];
  /** 全局语言设置（settings.language）；不传则按 auto（中文）渲染界面文案 */
  language?: string;
  /** ask 模式：引导用户改用顶部搜索栏提问（组件内不再自带任何提问入口） */
  askModeHint?: boolean;
}

/**
 * 清洗 AI 回答正文：剔除广告话术与泄露的机器交互痕迹。
 * 导出以便单测锁定「工具调用语法不得混进正文」这一行为。
 */
export function cleanAdFromSummary(text: string): string {
  if (!text) return "";
  let clean = text.trim();
  clean = clean.replace(/^[【\[(（]?(?:广告|商业推广|推广|赞助商?|AD|Sponsored|Advertisement)[】\])）]?[:：·\-\s]+/i, "");
  clean = clean.replace(/[【\[(（]?(?:广告|商业推广|推广|赞助商?|AD|Sponsored|Advertisement)[】\])）]?$/i, "");

  // 清洗泄露的伪工具交互转录与原始检索结果 JSON 块
  clean = clean.replace(/(?:^|\n)(?:Tool:\s*[a-zA-Z0-9_]+|Query:\s*[^\n]+|Language:\s*[^\n]+|Recency Days:\s*[^\n]+|Arguments:\s*\{[\s\S]*?\}|Result:\s*\{[\s\S]*?\})\s*(?=\n|$)/gi, "");
  clean = clean.replace(/search_web\s+query="[^"]*"[^\n]*/gi, "");

  // 清洗模型直接吐在正文里的 MCP 工具调用语法。
  // 实际观察到的是括号形式，例如：
  //   search_web(query="量子退火算法原理", language="zh", recencyDays=365)
  // 上面那条 search_web\\s+query= 只覆盖空格形式，管不到括号形式，
  // 于是机器调用痕迹会直接混在回答正文里。
  // 这里按注册表里的真实工具名做白名单式匹配，避免误伤正常英文文本。
  clean = clean.replace(
    /\b(?:search_web|search_images|verify_source|get_widget_catalog|prepare_widget|solve_layout|browser_read|inspect_repository|create_action)\s*\([^)]*\)/gi,
    ""
  );
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
 * 沉浸式展示基于全网多信源的 AI 深度综合回答。
 * 组件只呈现 AI 内容：不带头像、不渲染用户提问气泡、不提供任何追问入口，
 * 需要继续提问时统一走顶部搜索栏。
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
  openUrl,
  copyText,
  flipTile,
  agentSteps,
  language,
  askModeHint = true
}) => {
  const t = getUiStrings(language);
  const [copied, setCopied] = useState(false);
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
  const modelUsed = result?.modelUsed || (summary ? "AI 深度推理引擎" : "AI 权威信源综合");
  const executionTimeMs = result?.executionTimeMs || 0;

  // 会话轮次解析：只取 assistant 轮次。
  // user 轮次（用户提问）在组件内不再渲染，也不参与复制与滚动锚点。
  const assistantTurns: ChatTurn[] = useMemo(() => {
    if (result?.chatTurns && Array.isArray(result.chatTurns)) {
      return (result.chatTurns as ChatTurn[]).filter((turn) => turn?.role !== "user");
    }
    return [];
  }, [result?.chatTurns]);

  // 新增消息或流式片段到达时自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [assistantTurns, effectiveSummary, isStreaming]);

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
    // 只复制 AI 回答：用户提问已不在组件内呈现
    const answers = assistantTurns.map((t) => cleanAdFromSummary(t.content || "")).filter(Boolean);
    const textToCopy =
      answers.length > 0
        ? answers.join("\n\n")
        : `${effectiveQuery ? `### ${effectiveQuery}\n\n` : ""}${effectiveSummary}`;
    if (copyText) {
      copyText(textToCopy);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IOSWidget
      id="ai_answer"
      title={t.aiTitle}
      icon={<Sparkles className="size-4 text-primary" />}
      ratioMode={ratioMode}
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          {isStreaming ? (
            <Badge variant="secondary" className="text-xs h-6 gap-1.5 font-normal bg-primary/15 text-primary border-primary/30 animate-pulse">
              <span className="size-1.5 rounded-full bg-primary animate-ping" />
              <span>{t.aiThinking}</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs h-6 gap-1.5 font-normal bg-primary/10 text-primary border-primary/20">
              <Bot className="size-3" />
              <span className="truncate max-w-[120px]">{modelUsed}</span>
            </Badge>
          )}

          {executionTimeMs > 0 && !isStreaming && (
            <Badge variant="outline" className="text-xs h-6 gap-1.5 text-muted-foreground font-normal">
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
              className="h-8 px-2.5 text-sm gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              title={t.aiCopyAll}
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">{t.aiCopied}</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>{t.aiCopy}</span>
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
              title={t.aiFlip}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      }
      className={`w-full transition-all duration-300 ${
        isStreaming ? "border-primary/40 ring-1 ring-primary/15 shadow-sm" : "border-border/80"
      } bg-card`}
      // 高度由 WidgetContainer 的 flex-1 + 内联 maxHeight 决定，
      // 这里写 h-[…] / max-h-[…] 会被 flex-basis:0% 与内联样式盖掉，
      // 属于无效类名 —— 不再保留，只调真正生效的内边距与间距。
      contentClassName="p-4 sm:p-5 flex flex-col gap-3.5 overflow-hidden"
    >
      {/* 状态：Provider Error 局部克制提示 */}
      {isProviderError && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                {t.aiProviderError}
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
              <span>{t.aiRetry}</span>
            </Button>
          )}
        </div>
      )}

      {/* 消息滚动容器：只承载 AI 回答，不渲染用户提问气泡 */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-2 scrollbar-thin">
        {assistantTurns.length > 0 ? (
          // 多轮回答模式（仅 assistant 轮次）
          assistantTurns.map((turn, index) => {
            const isFirstAssistantTurn = index === 0;
            const turnText = cleanAdFromSummary(turn.content || (isFirstAssistantTurn ? effectiveSummary : ""));

            return (
              <div key={turn.id || index}>
                <div className="bg-background/50 rounded-xl border border-border/60 p-4 sm:p-5 text-foreground shadow-xs space-y-3">
                  {turnText ? (
                    <MarkdownContent
                      className="text-[15px] leading-7"
                      isStreaming={turn.isStreaming}
                      sources={citations}
                      onOpenUrl={openUrl}
                      language={language}
                    >
                      {turnText}
                    </MarkdownContent>
                  ) : turn.isStreaming ? (
                    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground animate-pulse">
                      <span className="size-1.5 rounded-full bg-primary animate-ping" />
                      <span>{t.aiComposing}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.aiTurnEmpty}</p>
                  )}
                </div>
              </div>
            );
          })
        ) : effectiveSummary ? (
          // 首轮单次研报渲染（向后兼容）
          <div className="bg-background/40 rounded-xl border border-border/60 p-4 sm:p-5">
            <MarkdownContent
              className="text-[15px] leading-7"
              isStreaming={isStreaming}
              sources={citations}
              onOpenUrl={openUrl}
              language={language}
            >
              {effectiveSummary}
            </MarkdownContent>
          </div>
        ) : isStreaming ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-primary/30 bg-primary/[0.02] rounded-xl animate-pulse">
            <Sparkles className="size-6 text-primary mb-2 animate-spin" />
            <p className="text-xs sm:text-sm font-medium text-foreground">
              {t.aiStreamingTitle}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.aiStreamingSub}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <p className="text-xs sm:text-sm font-medium">{t.aiEmptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.aiEmptyHint}
            </p>
          </div>
        )}

        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部：ReAct-Read 循环思维链 + ask 模式引导（提问统一走顶部搜索栏） */}
      <div className="pt-3.5 border-t border-border/50 shrink-0 space-y-2.5">
        <ReActLoopTimeline steps={agentSteps} isStreaming={isStreaming} language={language} />

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/70 px-1">
          {askModeHint ? (
            <span className="flex items-center gap-1 min-w-0">
              <CornerDownLeft className="size-2.5 text-primary/70 shrink-0" />
              <span className="truncate">{t.aiAskHint}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 min-w-0">
              <BookOpen className="size-2.5 text-primary/70 shrink-0" />
              <span className="truncate">{t.aiSourceBasis(sourcesCount)}</span>
            </span>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="italic truncate max-w-[120px]">{effectiveQuery}</span>
          </div>
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
  flipTile,
  language
}) => {
  const t = getUiStrings(language);
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
      title={t.aiBackTitle}
      icon={<Bot className="size-4 text-primary" />}
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={flipTile}
            className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
            title={t.aiBackToFront}
          >
            <RotateCcw className="size-3.5" />
            <span>{t.aiBackToFront}</span>
          </Button>
        </div>
      }
      className="w-full h-auto border-border/80 bg-card"
      contentClassName="p-4 sm:p-5 flex flex-col gap-4"
    >
      {/* 推理指标卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">{t.aiMetricModel}</span>
          <span className="text-xs font-semibold text-foreground truncate mt-0.5" title={modelUsed}>
            {modelUsed}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">{t.aiMetricDuration}</span>
          <span className="text-xs font-semibold text-foreground mt-0.5">
            {t.aiMetricSeconds(executionTimeMs / 1000)}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">{t.aiMetricChars}</span>
          <span className="text-xs font-semibold text-foreground mt-0.5">
            {t.aiMetricCharCount(summary.length)}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col">
          <span className="text-[11px] text-muted-foreground">{t.aiMetricSources}</span>
          <span className="text-xs font-semibold text-foreground mt-0.5">
            {t.aiMetricSourceCount(filteredResults.length)}
          </span>
        </div>
      </div>

      {/* 引用信源快速直达 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-primary" />
          {t.aiKeySources}
        </span>
        <div className="space-y-1.5">
          {filteredResults.slice(0, 6).map((source, idx) => (
            <SourceListItem
              key={idx}
              index={idx + 1}
              source={{ title: source.title, url: source.url, snippet: source.snippet }}
              onOpenUrl={openUrl}
              language={language}
            />
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
              <span>{t.aiCopiedMarkdown}</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>{t.aiCopyMarkdown}</span>
            </>
          )}
        </Button>
      </div>
    </IOSWidget>
  );
};
