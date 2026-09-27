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
  it("supports configurable maxEntries and preserves 3-entry behavior when specified", () => {
    const empty = buildOfficialSiteEntries("React", [], { maxEntries: 3, minEntries: 3 });
    const sparse = buildOfficialSiteEntries("React", [result("react", true)], { maxEntries: 3, minEntries: 3 });
    const rich = buildOfficialSiteEntries(
      "React",
      [result("react", true), result("docs"), result("community"), result("extra")],
      { maxEntries: 3 }
    );

    assert.equal(empty.length, 3);
    assert.equal(sparse.length, 3);
    assert.equal(rich.length, 3);
    assert.ok(empty.every((entry) => !entry.isOfficial && entry.tag === "搜索入口"));
    assert.equal(sparse[0].url, "https://react.example.com/docs");
    assert.equal(sparse[0].isOfficial, true);
    assert.ok(sparse.slice(1).every((entry) => !entry.isOfficial));
    assert.ok(rich.some((entry) => entry.url === "https://react.example.com/docs"));
  });

  it("expands real official and related entries up to 6 by default without fake search entries", () => {
    const items = [
      result("react", true),
      result("docs"),
      result("community"),
      result("extra"),
      result("tools"),
      result("blog")
    ];
    const entries = buildOfficialSiteEntries("React", items);
    assert.equal(entries.length, 6);
    // 真实结果充足时，全部为真实页面，不再包含任何假搜索链接
    assert.ok(entries.every((entry) => entry.tag !== "搜索入口"));
  });

  it("accurately matches brand domain without false positives on intent modifiers", () => {
    const query = "Docker 教程 下载 最新";
    const entries = buildOfficialSiteEntries(query, [
      {
        id: "1",
        title: "Docker Documentation",
        url: "https://docs.docker.com",
        snippet: "Get started with Docker containerization."
      },
      {
        id: "2",
        title: "最新下载技术分享博客",
        url: "https://random-blog.net/latest-download-tutorial",
        snippet: "这是一个普通的技术博客。"
      }
    ]);

    const dockerEntry = entries.find((e) => e.url === "https://docs.docker.com");
    const blogEntry = entries.find((e) => e.url.includes("random-blog.net"));

    assert.ok(dockerEntry);
    assert.equal(dockerEntry?.isOfficial, true);
    // 普通博客不应因为命中意图词“下载/最新”而被判定为官方
    assert.equal(blogEntry?.isOfficial, false);
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
