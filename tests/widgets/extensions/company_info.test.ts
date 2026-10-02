import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { companyInfoAdapter } from "../../../src/widgets/extensions/company_info/adapter.js";
import { manifest } from "../../../src/widgets/extensions/company_info/manifest.js";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";
import companyInfoExtension from "../../../src/widgets/extensions/company_info/index.js";
import { selectWidgetsByEvidence } from "../../../server/codex/widgetSelectionSkill.js";

describe("Company Info Extension & AI Automatic Selection", () => {
  it("should have correct manifest configuration", () => {
    assert.equal(manifest.id, "company_info");
    assert.equal(manifest.name, "公司信息");
    assert.equal(manifest.layout.defaultWidth, 25);
    assert.equal(manifest.layout.minWidth, 25);
    assert.ok(manifest.capabilities.includes("company_info"));
    assert.ok(manifest.intents.includes("company_info"));
  });

  it("should adapt company query and transform structured data", () => {
    assert.equal(companyInfoAdapter.canHandle?.("谷歌"), true);
    assert.equal(companyInfoAdapter.canHandle?.("微软公司"), true);
    assert.equal(companyInfoAdapter.canHandle?.("今天北京天气"), false);

    const googleData = companyInfoAdapter.transform("谷歌", { query: "谷歌" });
    assert.equal(googleData.name, "谷歌");
    assert.equal(googleData.englishName, "Google LLC");
    assert.ok(googleData.heroImage);
    assert.ok(googleData.description.length > 20);
    assert.equal(googleData.sourceName, "维基百科");
    assert.ok(googleData.sourceUrl?.includes("wikipedia.org"));
    assert.equal(companyInfoAdapter.validate?.(googleData), true);
  });

  it("should be automatically selected by AI based on search query and content evidence", () => {
    // 1. Direct query with company keyword
    const result1 = selectWidgetsByEvidence({
      query: "谷歌 公司概况与总部",
      sources: [
        { id: "s1", title: "Google - 维基百科", snippet: "谷歌有限责任公司是一家跨国科技公司，专注于在线广告、搜索引擎...", url: "https://zh.wikipedia.org/wiki/Google" }
      ]
    });
    assert.ok(result1.selected.includes("company_info"), "AI should select company_info for Google query");

    // 2. Query without explicit company name but search content reveals company entity
    const result2 = selectWidgetsByEvidence({
      query: "Alphabet 财报与业务架构",
      sources: [
        { id: "s1", title: "Alphabet Inc. - 官方概况", snippet: "Alphabet 是一家跨国科技公司，商业控股母公司，总部位于加州山景城...", url: "https://abc.xyz" }
      ]
    });
    assert.ok(result2.selected.includes("company_info"), "AI should select company_info based on search corpus evidence");

    // 3. Weather query should NOT select company_info
    const resultWeather = selectWidgetsByEvidence({
      query: "广州明天天气预报",
      sources: [
        { id: "s1", title: "广州天气网", snippet: "明日气温 22-28 度，晴转多云...", url: "https://weather.com" }
      ]
    });
    assert.ok(!resultWeather.selected.includes("company_info"), "AI should not select company_info for weather query");
  });

  it("should be registered and resolved by WidgetRegistry", () => {
    if (!extensionRegistry.has("company_info")) {
      extensionRegistry.register(companyInfoExtension);
    }
    assert.ok(extensionRegistry.has("company_info"));

    const mod = WidgetRegistry.get("company_info");
    assert.ok(mod, "WidgetRegistry should resolve company_info module");
    assert.equal(mod.id, "company_info");
    assert.equal(mod.name, "公司信息");
  });
});
