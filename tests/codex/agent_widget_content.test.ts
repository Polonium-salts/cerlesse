import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SearchResult } from "../../src/types.js";
import {
  extractAgentTakeaways,
  finalizeAnswer,
  sanitizeAgentAnswer,
  stabilizeAgentAnswer,
  synthesizeAnswerFromSources
} from "../../server/codex/agentWidgetContent.js";

function source(id: string, title: string, snippet: string): SearchResult {
  return { id, title, url: `https://${id}.example.com/docs`, snippet };
}

describe("Agent answer content adaptiveness and sanitization", () => {
  const sources = [
    source("one", "官方文档：功能概览", "官方文档说明了核心功能与适用范围。"),
    source("two", "项目指南", "指南列出了安装步骤和配置选项。")
  ];

  it("preserves terse and direct answers without forcing fixed outline template or trailing headers", () => {
    const directAnswer = "珠穆朗玛峰海拔高程为 8848.86 米 [1]。";
    const answer = finalizeAnswer(directAnswer, sources);
    assert.equal(answer, directAnswer, "短小直接的回答应原样保留");
    assert.ok(!answer.includes("## 关于"), "不应强加 '## 关于' 标题");
    assert.ok(!answer.includes("背景与原理解析"), "不应强加 '背景与原理解析'");
    assert.ok(!answer.includes("检索证据与来源"), "不应强加 '检索证据与来源'");
  });

  it("synthesizes grounded factual answer when model output is empty or placeholder", () => {
    const placeholder1 = finalizeAnswer("Finished processing.", sources, "项目功能");
    assert.ok(!placeholder1.includes("Finished processing"));
    assert.ok(placeholder1.includes("官方文档说明了核心功能与适用范围。 [1]"));
    assert.ok(placeholder1.includes("项目指南"));

    const placeholder2 = finalizeAnswer("已完成检索并生成回答。", sources, "项目功能");
    assert.ok(placeholder2.includes("[1]"));

    const emptyNoSources = finalizeAnswer("", []);
    assert.ok(emptyNoSources.includes("没有检索到可引用的来源，暂时无法回答这个问题。"));
  });

  it("directly synthesizes facts from sources with correct citations", () => {
    const synthesized = synthesizeAnswerFromSources("项目指南", sources);
    assert.ok(synthesized.includes("[1]"));
    assert.ok(synthesized.includes("官方文档说明了核心功能与适用范围。"));
  });

  it("cleans up protocol and leaked tool tags while preserving genuine response text", () => {
    const leaked = "<|tool_call|>call:search_web({\"query\":\"test\"})<|tool_call|>Vite 基于 ESM 启动速度极快 [1]，而 Webpack 依赖全量打包 [2]；生产构建推荐根据项目生态选型。";
    const cleaned = sanitizeAgentAnswer(leaked);
    assert.ok(!cleaned.includes("tool_call"));
    assert.ok(!cleaned.includes("call:search_web"));
    assert.ok(cleaned.startsWith("Vite 基于 ESM"));

    const finalRes = finalizeAnswer(leaked, sources);
    assert.ok(!finalRes.includes("tool_call"));
    assert.ok(!finalRes.includes("背景与原理解析"));
    assert.ok(!finalRes.includes("关键维度多维对比"));
    assert.ok(finalRes.includes("Vite 基于 ESM"));
  });

  it("supports ordered and unordered markdown bullets when genuinely present in answer", () => {
    assert.deepEqual(extractAgentTakeaways("1. 首要结论 [1]\n2) 次要结论 [2]", sources), ["首要结论", "次要结论"]);
    assert.deepEqual(extractAgentTakeaways("- 重点一\n* 重点二", sources), ["重点一", "重点二"]);
    assert.deepEqual(extractAgentTakeaways("一段没有列表项的普通正文回答", sources), []);
  });

  it("filters out advertisements and commercial spam from synthesized answers", () => {
    const mixedSources: SearchResult[] = [
      { id: "ad1", title: "【广告】大牌特惠限时抢购！点击立即购买", url: "https://www.bing.com/aclick?ld=123", snippet: "商业推广：专业服务，加微信咨询立享优惠！" },
      { id: "doc", title: "TypeScript 官方中文文档", url: "https://www.typescriptlang.org/zh/", snippet: "TypeScript 是具有类型语法的 JavaScript，可以在任何运行 JavaScript 的地方运行。" }
    ];
    const answer = finalizeAnswer("", mixedSources, "TypeScript 介绍");
    assert.ok(!answer.includes("广告"));
    assert.ok(!answer.includes("限时抢购"));
    assert.ok(!answer.includes("加微信"));
    assert.ok(answer.includes("TypeScript 是具有类型语法的 JavaScript"));
  });

  it("ensures backward compatibility for stabilizeAgentAnswer alias", () => {
    const result = stabilizeAgentAnswer("Node.js", "Node.js 是基于 V8 的 JS 运行时 [1]。", sources);
    assert.equal(result, "Node.js 是基于 V8 的 JS 运行时 [1]。", "stabilizeAgentAnswer 兼容保留直接回答");
  });
});
