import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cleanAdFromSummary } from "../../src/widgets/components/AiAnswerWidget.js";

/**
 * AI 回答正文清洗测试
 * ========================================================================
 * 背景：模型经常把「思考过程 + 工具调用原文」一起吐进 answer，
 * 例如真实抓到过的正文：
 *
 *   I will begin by searching for ... I'll use precise technical terms ...
 *   search_web(query="量子退火算法原理 基础物理模型 数学表述", language="zh", recencyDays=365)
 *
 * 这段机器语法一旦漏进正文，会与组件内新加的 ReAct-Read 循环自相矛盾：
 * 时间线里已经结构化展示了 Act/Read，正文里却又出现裸的调用语句。
 * 本测试锁定清洗规则，并确保不误伤正常英文/技术表述。
 */

describe("cleanAdFromSummary · 工具调用语法清洗", () => {
  it("清洗括号形式的 search_web 调用", () => {
    const input =
      '量子退火的核心原理。\n\nsearch_web(query="量子退火算法原理", language="zh", recencyDays=365)';
    const out = cleanAdFromSummary(input);
    assert.doesNotMatch(out, /search_web/);
    assert.match(out, /量子退火的核心原理/);
  });

  it("清洗全部注册工具的括号调用", () => {
    const tools = [
      'search_images(query="cat", limit=16)',
      'verify_source(url="https://example.com")',
      "get_widget_catalog()",
      'prepare_widget(widgetId="weather")',
      'solve_layout(width=100)',
      'browser_read(url="https://example.com/a")',
      'inspect_repository(repoPathOrUrl="a/b")',
      'create_action(label="下载")'
    ];
    for (const call of tools) {
      const out = cleanAdFromSummary(`结论正文。\n\n${call}`);
      assert.doesNotMatch(out, /\(\s*(query|url|widgetId|width|repoPathOrUrl|label)\s*=/,
        `未清洗: ${call}`);
      assert.match(out, /结论正文/);
    }
  });

  it("保留空格形式的既有清洗能力", () => {
    const out = cleanAdFromSummary('正文。\n\nsearch_web query="abc" extra');
    assert.doesNotMatch(out, /search_web/);
    assert.match(out, /正文/);
  });

  it("清洗 Tool:/Arguments:/Result: 等旧式转录行", () => {
    const out = cleanAdFromSummary(
      '正文开始。\nTool: search_web\nArguments: {"query":"x"}\nResult: {"results":[]}\n正文结束。'
    );
    assert.doesNotMatch(out, /Arguments:/);
    assert.doesNotMatch(out, /Result:/);
    assert.match(out, /正文开始/);
    assert.match(out, /正文结束/);
  });

  it("不误伤含工具名同义词的正常技术表述", () => {
    const keep = "The browser_read module 属于内置工具集之一，prepare_widget 负责绑定组件。";
    const out = cleanAdFromSummary(keep);
    assert.match(out, /browser_read module/);
    assert.match(out, /prepare_widget 负责绑定组件/);
  });

  it("多行调用同时出现时全部清洗", () => {
    const out = cleanAdFromSummary(
      '结论。\nsearch_web(query="a")\nsolve_layout(width=50)\n补充说明。'
    );
    assert.doesNotMatch(out, /search_web|solve_layout/);
    assert.match(out, /结论/);
    assert.match(out, /补充说明/);
  });
});

describe("cleanAdFromSummary · 既有广告清洗不回归", () => {
  it("剔除广告前缀行", () => {
    const out = cleanAdFromSummary("【广告】限时抢购，点击进入\n\n正常技术内容说明。");
    assert.doesNotMatch(out, /限时抢购/);
    assert.match(out, /正常技术内容说明/);
  });

  it("空输入安全", () => {
    assert.equal(cleanAdFromSummary(""), "");
    assert.equal(cleanAdFromSummary("   "), "");
  });
});
