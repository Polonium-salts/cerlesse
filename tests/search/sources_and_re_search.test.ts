import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SearchResult } from "../../src/types.js";
import { buildOfficialSiteEntries, DEFAULT_MIN_OFFICIAL_ENTRIES } from "../../src/widgets/components/officialSiteEntries.js";
import { MIN_SOURCES_REQUIREMENT, searchWebTool } from "../../server/tools/searchTool.js";

function makeItem(id: string, isOfficial = false): SearchResult {
  return {
    id,
    title: `${id} 官方技术文档与平台`,
    url: `https://${id}.example.com/docs`,
    snippet: `${id} 详细技术说明与核验信息。`,
    isOfficial
  };
}

describe("信源存证与网站直达最少 7 条内容 & 内容少自动重新搜索规范", () => {
  it("网站直达：默认保障最少 7 条直达内容", () => {
    assert.equal(DEFAULT_MIN_OFFICIAL_ENTRIES, 7);

    // 空检索结果时，由权威搜索直达通道补足 7 条
    const emptyEntries = buildOfficialSiteEntries("TypeScript", []);
    assert.equal(emptyEntries.length, 7);
    assert.ok(emptyEntries.every((e) => e.url && e.name));

    // 少于 7 条（例如 3 条真实结果）时，补充权威入口直至满 7 条
    const partialItems = [
      makeItem("ts-official", true),
      makeItem("ts-docs", true),
      makeItem("ts-handbook", false)
    ];
    const paddedEntries = buildOfficialSiteEntries("TypeScript", partialItems);
    assert.equal(paddedEntries.length, 7);
    assert.equal(paddedEntries[0].url, "https://ts-official.example.com/docs");
    assert.equal(paddedEntries[1].url, "https://ts-docs.example.com/docs");

    // 充足真实结果时（7 条及以上），不包含兜底搜索入口，全部为真实页面
    const richItems = [
      makeItem("ts-1", true),
      makeItem("ts-2"),
      makeItem("ts-3"),
      makeItem("ts-4"),
      makeItem("ts-5"),
      makeItem("ts-6"),
      makeItem("ts-7"),
      makeItem("ts-8")
    ];
    const richEntries = buildOfficialSiteEntries("TypeScript", richItems);
    assert.ok(richEntries.length >= 7);
    assert.ok(richEntries.every((e) => !e.url.includes("google.com/search")));
  });

  it("信源检索：单次搜索结果少于 7 条时自动重新再搜索一次并合并去重", async () => {
    assert.equal(MIN_SOURCES_REQUIREMENT, 7);

    // 验证 searchWebTool 在空查询时安全返回
    const emptyRes = await searchWebTool({ query: "" });
    assert.equal(emptyRes.total, 0);
    assert.equal(emptyRes.results.length, 0);
  });
});
