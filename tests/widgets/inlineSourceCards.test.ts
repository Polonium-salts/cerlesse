/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 正文常显信源卡：把「这句话是从哪个页面来的」直接穿插在引用它的段落后面。
 *
 * 这里锁两件事：
 *   1. 解析 / 收集的纯函数契约 —— 角标与卡片必须指向同一个信源，
 *      对不上信源的链接不许造卡（造卡就是编造溯源信息）；
 *   2. 真正渲染出来的正文里，信源卡确实紧跟段落出现，而不是悬停才存在。
 */

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MarkdownContent,
  collectBlockSources,
  findSourceByUrl,
  resolveBracketCitation
} from "../../src/widgets/components/MarkdownContent.js";
import { canonicalUrlKey } from "../../src/widgets/components/SourceLink.js";
import type { SourceCitation } from "../../src/widgets/components/SourceLink.js";

const SOURCES: SourceCitation[] = [
  {
    index: 1,
    title: "搜索 - 哔哩哔哩_bilibili",
    url: "https://search.bilibili.com/video",
    snippet: "bilibili是国内知名的视频弹幕网站。"
  },
  {
    index: 2,
    title: "量子退火 - 维基百科",
    url: "https://zh.wikipedia.org/wiki/量子退火",
    snippet: "量子退火是一种元启发式算法。"
  }
];

test("canonicalUrlKey：只抹平不影响定位的差异", () => {
  assert.equal(
    canonicalUrlKey("https://www.Example.com/a/b/"),
    canonicalUrlKey("https://example.com/a/b")
  );
  // 同一个站点的不同页面不能被当成同一个信源，否则溯源是假的
  assert.notEqual(canonicalUrlKey("https://example.com/a"), canonicalUrlKey("https://example.com/a?q=1"));
  assert.notEqual(canonicalUrlKey("https://example.com/a"), canonicalUrlKey("https://example.com/b"));
  assert.equal(canonicalUrlKey(""), "");
  assert.equal(canonicalUrlKey(undefined), "");
});

test("resolveBracketCitation：数字角标 / 标题模糊匹配 / 普通括号文本", () => {
  assert.equal(resolveBracketCitation("1", SOURCES)?.index, 1);
  assert.equal(resolveBracketCitation("source-2", SOURCES)?.source, SOURCES[1]);
  // 越界序号：角标照旧显示，但没有信源可挂，不猜
  assert.equal(resolveBracketCitation("9", SOURCES)?.index, 9);
  assert.equal(resolveBracketCitation("9", SOURCES)?.source, undefined);
  assert.equal(resolveBracketCitation("维基百科", SOURCES)?.index, 2);
  assert.equal(resolveBracketCitation("可选", SOURCES), null);
  assert.equal(resolveBracketCitation("   ", SOURCES), null);
});

test("resolveBracketCitation：常显卡片不开「退化成 1 号」的兜底", () => {
  const snippetLike = "某站点: 这是一段很长的残留摘要文本";
  assert.equal(resolveBracketCitation(snippetLike, SOURCES)?.index, 1);
  assert.equal(resolveBracketCitation(snippetLike, SOURCES, { allowFallbackToFirst: false }), null);
});

test("findSourceByUrl：www./尾斜杠/大小写差异仍能对上，不同页面不混为一谈", () => {
  assert.equal(findSourceByUrl("https://search.bilibili.com/video", SOURCES), SOURCES[0]);
  assert.equal(findSourceByUrl("https://www.search.bilibili.com/video/", SOURCES), SOURCES[0]);
  assert.equal(findSourceByUrl("https://search.bilibili.com/search?keyword=a", SOURCES), undefined);
  assert.equal(findSourceByUrl("", SOURCES), undefined);
  assert.equal(findSourceByUrl("https://search.bilibili.com/video", undefined), undefined);
});

test("collectBlockSources：段落里的角标与外链都收，按出现顺序去重", () => {
  const children = React.createElement(
    React.Fragment,
    null,
    "量子退火见 ",
    React.createElement("a", { href: "https://www.search.bilibili.com/video/" }, "哔哩哔哩"),
    " 与 [2]，同一来源再提一次 [2]。"
  );
  const out = collectBlockSources(children, SOURCES);
  assert.deepEqual(
    out.map((s) => s.url),
    [SOURCES[0].url, SOURCES[1].url]
  );
});

test("collectBlockSources：对不上信源的链接、代码块里的 [1] 都不造卡", () => {
  const children = React.createElement(
    React.Fragment,
    null,
    React.createElement("a", { href: "https://unknown-source.example.com/x" }, "未知来源"),
    React.createElement("code", { className: "font-mono" }, "[1]"),
    React.createElement("em", null, "没有引用"),
    "[可选]"
  );
  assert.deepEqual(collectBlockSources(children, SOURCES), []);
  // 没有信源时不产生任何卡片
  assert.deepEqual(collectBlockSources(children, undefined), []);
});

test("渲染：信源卡紧跟引用它的段落，两行版式且整张卡可点开原文", () => {
  const html = renderToStaticMarkup(
    React.createElement(MarkdownContent, {
      sources: SOURCES,
      language: "zh",
      children: "哔哩哔哩是国内知名的视频弹幕网站 [1]。\n\n另一段提到 [维基百科]。\n"
    })
  );

  assert.ok(html.includes("search.bilibili.com"), "域名要出现在正文里");
  assert.ok(html.includes("搜索 - 哔哩哔哩_bilibili"), "标题要出现在正文里");
  assert.ok(html.includes("bilibili是国内知名的视频弹幕网站。"), "摘要要出现在正文里");
  assert.ok(html.includes('role="group"'), "常显信源卡应该真的渲染出来");

  // 卡片自己的标记，用来定位它在正文里的位置
  const paragraphEnd = html.indexOf("</p>");
  assert.ok(paragraphEnd > -1, "正文里应该还有段落");
  const cardAt = html.indexOf('data-source-card="inline"');
  assert.ok(cardAt > paragraphEnd, "信源卡必须出现在段落之后，而不是悬停才存在");

  // 整张卡就是链接：标题与摘要都能直接点开原文（不再依赖卡内按钮）
  const cardHtml = html.slice(cardAt, html.indexOf("</a>", cardAt));
  assert.ok(
    cardHtml.includes('href="https://search.bilibili.com/video"'),
    "卡片要指向真实信源 URL，溯源不能被截断"
  );
  assert.ok(cardHtml.includes('target="_blank"'), "卡片要能在新标签页打开原文");
  assert.ok(cardHtml.includes("搜索 - 哔哩哔哩_bilibili"), "标题要在卡片内");
});

test("渲染：表格单元格里的角标不再长卡，避免噪音", () => {
  const html = renderToStaticMarkup(
    React.createElement(MarkdownContent, {
      sources: SOURCES,
      children: "| 维度 | 来源 |\n| --- | --- |\n| 视频 | [1] |\n"
    })
  );
  assert.ok(html.includes("视频"), "表格本身要正常渲染");
  assert.ok(!html.includes("bilibili是国内知名的视频弹幕网站。"), "表格里不该插信源卡");
});
