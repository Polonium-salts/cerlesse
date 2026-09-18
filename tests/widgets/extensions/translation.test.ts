import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { translationAdapter, parseTranslationQuery } from "../../../src/widgets/extensions/translation/adapter.js";
import { manifest } from "../../../src/widgets/extensions/translation/manifest.js";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";
import translationExtension from "../../../src/widgets/extensions/translation/index.js";

describe("Translation Extension Integration", () => {
  it("should have correct manifest configuration", () => {
    assert.equal(manifest.id, "translation");
    assert.equal(manifest.name, "多语言翻译");
    assert.ok(manifest.capabilities.includes("language_translation"));
    assert.ok(manifest.intents.includes("translation"));
  });

  it("should parse translation queries and adapt data correctly", () => {
    assert.equal(translationAdapter.canHandle?.("苹果英语怎么说"), true);
    assert.equal(translationAdapter.canHandle?.("hello 是什么意思"), true);
    assert.equal(translationAdapter.canHandle?.("今日天气趋势"), false);

    const parsed = parseTranslationQuery("苹果英语怎么说");
    assert.equal(parsed.extractedText, "苹果");
    assert.equal(parsed.targetLang, "en");

    const data = translationAdapter.transform("苹果英语怎么说");
    assert.equal(data.sourceText, "苹果");
    assert.equal(data.translation, "Apple");
    assert.ok(data.examples && data.examples.length > 0);
    assert.equal(translationAdapter.validate?.(data), true);
  });

  it("should be registered and resolved by WidgetRegistry with extension priority", () => {
    if (!extensionRegistry.has("translation")) {
      extensionRegistry.register(translationExtension);
    }
    assert.ok(extensionRegistry.has("translation"));

    const mod = WidgetRegistry.get("translation");
    assert.ok(mod, "WidgetRegistry should resolve translation module");
    assert.equal(mod.id, "translation");
    assert.equal(mod.name, "多语言翻译");
  });
});
