/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resolveTokenRecord, formatTokenCount } from "../../src/widgets/components/TokenUsageWidget.js";
import { tokenUsageStore } from "../../src/state/tokenUsageStore.js";
import type { SearchSynthesisResult, SearchTokenUsageRecord } from "../../src/types.js";

describe("TokenUsageWidget & Store Tests", () => {
  beforeEach(() => {
    tokenUsageStore.clear();
  });

  it("should prioritize actual tokenUsageRecord over estimation", () => {
    const mockResult: Partial<SearchSynthesisResult> = {
      query: "Kubernetes Pod CrashLoopBackOff",
      summary: "This is a detailed answer...",
      tokenUsageRecord: {
        searchId: "search_101",
        query: "Kubernetes Pod CrashLoopBackOff",
        timestamp: Date.now(),
        model: "DeepSeek V4 Flash",
        modelCalls: 4,
        promptTokens: 9210,
        completionTokens: 3632,
        totalTokens: 12842,
        costUsd: 0.0041,
        tokensPerSecond: 431,
        durationMs: 8420,
        accuracy: "actual"
      }
    };

    const record = resolveTokenRecord(mockResult as SearchSynthesisResult);
    assert.equal(record.accuracy, "actual");
    assert.equal(record.totalTokens, 12842);
    assert.equal(record.promptTokens, 9210);
    assert.equal(record.completionTokens, 3632);
    assert.equal(record.modelCalls, 4);
    assert.equal(record.costUsd, 0.0041);
  });

  it("should fallback to estimated accuracy when no server token metrics exist", () => {
    const mockResult: Partial<SearchSynthesisResult> = {
      query: "Simple question",
      summary: "Short answer",
      executionTimeMs: 1500,
      filteredResults: []
    };

    const record = resolveTokenRecord(mockResult as SearchSynthesisResult);
    assert.equal(record.accuracy, "estimated");
    assert.ok(record.totalTokens > 0);
    assert.equal(record.modelCalls, 1);
  });

  it("should correctly record and aggregate search history in tokenUsageStore", () => {
    const record1: SearchTokenUsageRecord = {
      searchId: "search_1",
      query: "Kubernetes",
      timestamp: Date.now() - 1000,
      model: "gpt-4o",
      modelCalls: 2,
      promptTokens: 5000,
      completionTokens: 2000,
      totalTokens: 7000,
      costUsd: 0.02,
      durationMs: 2500,
      accuracy: "actual"
    };

    const record2: SearchTokenUsageRecord = {
      searchId: "search_2",
      query: "React 19",
      timestamp: Date.now(),
      model: "gpt-4o",
      modelCalls: 3,
      promptTokens: 3000,
      completionTokens: 1500,
      totalTokens: 4500,
      costUsd: 0.015,
      durationMs: 1800,
      accuracy: "actual"
    };

    tokenUsageStore.add(record1);
    tokenUsageStore.add(record2);

    const history = tokenUsageStore.getHistory();
    assert.equal(history.length, 2);
    // Latest search should be first
    assert.equal(history[0].searchId, "search_2");
    assert.equal(history[1].searchId, "search_1");

    const agg = tokenUsageStore.getAggregate();
    assert.equal(agg.searchCount, 2);
    assert.equal(agg.totalPromptTokens, 8000);
    assert.equal(agg.totalCompletionTokens, 3500);
    assert.equal(agg.totalTokens, 11500);
    assert.equal(agg.averageTokensPerSearch, 5750);
    assert.equal(agg.totalCostUsd, 0.035);
  });

  it("should enforce a maximum of 100 history items", () => {
    for (let i = 0; i < 110; i++) {
      tokenUsageStore.add({
        searchId: `search_${i}`,
        query: `Query ${i}`,
        timestamp: Date.now() + i,
        model: "gpt-4o-mini",
        modelCalls: 1,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        durationMs: 500,
        accuracy: "actual"
      });
    }

    const history = tokenUsageStore.getHistory();
    assert.equal(history.length, 100);
    // Latest added (search_109) should be first
    assert.equal(history[0].searchId, "search_109");
  });

  it("should format token counts appropriately", () => {
    assert.equal(formatTokenCount(500), "500");
    assert.equal(formatTokenCount(9210), "9,210");
    assert.equal(formatTokenCount(12842), "12.8k");
    assert.equal(formatTokenCount(184230), "184.2k");
    assert.equal(formatTokenCount(1500000), "1.5M");
  });
});
