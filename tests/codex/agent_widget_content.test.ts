import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SearchResult } from "../../src/types.js";
import { extractAgentTakeaways, stabilizeAgentAnswer } from "../../server/codex/agentWidgetContent.js";

function source(id: string, title: string, snippet: string): SearchResult {
  return { id, title, url: `https://${id}.example.com/docs`, snippet };
}

describe("Agent widget answer content stability", () => {
  const sources = [
    source("one", "官方文档：功能概览", "官方文档说明了核心功能与适用范围。"),
    source("two", "项目指南", "指南列出了安装步骤和配置选项。")
  ];

  it("supplements terse answers with source-grounded evidence and stable structure", () => {
    const answer = stabilizeAgentAnswer("项目功能", "项目提供核心功能。", sources);
    assert.ok(answer.includes("项目提供核心功能。"));
    assert.ok(answer.includes("## 关于「项目功能」"));
    assert.ok(answer.includes("### 检索证据与来源"));
    assert.ok(answer.includes("官方文档说明了核心功能与适用范围。"));
    assert.ok(answer.includes("[2]"));
    assert.equal(extractAgentTakeaways(answer, sources).length, 2);
  });

  it("replaces placeholder model output with evidence rather than displaying the placeholder", () => {
    const answer = stabilizeAgentAnswer("项目功能", "Finished processing.", sources);
    assert.ok(!answer.includes("Finished processing"));
    assert.ok(answer.includes("检索证据与来源"));
  });

  it("preserves already substantive answers and does not invent facts without sources", () => {
    const richAnswer = `${"有充分来源支持的分析结论。".repeat(18)}\n\n## 结论\n\n仍需核验具体版本。`;
    assert.equal(stabilizeAgentAnswer("项目", richAnswer, sources), richAnswer);

    const noEvidence = stabilizeAgentAnswer("项目", "暂时无法确认。", []);
    assert.ok(noEvidence.includes("目前没有可引用的检索来源"));
    assert.deepEqual(extractAgentTakeaways("没有列表格式的回答", []), []);
  });

  it("supports ordered markdown bullets when present", () => {
    assert.deepEqual(extractAgentTakeaways("1. 首要结论\n2) 次要结论", sources), ["首要结论", "次要结论"]);
  });
});
