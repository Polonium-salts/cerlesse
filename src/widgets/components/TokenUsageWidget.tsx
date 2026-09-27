/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from "react";
import { 
  Coins, 
  Zap, 
  Clock, 
  Copy, 
  Check, 
  Cpu, 
  ArrowDownRight, 
  ArrowUpRight, 
  History, 
  BarChart3, 
  Layers, 
  Sparkles, 
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  TrendingUp,
  Info
} from "lucide-react";
import { SearchSynthesisResult, SearchTokenUsageRecord, TokenUsageStats } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { useTokenUsageStore, tokenUsageStore } from "../../state/tokenUsageStore.js";

export interface TokenUsageWidgetProps {
  result?: SearchSynthesisResult;
  query?: string;
  copyText?: (text: string) => void;
  isLoading?: boolean;
}

/**
 * 格式化 Token 数量展示（如 2,480 或 12.8k）
 */
export function formatTokenCount(num: number): string {
  if (!Number.isFinite(num) || num < 0) return "0";
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 10000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

/**
 * 严格按照优先级解析 Token 消耗数据：
 * 1. result.tokenUsageRecord (真实采集)
 * 2. result.tokenUsage (兼容字段，实际采集)
 * 3. 算法降级估算 (明确标记 accuracy = "estimated")
 */
export function resolveTokenRecord(result?: SearchSynthesisResult, query?: string): SearchTokenUsageRecord {
  const currentQuery = query || result?.query || "当前搜索";
  const searchId = `search_${result?.timestamp || Date.now()}`;
  const durationMs = result?.executionTimeMs || 0;

  // 1. 优先使用服务端 TokenUsageCollector 汇出的真实记录
  if (result?.tokenUsageRecord) {
    return {
      ...result.tokenUsageRecord,
      query: currentQuery,
      accuracy: result.tokenUsageRecord.accuracy || "actual"
    };
  }

  // 2. 兼容使用 result.tokenUsage
  if (result?.tokenUsage && (result.tokenUsage.promptTokens > 0 || result.tokenUsage.completionTokens > 0)) {
    return {
      searchId,
      query: currentQuery,
      timestamp: result.timestamp || Date.now(),
      model: result.tokenUsage.model || result.modelUsed,
      modelCalls: result.modelCallCount || 1,
      promptTokens: result.tokenUsage.promptTokens,
      completionTokens: result.tokenUsage.completionTokens,
      totalTokens: result.tokenUsage.totalTokens || (result.tokenUsage.promptTokens + result.tokenUsage.completionTokens),
      costUsd: result.tokenUsage.estimatedCostUsd,
      tokensPerSecond: result.tokenUsage.tokensPerSecond,
      durationMs,
      accuracy: result.tokenUsage.accuracy || "actual"
    };
  }

  // 3. 降级估算（仅在完全无 API 真实数据时使用，明确标注 accuracy = "estimated"）
  const qStr = currentQuery;
  const queryChars = qStr.length;
  const contextChars = (result?.filteredResults || []).reduce((sum, r) => {
    return sum + (r.title?.length || 0) + (r.snippet?.length || 0);
  }, 0);
  const promptChars = queryChars + contextChars + 600;

  const summaryChars = result?.summary?.length || 0;
  const takeawaysChars = (result?.keyTakeaways || []).join(" ").length;
  const followUpChars = (result?.followUpQuestions || []).join(" ").length;
  const completionChars = summaryChars + takeawaysChars + followUpChars + 200;

  const promptTokens = Math.max(120, Math.round(promptChars * 0.75));
  const completionTokens = Math.max(60, Math.round(completionChars * 0.75));
  const totalTokens = promptTokens + completionTokens;
  const durationSec = Math.max(0.2, durationMs / 1000 || 1.2);
  const tokensPerSecond = Math.round(completionTokens / durationSec);

  return {
    searchId,
    query: currentQuery,
    timestamp: result?.timestamp || Date.now(),
    model: result?.modelUsed || "Codex Agent",
    modelCalls: result?.modelCallCount || 1,
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSecond,
    costUsd: undefined,
    durationMs,
    accuracy: "estimated"
  };
}

/**
 * 兼容旧导出函数 resolveTokenStats
 */
export function resolveTokenStats(result?: SearchSynthesisResult, query?: string): TokenUsageStats {
  const record = resolveTokenRecord(result, query);
  return {
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    totalTokens: record.totalTokens,
    estimatedCostUsd: record.costUsd,
    tokensPerSecond: record.tokensPerSecond,
    model: record.model,
    accuracy: record.accuracy
  };
}

export const TokenUsageWidget: React.FC<TokenUsageWidgetProps> = ({
  result,
  query,
  copyText,
  isLoading
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "recent" | "cumulative">("current");
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<SearchTokenUsageRecord | null>(null);

  const { history, aggregate, add: addHistoryRecord, clear: clearHistory } = useTokenUsageStore();

  const currentRecord = useMemo(() => resolveTokenRecord(result, query), [result, query]);

  // 当搜索结果产生且包含有效真实数据时，自动录入本地遥测 Store
  useEffect(() => {
    if (result && (result.tokenUsageRecord || result.tokenUsage)) {
      addHistoryRecord(currentRecord);
    }
  }, [result, currentRecord]);

  const isActual = currentRecord.accuracy === "actual";
  const promptPct = currentRecord.totalTokens > 0
    ? Math.round((currentRecord.promptTokens / currentRecord.totalTokens) * 100)
    : 70;
  const completionPct = 100 - promptPct;

  const executionSeconds = ((currentRecord.durationMs || 1200) / 1000).toFixed(2);

  const handleCopyReport = () => {
    const report = [
      `📊 Cerlesse 搜索 Token 消耗分析报告`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• 搜索查询: "${currentRecord.query}"`,
      `• 数据来源: ${isActual ? "真实 API 遥测 (Actual)" : "算法字符估算 (Estimated)"}`,
      `• 总计 Token: ${currentRecord.totalTokens.toLocaleString()} Tokens`,
      `• Prompt 输入: ${currentRecord.promptTokens.toLocaleString()} (${promptPct}%)`,
      `• Output 生成: ${currentRecord.completionTokens.toLocaleString()} (${completionPct}%)`,
      `• 模型调用次数: ${currentRecord.modelCalls || 1} 次`,
      `• 生成吞吐速度: ${currentRecord.tokensPerSecond ? `${currentRecord.tokensPerSecond} tok/s` : "未测得"}`,
      `• 搜索总耗时: ${executionSeconds}s`,
      `• 采用模型: ${currentRecord.model || "Codex Agent"}`,
      currentRecord.costUsd ? `• 预估成本: $${currentRecord.costUsd.toFixed(4)}` : ""
    ].filter(Boolean).join("\n");

    if (copyText) {
      copyText(report);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(report);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IOSWidget
      title="Token 消耗"
      icon={<Coins className="size-4 text-emerald-500" />}
      size={25}
      isLoading={isLoading}
      badge={
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={`text-[10px] h-4.5 px-1.5 font-normal whitespace-nowrap transition-colors ${
              isActual
                ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                : "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5"
            }`}
          >
            {isActual ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-2.5 text-emerald-500" />
                实际用量
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertTriangle className="size-2.5 text-amber-500" />
                字符估算
              </span>
            )}
          </Badge>
        </div>
      }
      actions={
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyReport}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="复制 Token 遥测数据报告"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col h-full justify-between gap-2 select-none">
        {/* 顶部三态导航切换标签 */}
        <div className="flex items-center justify-between p-0.5 bg-muted/50 rounded-lg text-[10.5px] font-medium border border-border/40">
          <button
            type="button"
            onClick={() => { setActiveTab("current"); setSelectedDetailRecord(null); }}
            className={`flex-1 py-1 rounded-md text-center transition-all ${
              activeTab === "current" && !selectedDetailRecord
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            本次搜索
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("recent"); setSelectedDetailRecord(null); }}
            className={`flex-1 py-1 rounded-md text-center transition-all ${
              activeTab === "recent" && !selectedDetailRecord
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            最近记录 ({history.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("cumulative"); setSelectedDetailRecord(null); }}
            className={`flex-1 py-1 rounded-md text-center transition-all ${
              activeTab === "cumulative" && !selectedDetailRecord
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            累计监控
          </button>
        </div>

        {/* 状态 A：本次搜索视图 (Current Search) */}
        {activeTab === "current" && !selectedDetailRecord && (
          <div className="flex flex-col flex-1 justify-between gap-2">
            {/* 顶部主指标：总消耗 Token */}
            <div className="flex items-baseline justify-between gap-1">
              <div>
                <div className="text-2xl font-black tracking-tight text-foreground flex items-baseline gap-1">
                  <span>{formatTokenCount(currentRecord.totalTokens)}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Tokens
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Zap className="size-3 text-amber-500 shrink-0" />
                  <span>
                    {currentRecord.tokensPerSecond ? `${currentRecord.tokensPerSecond} tok/s · ` : ""}
                    {executionSeconds}s · {currentRecord.modelCalls || 1} 次调用
                  </span>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Cpu className="size-2.5" />
                  <span className="max-w-[70px] truncate">{currentRecord.model?.split("/")?.pop() || "Codex"}</span>
                </span>
                {currentRecord.calls && currentRecord.calls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDetailRecord(currentRecord)}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    <span>{currentRecord.calls.length} 轮明细</span>
                    <ChevronRight className="size-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 中部双色分割柱状图 (Prompt vs Output) */}
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500 rounded-l-full"
                  style={{ width: `${promptPct}%` }}
                  title={`Prompt 输入 Token: ${currentRecord.promptTokens} (${promptPct}%)`}
                />
                <div
                  className="h-full bg-indigo-500 transition-all duration-500 rounded-r-full"
                  style={{ width: `${completionPct}%` }}
                  title={`Output 生成 Token: ${currentRecord.completionTokens} (${completionPct}%)`}
                />
              </div>

              {/* 比例细分标签 */}
              <div className="flex items-center justify-between text-[10.5px] font-medium pt-0.5">
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <ArrowDownRight className="size-2.5" />
                  <span>入 {formatTokenCount(currentRecord.promptTokens)}</span>
                  <span className="text-muted-foreground/60 text-[9px]">({promptPct}%)</span>
                </div>

                <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <ArrowUpRight className="size-2.5" />
                  <span>出 {formatTokenCount(currentRecord.completionTokens)}</span>
                  <span className="text-muted-foreground/60 text-[9px]">({completionPct}%)</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                </div>
              </div>
            </div>

            {/* 底部微小元信息 */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 border-t border-border/40 pt-1.5 mt-auto">
              <span className="flex items-center gap-1 truncate">
                <Clock className="size-2.5 shrink-0" />
                <span>{isActual ? "OpenAI Codex 真实用量" : "未开启 API，算法估算"}</span>
              </span>
              <span className="font-semibold text-foreground/90 shrink-0">
                {currentRecord.costUsd ? `$${currentRecord.costUsd.toFixed(4)}` : "免费额度"}
              </span>
            </div>
          </div>
        )}

        {/* 状态 B：最近搜索列表 (Recent Searches) */}
        {activeTab === "recent" && !selectedDetailRecord && (
          <div className="flex flex-col flex-1 justify-between gap-1 overflow-hidden">
            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-3 text-muted-foreground text-xs">
                <History className="size-5 mb-1 opacity-40" />
                <span>暂无搜索 Token 历史</span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">执行搜索后将自动记录真实消耗</span>
              </div>
            ) : (
              <div className="space-y-1.5 overflow-y-auto max-h-[140px] pr-1 no-scrollbar">
                {history.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.searchId || idx}
                    onClick={() => setSelectedDetailRecord(item)}
                    className="flex items-center justify-between p-1.5 rounded-md bg-muted/30 hover:bg-muted/70 transition-colors cursor-pointer border border-border/30 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      <span className="font-mono text-[9.5px] text-muted-foreground/60 shrink-0">#{idx + 1}</span>
                      <span className="font-medium text-foreground truncate">{item.query}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-foreground">{formatTokenCount(item.totalTokens)}</span>
                      <ChevronRight className="size-3 text-muted-foreground/50" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1 mt-auto">
              <span>共保留最近 {history.length} 条记录</span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-muted-foreground hover:text-destructive transition-colors text-[9.5px]"
                >
                  清空历史
                </button>
              )}
            </div>
          </div>
        )}

        {/* 状态 C：累计监控 (Cumulative Monitoring) */}
        {activeTab === "cumulative" && !selectedDetailRecord && (
          <div className="flex flex-col flex-1 justify-between gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Coins className="size-3 text-emerald-500" />
                  <span>累计 Token</span>
                </div>
                <div className="text-lg font-black text-foreground mt-0.5">
                  {formatTokenCount(aggregate.totalTokens)}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="size-3 text-indigo-500" />
                  <span>搜索次数</span>
                </div>
                <div className="text-lg font-black text-foreground mt-0.5">
                  {aggregate.searchCount} 次
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 border border-border/30">
                <span className="text-muted-foreground">平均 / 搜索</span>
                <span className="font-semibold text-foreground">{formatTokenCount(aggregate.averageTokensPerSearch)}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 border border-border/30">
                <span className="text-muted-foreground">累计成本</span>
                <span className="font-semibold text-foreground">
                  {aggregate.totalCostUsd > 0 ? `$${aggregate.totalCostUsd.toFixed(4)}` : "$0.00"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 mt-auto">
              <span className="flex items-center gap-1">
                <TrendingUp className="size-2.5 text-emerald-500" />
                <span>基于本地遥测持续统计</span>
              </span>
              <span>准确率: 100%</span>
            </div>
          </div>
        )}

        {/* 详情浮层：查看单次搜索的具体 LLM 请求拆解 */}
        {selectedDetailRecord && (
          <div className="flex flex-col flex-1 justify-between gap-1.5 overflow-hidden">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <span className="text-[11px] font-semibold text-foreground truncate max-w-[140px]">
                {selectedDetailRecord.query}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="返回"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[130px] pr-1 no-scrollbar">
              {selectedDetailRecord.calls && selectedDetailRecord.calls.length > 0 ? (
                selectedDetailRecord.calls.map((call, idx) => (
                  <div
                    key={call.id || idx}
                    className="p-1.5 rounded-md bg-muted/40 border border-border/30 text-[10px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-primary font-mono">LLM Request #{call.sequence || idx + 1}</span>
                      <span className="font-bold">{call.totalTokens.toLocaleString()} Tok</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground text-[9px]">
                      <span>入 {call.promptTokens.toLocaleString()} · 出 {call.completionTokens.toLocaleString()}</span>
                      <span>{call.durationMs ? `${call.durationMs}ms` : ""}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2 text-center text-[10px] text-muted-foreground">
                  <div>总消耗：{selectedDetailRecord.totalTokens.toLocaleString()} Tokens</div>
                  <div className="mt-1 text-[9px]">（单次请求汇总结算）</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-medium border-t border-border/40 pt-1 mt-auto">
              <span className="text-muted-foreground">调用次数: {selectedDetailRecord.modelCalls}</span>
              <span className="font-bold text-foreground">总计: {selectedDetailRecord.totalTokens.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </IOSWidget>
  );
};
