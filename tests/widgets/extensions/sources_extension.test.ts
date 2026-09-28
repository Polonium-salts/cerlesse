import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";
import { initializeWidgetExtensions } from "../../../src/widgets/registry/index.js";
import type { SearchSynthesisResult } from "../../../src/types.js";

initializeWidgetExtensions();

describe("Sources Widget & Extension Verification", () => {
  it("should be registered in extensionRegistry with resident presence and valid metadata", () => {
    const ext = extensionRegistry.get("sources");
    assert.ok(ext, "sources extension should be found");
    assert.equal(ext.manifest.id, "sources");
    assert.equal(ext.manifest.presence, "resident");
    assert.ok(ext.manifest.capabilities.includes("evidence_chain"));
    assert.ok(ext.manifest.capabilities.includes("citation_retrieval"));
  });

  it("should be resolvable via WidgetRegistry.get('sources')", () => {
    const mod = WidgetRegistry.get("sources");
    assert.ok(mod, "sources module should be found in WidgetRegistry");
    assert.equal(mod.id, "sources");
    assert.equal(mod.name, "信源溯源存证");
  });

  it("sources adapter transforms and validates search synthesis sources", () => {
    const ext = extensionRegistry.get("sources")!;
    const mockResult: SearchSynthesisResult = {
      query: "深度核验测试",
      timestamp: Date.now(),
      plan: { originalQuery: "test", intent: "general_knowledge", subQueries: [], comparisonDimensions: [] },
      steps: [],
      filteredResults: [
        { id: "1", title: "权威报告", url: "https://authority.org/paper", snippet: "经核验的结论。", isOfficial: true }
      ],
      rawResultCount: 1,
      summary: "测试总结",
      keyTakeaways: [],
      comparisonTable: [],
      mindMap: { id: "root", label: "test" },
      followUpQuestions: [],
      modelUsed: "deepseek-chat",
      executionTimeMs: 10
    };

    assert.equal(ext.adapter.canHandle("深度核验测试", mockResult), true);
    const data = ext.adapter.transform("深度核验测试", mockResult) as any;
    assert.equal(data.count, 1);
    assert.equal(data.sources[0].url, "https://authority.org/paper");
    assert.equal(ext.adapter.validate(data), true);
  });
});
