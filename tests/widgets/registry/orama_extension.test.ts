import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initExtensionSearchIndex, searchExtensions, resetExtensionSearchIndex } from "../../../src/widgets/registry/extensionSearchIndex.js";
import { retrieveWidgets, resetOramaWidgetDb } from "../../../src/widgets/widgetRetriever.js";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import type { WidgetExtension } from "../../../src/widgets/sdk/extension.js";

describe("Extension Search Index & Orama Integration", () => {
  const weatherExtension: WidgetExtension = {
    manifest: {
      id: "weather",
      name: "天气预报",
      version: "1.0.0",
      apiVersion: 1,
      description: "展示实时气温与未来趋势",
      category: "data",
      tags: ["天气", "气温", "预报"],
      capabilities: ["weather_current", "weather_forecast"],
      intents: ["weather"],
      keywords: ["天气", "气温", "下雨", "降水", "穿衣指南"],
      examples: ["今天北京天气怎么样", "东京明天会下雨吗"],
      layout: { defaultWidth: 50, minWidth: 25, maxWidth: 75 }
    },
    component: () => null
  };

  beforeEach(() => {
    resetExtensionSearchIndex();
    resetOramaWidgetDb();
    if (!extensionRegistry.has("weather")) {
      extensionRegistry.register(weatherExtension);
    }
  });

  it("should index catalog entries and search by term", async () => {
    await initExtensionSearchIndex();

    const hits = await searchExtensions("北京天气");
    assert.ok(hits.length > 0, "should return at least one search hit");
    assert.equal(hits[0].id, "weather");
    assert.equal(hits[0].entry.name, "天气预报");
  });

  it("should allow retrieveWidgets to retrieve dynamically registered extensions", async () => {
    const candidates = await retrieveWidgets("明天东京天气如何", {
      intent: "weather",
      capabilities: ["weather_current"]
    });

    const weatherCandidate = candidates.find(c => c.key === "weather");
    assert.ok(weatherCandidate, "weather extension should be retrieved as candidate");
    assert.equal(weatherCandidate?.name, "天气预报");
    assert.ok((weatherCandidate?.finalScore ?? 0) > 0.4);
  });
});
