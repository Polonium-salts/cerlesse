import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SEARCH_POLICY } from "../../server/searchPolicy.js";
import { generateStableSourceId } from "../../server/searxng.js";
import { CodexSessionManager } from "../../server/codex/sessionManager.js";
import { searchWebTool } from "../../server/tools/searchTool.js";
import { buildSearchObservation, assessEvidence, planSearchQueries } from "../../server/codex/queryReasoner.js";
import { SearchResult } from "../../src/types.js";

describe("Search Policy & Contract Guarantees", () => {
  it("should have unified SEARCH_POLICY constants", () => {
    assert.equal(SEARCH_POLICY.minSources, 7, "minSources must be 7");
    assert.equal(SEARCH_POLICY.targetSources, 12, "targetSources must be 12");
    assert.equal(SEARCH_POLICY.hardCap, 16, "hardCap must be 16");
    assert.equal(SEARCH_POLICY.minEvidenceHits, 3, "minEvidenceHits must be 3");
    assert.equal(SEARCH_POLICY.maxSearchRounds, 4, "maxSearchRounds must be 4");
  });

  it("should generate deterministic stable IDs for normalized URLs", () => {
    const id1 = generateStableSourceId("https://example.com/path");
    const id2 = generateStableSourceId("https://example.com/path/");
    const id3 = generateStableSourceId("HTTPS://EXAMPLE.COM/path");
    assert.equal(id1, id2, "Trailing slashes should be normalized to the same stable ID");
    assert.equal(id1, id3, "Case differences in origin should be normalized to the same stable ID");
    assert.ok(id1.startsWith("src-"), "ID should start with src- prefix");
  });

  it("should deduplicate sources across search rounds and assign sequential ref indices", () => {
    const manager = new CodexSessionManager();
    const session = manager.createSession("test query", "test_thread_1");

    const round1Sources: SearchResult[] = [
      { id: "temp-1", title: "Doc 1", url: "https://example.com/doc1", snippet: "Doc 1 snippet" },
      { id: "temp-2", title: "Doc 2", url: "https://example.com/doc2", snippet: "Doc 2 snippet" }
    ];
    manager.recordSources("test_thread_1", round1Sources);

    assert.equal(session.collectedSources.length, 2);
    assert.equal(session.collectedSources[0].ref, 1);
    assert.equal(session.collectedSources[1].ref, 2);

    // Round 2 includes a duplicate URL and a new URL
    const round2Sources: SearchResult[] = [
      { id: "temp-3", title: "Doc 1 duplicate", url: "https://example.com/doc1/", snippet: "Doc 1 duplicate snippet" },
      { id: "temp-4", title: "Doc 3", url: "https://example.com/doc3", snippet: "Doc 3 snippet" }
    ];
    manager.recordSources("test_thread_1", round2Sources);

    assert.equal(session.collectedSources.length, 3, "Duplicate URL must not be added to session");
    assert.equal(session.collectedSources[2].ref, 3, "New URL must receive next sequential ref");
    assert.equal(session.collectedSources[0].url, "https://example.com/doc1");
    assert.equal(session.collectedSources[2].url, "https://example.com/doc3");
  });

  it("should output insufficient: true and accurate shortfall when results < minSources", async () => {
    // Empty query test
    const emptyResult = await searchWebTool({ query: "" });
    assert.equal(emptyResult.insufficient, true);
    assert.equal(emptyResult.shortfall, SEARCH_POLICY.minSources);
    assert.equal(emptyResult.total, 0);
  });

  it("should clamp requested limit to hardCap", async () => {
    // Calling with limit > hardCap (e.g. 50)
    // Even if SearXNG mock/fetch returns results, input limit must be capped at 16
    const output = await searchWebTool({ query: "vitest testing framework", limit: 50 });
    assert.ok(output.results.length <= SEARCH_POLICY.hardCap, `Results length ${output.results.length} must be <= hardCap ${SEARCH_POLICY.hardCap}`);
  });

  it("should include ref in ObservationResult and use advisory tone in notice", () => {
    const mockSources: SearchResult[] = [
      { id: "src-1", ref: 1, title: "Kubernetes Ingress Tutorial", url: "https://kubernetes.io/docs/ingress", snippet: "How to configure ingress on Kubernetes" },
      { id: "src-2", ref: 2, title: "Nginx Ingress Controller", url: "https://kubernetes.github.io/ingress-nginx", snippet: "Nginx ingress controller documentation" }
    ];

    const plan = planSearchQueries("Kubernetes Ingress 配置");
    const partialObservation = buildSearchObservation("Kubernetes Ingress 配置", mockSources, {
      plan,
      maxResults: 10,
      snippetChars: 240
    });

    assert.equal(partialObservation.results.length, 2);
    assert.equal(partialObservation.results[0].ref, 1);
    assert.equal(partialObservation.results[1].ref, 2);
    assert.ok(partialObservation.results[0].snippet.length <= 240);
    assert.ok(partialObservation.notice.includes("可参考以下补检方向"), "Advisory tone should suggest rather than command");

    // Full hit test with >= 3 hits
    const fullSources: SearchResult[] = [
      ...mockSources,
      { id: "src-3", ref: 3, title: "Kubernetes Ingress Guide", url: "https://kubernetes.io/docs/concepts/services-networking/ingress/", snippet: "An API object that manages external access to the services in a cluster" }
    ];
    const fullObservation = buildSearchObservation("Kubernetes Ingress 配置", fullSources, {
      plan,
      maxResults: 10,
      snippetChars: 240
    });
    assert.ok(fullObservation.notice.includes("[1], [2]"), "Hit notice should guide model to cite [1], [2]");
  });

  it("should assess evidence with intent sensitivity without false-positive partials on comparisons", () => {
    const compPlan = planSearchQueries("Vue3 和 React 对比选型");
    const compSources: SearchResult[] = [
      { id: "src-1", title: "Vue3 与 React 深度对比评测", url: "https://tech-blog.com/vue-vs-react", snippet: "Vue3 和 React 的响应式原理与生态对比" },
      { id: "src-2", title: "前端框架选型：Vue 还是 React？", url: "https://medium.com/frontend/vue-or-react", snippet: "架构演进、性能对比与选型指南" },
      { id: "src-3", title: "React vs Vue 2026 技术矩阵", url: "https://dev.to/react-vs-vue", snippet: "生态成熟度与开发体验比较" }
    ];

    const assessment = assessEvidence(compSources, compPlan);
    // Comparison intent does NOT force authoritativeCount === 0 as a hard barrier
    assert.equal(assessment.level, "hit", "3 relevant sources on comparison intent should register as hit");
  });
});
