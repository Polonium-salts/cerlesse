/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import type { SearchTokenUsageRecord, TokenUsageAggregate } from "../types.js";

const STORAGE_KEY = "cerlesse_token_usage_history_v1";
const MAX_HISTORY_ITEMS = 100;

type StoreListener = () => void;

class TokenUsageStoreImpl {
  private history: SearchTokenUsageRecord[] = [];
  private listeners: Set<StoreListener> = new Set();
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined" || this.isLoaded) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.history = parsed.filter(item => item && typeof item.searchId === "string");
        }
      }
    } catch (err) {
      console.warn("[TokenUsageStore] Failed to load history from localStorage:", err);
    } finally {
      this.isLoaded = true;
    }
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (err) {
      console.warn("[TokenUsageStore] Failed to persist history to localStorage:", err);
    }
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("[TokenUsageStore] Listener error:", err);
      }
    }
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 记录一次新的搜索 Token 消耗
   */
  public add(record: SearchTokenUsageRecord): void {
    this.loadFromStorage();
    if (!record || !record.searchId) return;

    // 若已存在相同 searchId，则更新已有记录
    const existingIndex = this.history.findIndex(h => h.searchId === record.searchId);
    if (existingIndex !== -1) {
      this.history[existingIndex] = { ...this.history[existingIndex], ...record };
    } else {
      // 头部插入最新的搜索记录，上限 100 条
      this.history = [record, ...this.history].slice(0, MAX_HISTORY_ITEMS);
    }

    this.persist();
  }

  /**
   * 获取最近搜索 Token 记录列表
   */
  public getHistory(): SearchTokenUsageRecord[] {
    this.loadFromStorage();
    return [...this.history];
  }

  /**
   * 计算全局累计监控统计
   */
  public getAggregate(): TokenUsageAggregate {
    this.loadFromStorage();
    const history = this.getHistory();
    const searchCount = history.length;

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalCost = 0;

    for (const item of history) {
      totalPrompt += item.promptTokens || 0;
      totalCompletion += item.completionTokens || 0;
      if (typeof item.costUsd === "number" && item.costUsd > 0) {
        totalCost += item.costUsd;
      }
    }

    const totalTokens = totalPrompt + totalCompletion;
    const averageTokensPerSearch = searchCount > 0 ? Math.round(totalTokens / searchCount) : 0;
    const averageCostPerSearch = searchCount > 0 ? Number((totalCost / searchCount).toFixed(6)) : 0;

    return {
      searchCount,
      totalPromptTokens: totalPrompt,
      totalCompletionTokens: totalCompletion,
      totalTokens,
      totalCostUsd: Number(totalCost.toFixed(6)),
      averageTokensPerSearch,
      averageCostPerSearch,
      latestSearch: history[0],
      history
    };
  }

  /**
   * 清空历史记录
   */
  public clear(): void {
    this.history = [];
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.notify();
  }
}

export const tokenUsageStore = new TokenUsageStoreImpl();

/**
 * React Hook: 订阅 Token 历史与聚合统计
 */
export function useTokenUsageStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return tokenUsageStore.subscribe(() => {
      setTick(t => t + 1);
    });
  }, []);

  return {
    history: tokenUsageStore.getHistory(),
    aggregate: tokenUsageStore.getAggregate(),
    add: (record: SearchTokenUsageRecord) => tokenUsageStore.add(record),
    clear: () => tokenUsageStore.clear()
  };
}
