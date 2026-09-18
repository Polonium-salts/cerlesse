import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExtensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { loadExtensions } from "../../../src/widgets/registry/extensionLoader.js";
import type { WidgetExtension } from "../../../src/widgets/sdk/extension.js";

describe("ExtensionLoader Fault Isolation & Idempotency", () => {
  const goodExtension1: WidgetExtension = {
    manifest: {
      id: "weather",
      name: "Weather Widget",
      version: "1.0.0",
      apiVersion: 1,
      description: "Weather forecast",
      category: "data",
      tags: ["weather"],
      capabilities: ["weather_current"],
      intents: ["weather"],
      keywords: ["weather"],
      examples: ["Tokyo weather"],
      layout: { defaultWidth: 50, minWidth: 25, maxWidth: 75 }
    },
    component: () => null
  };

  const brokenExtension: WidgetExtension = {
    manifest: {
      id: "broken",
      name: "Broken Widget",
      version: "1.0.0",
      apiVersion: 1,
      description: "Has invalid capability",
      category: "analysis",
      tags: ["broken"],
      capabilities: ["invalid_fake_capability"],
      intents: ["weather"],
      keywords: ["broken"],
      examples: ["broken"],
      layout: { defaultWidth: 50, minWidth: 25, maxWidth: 75 }
    },
    component: () => null
  };

  const goodExtension2: WidgetExtension = {
    manifest: {
      id: "translation",
      name: "Translation Widget",
      version: "1.0.0",
      apiVersion: 1,
      description: "Multi-language translation",
      category: "action",
      tags: ["translation"],
      capabilities: ["language_translation", "text_translation"],
      intents: ["translation"],
      keywords: ["translate"],
      examples: ["Translate hello to French"],
      layout: { defaultWidth: 50, minWidth: 25, maxWidth: 100 }
    },
    component: () => null
  };

  it("should isolate errors when one extension fails validation, allowing other extensions to load", () => {
    const registry = new ExtensionRegistry();
    const result = loadExtensions(
      [goodExtension1, brokenExtension, goodExtension2],
      registry,
      { replace: false }
    );

    // 验证结果统计
    assert.deepEqual(result.loaded, ["weather", "translation"]);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].id, "broken");

    // 验证 registry 状态
    assert.equal(registry.has("weather"), true);
    assert.equal(registry.has("translation"), true);
    assert.equal(registry.has("broken"), false);
  });

  it("should handle replace idempotency without throwing duplicate errors", () => {
    const registry = new ExtensionRegistry();
    // 第一次加载
    loadExtensions([goodExtension1], registry, { replace: true });
    assert.equal(registry.has("weather"), true);

    // 第二次加载（模拟 Vite HMR 重新加载）
    assert.doesNotThrow(() => {
      loadExtensions([goodExtension1], registry, { replace: true });
    });
    assert.equal(registry.has("weather"), true);
  });
});
