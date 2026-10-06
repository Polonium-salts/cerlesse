/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Markdown 预处理的行为契约。
 * 重点：围栏代码块里的「纯工具调用转录」必须被剔除，
 * 而普通 JSON 示例代码必须原样保留。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { preprocessMarkdown } from "../../src/widgets/components/MarkdownContent.js";

describe("preprocessMarkdown 工具调用转录清洗", () => {
  it("剔除围栏 json 块中的工具调用对象", () => {
    const raw = [
      "这是回答正文。",
      "",
      "```json",
      '{"name": "search_web", "arguments": {"language": "zh-CN", "query": "量子退火"}}',
      "```",
      "",
      "结论如上。"
    ].join("\n");

    const out = preprocessMarkdown(raw);
    assert.ok(!out.includes("search_web"), "不得残留工具名");
    assert.ok(!out.includes("量子退火"), "不得残留工具入参");
    assert.ok(out.includes("这是回答正文。"), "正文必须保留");
    assert.ok(out.includes("结论如上。"), "尾部正文必须保留");
  });

  it("剔除 parameters 写法的工具调用对象", () => {
    const raw = '```json\n{"name": "prepare_widget", "parameters": {"widgetId": "ai_answer"}}\n```';
    const out = preprocessMarkdown(raw);
    assert.equal(out.includes("prepare_widget"), false);
  });

  it("保留普通 JSON 示例代码", () => {
    const raw = [
      "```json",
      '{"name": "Alice", "age": 30, "tags": ["a", "b"]}',
      "```"
    ].join("\n");

    const out = preprocessMarkdown(raw);
    assert.ok(out.includes("Alice"), "普通 JSON 示例不得被误删");
    assert.ok(out.includes("age"), "普通 JSON 示例不得被误删");
  });

  it("保留没有 name 字段的裸 JSON 块", () => {
    const raw = '```json\n{"results": [{"title": "x"}]}\n```';
    assert.ok(preprocessMarkdown(raw).includes("results"));
  });

  it("保留被截断的非法 JSON（不抛异常、不误删）", () => {
    const raw = '```json\n{"name": "search_web", "arguments": {"query": "未闭合\n```';
    const out = preprocessMarkdown(raw);
    assert.ok(out.length > 0, "非法 JSON 应原样保留而不是清空");
  });

  it("保留普通语言代码块", () => {
    const raw = ["```ts", 'const x: number = 1;', "export default x;", "```"].join("\n");
    const out = preprocessMarkdown(raw);
    assert.ok(out.includes("const x: number = 1;"));
    assert.ok(out.includes("export default x;"));
  });

  it("保留无语言标注的围栏块", () => {
    const raw = ["```", "plain text block", "```"].join("\n");
    assert.ok(preprocessMarkdown(raw).includes("plain text block"));
  });

  it("仍剔除既有协议标签形式的工具调用", () => {
    const raw = ["正文", "<|tool_call|>call:search_web{\"query\":\"x\"}<|tool_call|>", "结尾"].join("\n");
    const out = preprocessMarkdown(raw);
    assert.ok(!out.includes("search_web"));
    assert.ok(out.includes("正文") && out.includes("结尾"));
  });

  it("name 不是合法标识符时不判定为工具调用", () => {
    const raw = '```json\n{"name": "not a tool", "arguments": {"a": 1}}\n```';
    assert.ok(preprocessMarkdown(raw).includes("not a tool"), "空格等非法标识符不应误判");
  });

  it("工具调用块紧跟在普通代码块之后时也能剔除（围栏配对回归）", () => {
    // 旧实现用单个全局正则，\s* 跨行吃掉换行后会把上一个代码块的结束围栏
    // 误当成这个块的开始围栏，于是工具调用块整块漏掉（已在真实 UI 上复现）。
    const raw = [
      "示例代码：",
      "",
      "```python",
      "import numpy as np",
      "```",
      "",
      "```json",
      '{"name": "search_web", "arguments": {"query": "量子退火"}}',
      "```",
      "",
      "结论如上。"
    ].join("\n");

    const out = preprocessMarkdown(raw);
    assert.ok(out.includes("import numpy as np"), "普通代码块必须保留");
    assert.ok(out.includes("结论如上。"), "尾部正文必须保留");
    assert.ok(!out.includes("search_web"), "工具调用块必须剔除");
  });

  it("~~~ 围栏同样生效", () => {
    const raw = ["~~~json", '{"name": "verify_source", "arguments": {"url": "https://x"}}', "~~~"].join("\n");
    assert.ok(!preprocessMarkdown(raw).includes("verify_source"));
  });
});

describe("preprocessMarkdown 块级公式归一", () => {
  it("单行 $$…$$ 展成三行块（remark-math 只认独占行的 $$）", () => {
    const raw = ["绝热定理给出：", "", "$$|\\langle \\psi_0| \\rangle| \\ge 1/N^{1/3}$$", "", "结束。"].join("\n");
    const out = preprocessMarkdown(raw);
    assert.ok(/\n\$\$\n/.test(out), `应产出独占行的 $$，实际：\n${out}`);
    assert.ok(out.includes("绝热定理给出："));
    assert.ok(out.includes("结束。"));
  });

  it("已经是三行块的公式不被改写", () => {
    const raw = ["$$", "E = mc^2", "$$", "", "结束。"].join("\n");
    const out = preprocessMarkdown(raw);
    assert.equal((out.match(/^\$\$$/gm) || []).length, 2, "不应额外插入 $$ 分隔行");
    assert.ok(out.includes("E = mc^2"));
  });

  it("行内混排的 $$ 保持原样（交给 inlineMath）", () => {
    const raw = "其中 $$x$$ 与 $y$ 都要看。";
    assert.equal(preprocessMarkdown(raw), "其中 $$x$$ 与 $y$ 都要看。");
  });

  it("代码块里的 $$ 字面量不受影响", () => {
    const raw = ["```bash", 'echo "$$HOME"', "$$not math$$", "```"].join("\n");
    assert.ok(preprocessMarkdown(raw).includes('echo "$$HOME"'));
    assert.ok(preprocessMarkdown(raw).includes("$$not math$$"));
  });
});