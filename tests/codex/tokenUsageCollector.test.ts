/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TokenUsageCollector } from "../../server/codex/tokenUsageCollector.js";

describe("TokenUsageCollector Suite", () => {
  it("should record a single call with correct token sums", () => {
    const collector = new TokenUsageCollector();
    const call = collector.recordCall({
      id: "call_1",
      model: "deepseek/deepseek-v4-flash",
      promptTokens: 100,
      completionTokens: 50,
      costUsd: 0.00015,
      durationMs: 400
    });

    assert.equal(call.sequence, 1);
    assert.equal(call.promptTokens, 100);
    assert.equal(call.completionTokens, 50);
    assert.equal(call.totalTokens, 150);
    assert.equal(call.costUsd, 0.00015);
    assert.equal(call.durationMs, 400);

    const record = collector.buildRecord({
      searchId: "search_123",
      query: "Kubernetes"
    });

    assert.equal(record.searchId, "search_123");
    assert.equal(record.query, "Kubernetes");
    assert.equal(record.modelCalls, 1);
    assert.equal(record.promptTokens, 100);
    assert.equal(record.completionTokens, 50);
    assert.equal(record.totalTokens, 150);
    assert.equal(record.accuracy, "actual");
  });

  it("should accumulate multiple LLM calls without overwriting previous calls", () => {
    const collector = new TokenUsageCollector();

    // Call 1
    collector.recordCall({
      promptTokens: 100,
      completionTokens: 50,
      costUsd: 0.001,
      durationMs: 200
    });

    // Call 2
    collector.recordCall({
      promptTokens: 200,
      completionTokens: 100,
      costUsd: 0.002,
      durationMs: 300
    });

    const record = collector.buildRecord({
      searchId: "search_multi",
      query: "React 19 vs Vue 3"
    });

    assert.equal(record.modelCalls, 2);
    assert.equal(record.promptTokens, 300);
    assert.equal(record.completionTokens, 150);
    assert.equal(record.totalTokens, 450);
    assert.equal(record.costUsd, 0.003);
    assert.equal(record.calls?.length, 2);

    // Verify consistency formula: total == prompt + completion
    assert.equal(record.totalTokens, record.promptTokens + record.completionTokens);
  });

  it("should correctly record multi-model calls", () => {
    const collector = new TokenUsageCollector();

    collector.recordCall({ model: "gpt-4o-mini", promptTokens: 1000, completionTokens: 200 });
    collector.recordCall({ model: "gpt-4o-mini", promptTokens: 1500, completionTokens: 300 });
    collector.recordCall({ model: "deepseek-chat", promptTokens: 800, completionTokens: 400 });

    assert.equal(collector.getCallCount(), 3);
    const calls = collector.getCalls();
    assert.equal(calls[0].model, "gpt-4o-mini");
    assert.equal(calls[1].model, "gpt-4o-mini");
    assert.equal(calls[2].model, "deepseek-chat");

    const record = collector.buildRecord({
      searchId: "search_multi_model",
      query: "Deep Learning"
    });

    assert.equal(record.modelCalls, 3);
    assert.equal(record.promptTokens, 3300);
    assert.equal(record.completionTokens, 900);
    assert.equal(record.totalTokens, 4200);
  });

  it("should handle undefined, NaN, and zero tokens gracefully without crashing", () => {
    const collector = new TokenUsageCollector();

    collector.recordCall({
      promptTokens: undefined,
      completionTokens: NaN as any,
      costUsd: undefined
    });

    const record = collector.buildRecord({
      searchId: "search_empty",
      query: "Empty Test"
    });

    assert.equal(record.modelCalls, 1);
    assert.equal(record.promptTokens, 0);
    assert.equal(record.completionTokens, 0);
    assert.equal(record.totalTokens, 0);
    assert.equal(Number.isNaN(record.totalTokens), false);
  });

  it("should accurately calculate throughput (tokensPerSecond) from LLM durations", () => {
    const collector = new TokenUsageCollector();

    collector.recordCall({
      promptTokens: 1000,
      completionTokens: 500,
      durationMs: 1000 // 1 second
    });

    collector.recordCall({
      promptTokens: 1000,
      completionTokens: 500,
      durationMs: 1000 // 1 second
    });

    const record = collector.buildRecord({
      searchId: "search_throughput",
      query: "Throughput test",
      durationMs: 5000 // entire search took 5s, but LLM took 2s
    });

    // 1000 completion tokens in 2s LLM duration -> 500 tokens/sec
    assert.equal(record.tokensPerSecond, 500);
  });

  it("should convert to legacy TokenUsageStats format seamlessly", () => {
    const collector = new TokenUsageCollector();
    collector.recordCall({
      model: "gpt-4o",
      promptTokens: 2000,
      completionTokens: 800,
      costUsd: 0.015,
      durationMs: 1200
    });

    const record = collector.buildRecord({
      searchId: "search_legacy",
      query: "Legacy format check"
    });

    const legacy = TokenUsageCollector.toLegacyStats(record);
    assert.equal(legacy.promptTokens, 2000);
    assert.equal(legacy.completionTokens, 800);
    assert.equal(legacy.totalTokens, 2800);
    assert.equal(legacy.estimatedCostUsd, 0.015);
    assert.equal(legacy.accuracy, "actual");
  });
});
