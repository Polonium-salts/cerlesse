/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LlmTokenCallRecord, SearchTokenUsageRecord, TokenUsageStats } from "../../src/types.js";

export interface BuildRecordOptions {
  searchId: string;
  query: string;
  model?: string;
  durationMs?: number;
  accuracy?: "actual" | "estimated";
}

/**
 * TokenUsageCollector:
 * 负责收集 Codex Agent 链路中每一次实际 LLM 请求产生的 Token 消耗，
 * 杜绝粗暴字符估算，严格遵循单次累加与数据一致性原则。
 */
export class TokenUsageCollector {
  private calls: LlmTokenCallRecord[] = [];
  private llmRequestStartTimes = new Map<string, number>();

  /**
   * 记录 LLM 请求开始时间戳（用于计算精确的 LLM 耗时与吞吐速率）
   */
  public markRequestStart(requestId: string, timestamp = Date.now()): void {
    this.llmRequestStartTimes.set(requestId, timestamp);
  }

  /**
   * 获取并消费 LLM 请求起始时间计算耗时
   */
  public computeRequestDuration(requestId: string, endTimestamp = Date.now()): number | undefined {
    const start = this.llmRequestStartTimes.get(requestId);
    if (typeof start === "number" && start > 0) {
      this.llmRequestStartTimes.delete(requestId);
      return Math.max(0, endTimestamp - start);
    }
    return undefined;
  }

  /**
   * 记录单次 LLM 调用的 Token 与成本数据
   */
  public recordCall(record: Partial<LlmTokenCallRecord> & { promptTokens?: number; completionTokens?: number }): LlmTokenCallRecord {
    const sequence = this.calls.length + 1;
    const promptTokens = Math.max(0, Number.isFinite(record.promptTokens) ? Number(record.promptTokens) : 0);
    const completionTokens = Math.max(0, Number.isFinite(record.completionTokens) ? Number(record.completionTokens) : 0);
    const totalTokens = Math.max(0, Number.isFinite(record.totalTokens) && (record.totalTokens ?? 0) > 0
      ? Number(record.totalTokens)
      : promptTokens + completionTokens
    );

    const costUsd = Number.isFinite(record.costUsd) && (record.costUsd ?? 0) > 0
      ? Number(record.costUsd)
      : undefined;

    const durationMs = Number.isFinite(record.durationMs) && (record.durationMs ?? 0) >= 0
      ? Number(record.durationMs)
      : undefined;

    const callRecord: LlmTokenCallRecord = {
      id: record.id || `llm_call_${sequence}_${Date.now()}`,
      sequence,
      model: record.model,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      durationMs,
      timestamp: record.timestamp || Date.now()
    };

    this.calls.push(callRecord);
    return callRecord;
  }

  /**
   * 获取当前收集的所有单次调用记录
   */
  public getCalls(): LlmTokenCallRecord[] {
    return [...this.calls];
  }

  /**
   * 获取当前已记录的调用次数
   */
  public getCallCount(): number {
    return this.calls.length;
  }

  /**
   * 汇总当前搜索的完整 Token 消耗记录
   */
  public buildRecord(options: BuildRecordOptions): SearchTokenUsageRecord {
    const calls = this.getCalls();
    
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalCost = 0;
    let totalLlmDurationMs = 0;
    let hasValidDuration = false;

    for (const call of calls) {
      totalPrompt += call.promptTokens;
      totalCompletion += call.completionTokens;
      if (typeof call.costUsd === "number" && call.costUsd > 0) {
        totalCost += call.costUsd;
      }
      if (typeof call.durationMs === "number" && call.durationMs > 0) {
        totalLlmDurationMs += call.durationMs;
        hasValidDuration = true;
      }
    }

    const totalTokens = totalPrompt + totalCompletion;
    const modelCalls = calls.length;

    // 计算吞吐速度 (tokens/second)
    // 优先使用 LLM 实际生成耗时；若未测得则不随意伪造
    let tokensPerSecond: number | undefined;
    if (totalCompletion > 0 && hasValidDuration && totalLlmDurationMs > 50) {
      tokensPerSecond = Math.round((totalCompletion / (totalLlmDurationMs / 1000)));
    } else if (totalCompletion > 0 && typeof options.durationMs === "number" && options.durationMs > 100) {
      // 降级使用整个搜索耗时作为保守估计
      tokensPerSecond = Math.round((totalCompletion / (options.durationMs / 1000)));
    }

    const accuracy: "actual" | "estimated" = options.accuracy
      ? options.accuracy
      : (modelCalls > 0 && totalTokens > 0 ? "actual" : "estimated");

    const effectiveModel = options.model || (calls.length > 0 ? calls[calls.length - 1].model : undefined);

    return {
      searchId: options.searchId,
      query: options.query,
      timestamp: Date.now(),
      model: effectiveModel,
      modelCalls,
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
      totalTokens,
      costUsd: totalCost > 0 ? Number(totalCost.toFixed(6)) : undefined,
      tokensPerSecond,
      durationMs: Math.max(0, options.durationMs || totalLlmDurationMs || 0),
      calls: calls.length > 0 ? calls : undefined,
      accuracy
    };
  }

  /**
   * 将 SearchTokenUsageRecord 转为旧版 TokenUsageStats 结构以保持向后兼容
   */
  public static toLegacyStats(record: SearchTokenUsageRecord): TokenUsageStats {
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
}
