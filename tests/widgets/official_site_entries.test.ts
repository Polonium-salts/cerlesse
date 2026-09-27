import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SearchResult } from "../../src/types.js";
import { buildOfficialSiteEntries } from "../../src/widgets/components/officialSiteEntries.js";

function result(id: string, isOfficial = false): SearchResult {
  return {
    id,
    title: `${id} 文档`,
    url: `https://${id}.example.com/docs`,
    snippet: `${id} 介绍和使用说明。`,
    isOfficial
  };
}

describe("Official navigation entry stability", () => {
  it("returns three entries for empty, sparse, and rich search results", () => {
    const empty = buildOfficialSiteEntries("React", []);
    const sparse = buildOfficialSiteEntries("React", [result("react", true)]);
    const rich = buildOfficialSiteEntries("React", [result("react", true), result("docs"), result("community"), result("extra")]);

    assert.equal(empty.length, 3);
    assert.equal(sparse.length, 3);
    assert.equal(rich.length, 3);
    assert.ok(empty.every((entry) => !entry.isOfficial && entry.tag === "搜索入口"));
    assert.equal(sparse[0].url, "https://react.example.com/docs");
    assert.equal(sparse[0].isOfficial, true);
    assert.ok(sparse.slice(1).every((entry) => !entry.isOfficial));
    assert.ok(rich.some((entry) => entry.url === "https://react.example.com/docs"));
  });

  it("ignores malformed URLs and keeps fallback URLs navigable", () => {
    const entries = buildOfficialSiteEntries("Rust", [
      { ...result("bad"), url: "javascript:alert(1)", isOfficial: true }
    ]);
    assert.equal(entries.length, 3);
    assert.ok(entries.every((entry) => entry.url.startsWith("https://www.google.com/search?")));
    assert.ok(entries.every((entry) => !entry.isOfficial));
  });
});
