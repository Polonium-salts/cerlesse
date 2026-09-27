import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SearchResult } from "../../src/types.js";
import {
  collectWebSearchResults,
  mergeWebSearchBatches,
  WEB_SEARCH_MAX_SEARXNG_INSTANCES,
  WEB_SEARCH_RESULT_TARGET
} from "../../server/webSearchCollection.js";
import { parseSearxngInstanceUrls } from "../../server/searxng.js";

function result(id: string): SearchResult {
  return {
    id,
    title: `Title ${id}`,
    url: `https://example.com/${id}`,
    snippet: `Snippet ${id}`
  };
}

function delayed<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe("Deterministic web search collection", () => {
  it("parses multiple configured SearXNG URLs and keeps legacy single-URL compatibility", () => {
    assert.deepEqual(parseSearxngInstanceUrls({
      SEARXNG_URLS: "https://one.example/, https://two.example;https://one.example/ https://invalid.example/path",
      SEARXNG_URL: "https://legacy.example"
    }), [
      "https://one.example",
      "https://two.example",
      "https://invalid.example/path"
    ]);
    assert.deepEqual(parseSearxngInstanceUrls({ SEARXNG_URL: "https://legacy.example/" }), [
      "https://legacy.example"
    ]);
    assert.equal(WEB_SEARCH_MAX_SEARXNG_INSTANCES, 5);
  });

  it("merges the same source responses identically regardless of completion order", async () => {
    const direct = [result("direct-1"), result("shared")];
    const searx = [result("shared"), result("searx-1")];
    const fastDirect = await collectWebSearchResults({
      query: "stable",
      direct: () => delayed(direct, 1),
      searxng: [{ source: "SearXNG one", search: () => delayed(searx, 20) }],
      fallback: async () => []
    });
    const fastSearx = await collectWebSearchResults({
      query: "stable",
      direct: () => delayed(direct, 20),
      searxng: [{ source: "SearXNG one", search: () => delayed(searx, 1) }],
      fallback: async () => []
    });

    assert.deepEqual(fastDirect.results.map((item) => item.url), fastSearx.results.map((item) => item.url));
    assert.deepEqual(fastDirect.diagnostics.sourcesUsed, ["Direct Web Engine", "SearXNG one"]);
    assert.equal(fastDirect.diagnostics.candidateCount, 4);
    assert.equal(fastDirect.diagnostics.uniqueCount, 3);
  });

  it("uses exactly one fallback to top up partial results below target", async () => {
    let fallbackCalls = 0;
    const response = await collectWebSearchResults({
      query: "partial",
      direct: async () => [result("one"), result("two")],
      searxng: [],
      target: 4,
      fallback: async () => {
        fallbackCalls++;
        return [result("three"), result("four")];
      }
    });

    assert.equal(fallbackCalls, 1);
    assert.equal(response.results.length, 4);
    assert.equal(response.diagnostics.fallbackUsed, true);
    assert.ok(response.diagnostics.sourcesUsed.includes("DuckDuckGo Web"));
  });

  it("does not run fallback when the target is met", async () => {
    let fallbackCalls = 0;
    const response = await collectWebSearchResults({
      query: "enough",
      direct: async () => Array.from({ length: WEB_SEARCH_RESULT_TARGET }, (_, i) => result(`r${i}`)),
      searxng: [],
      fallback: async () => {
        fallbackCalls++;
        return [result("extra")];
      }
    });
    assert.equal(fallbackCalls, 0);
    assert.equal(response.results.length, WEB_SEARCH_RESULT_TARGET);
    assert.equal(response.diagnostics.fallbackUsed, false);
  });

  it("returns a traceable empty result when every source is empty", async () => {
    let fallbackCalls = 0;
    const response = await collectWebSearchResults({
      query: "empty",
      direct: async () => [],
      searxng: [{ source: "SearXNG failed", search: async () => { throw new Error("offline"); } }],
      fallback: async () => {
        fallbackCalls++;
        return [];
      }
    });
    assert.equal(fallbackCalls, 1);
    assert.deepEqual(response.results, []);
    assert.equal(response.diagnostics.candidateCount, 0);
    assert.equal(response.diagnostics.uniqueCount, 0);
    assert.deepEqual(response.diagnostics.failures, ["SearXNG failed: offline"]);
    assert.deepEqual(response.diagnostics.sourcesAttempted, ["Direct Web Engine", "SearXNG failed", "DuckDuckGo Web"]);
    assert.equal(response.diagnostics.fallbackAttempted, true);
    assert.equal(response.diagnostics.fallbackUsed, false);
  });

  it("deduplicates equivalent URLs while preserving the original source IDs", () => {
    const merged = mergeWebSearchBatches([
      { source: "B", results: [{ ...result("source-b"), url: "https://www.example.com/shared/?utm_source=x" }] },
      { source: "A", results: [{ ...result("source-a"), url: "https://example.com/shared" }] }
    ]);
    assert.equal(merged.results.length, 1);
    assert.equal(merged.results[0].id, "source-a");
    assert.equal(merged.results[0].url, "https://example.com/shared");
    assert.equal(merged.diagnostics.candidateCount, 2);
    assert.equal(merged.diagnostics.uniqueCount, 1);
  });
});
