/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI 回答组件「只呈现 AI 内容」的行为约束。
 * 组件内不允许再出现：机器人头像、用户提问气泡、任何追问输入入口。
 * 提问统一走顶部搜索栏。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AiAnswerWidget } from "../../src/widgets/components/AiAnswerWidget.js";

function render(props: Record<string, unknown>): string {
  return renderToStaticMarkup(
    React.createElement(AiAnswerWidget as any, {
      query: "量子退火原理",
      summary: "量子退火利用绝热定理在超导电路中寻优。",
      ...props
    })
  );
}

describe("AiAnswerWidget 只保留 AI 内容", () => {
  it("多轮对话下不渲染用户提问气泡与用户提问文本", () => {
    const html = render({
      result: {
        summary: "",
        chatTurns: [
          { id: "u1", role: "user", content: "MY_SECRET_USER_QUESTION" },
          { id: "a1", role: "assistant", content: "第一轮 AI 回答正文。" },
          { id: "u2", role: "user", content: "ANOTHER_USER_QUESTION" },
          { id: "a2", role: "assistant", content: "第二轮 AI 回答正文。" }
        ]
      }
    });

    assert.ok(html.includes("第一轮 AI 回答正文。"), "应保留首轮 AI 回答");
    assert.ok(html.includes("第二轮 AI 回答正文。"), "应保留后续 AI 回答");
    assert.ok(!html.includes("MY_SECRET_USER_QUESTION"), "不得渲染用户提问内容");
    assert.ok(!html.includes("ANOTHER_USER_QUESTION"), "不得渲染后续用户提问内容");
    // 旧的用户气泡容器：右对齐 + 主色背景
    assert.ok(!html.includes("justify-end"), "不得再出现右对齐的用户气泡容器");
    assert.ok(!html.includes("rounded-tr-xs"), "不得再出现用户气泡的圆角样式");
  });

  it("assistant 回答前不再渲染圆形机器人头像", () => {
    const html = render({
      result: {
        summary: "",
        chatTurns: [{ id: "a1", role: "assistant", content: "AI 回答正文。" }]
      }
    });

    // 旧头像容器：size-6 圆形 + bg-primary/10 + 与文字并排的 flex 容器
    assert.ok(!html.includes("shrink-0 mt-0.5"), "不得再出现头像容器");
    assert.ok(!html.includes("flex gap-2.5 items-start"), "回答块不应再与头像并排");
    assert.ok(html.includes("AI 回答正文。"), "回答正文必须保留");
  });

  it("空态不含头像图标", () => {
    const html = render({ summary: "" });
    assert.ok(html.includes("暂无 AI 回答内容"));
    // 空态原有一个 size-7 的 Bot 图标
    assert.ok(!html.includes("size-7 text-muted-foreground/50"), "空态不得出现大号 Bot 图标");
  });

  it("组件内不含任何追问输入入口", () => {
    const html = render({
      result: {
        summary: "",
        followUpQuestions: ["追问一", "追问二"],
        chatTurns: [{ id: "a1", role: "assistant", content: "AI 回答正文。" }]
      }
    });

    assert.ok(!html.includes("<input"), "组件内不得有 input");
    assert.ok(!html.includes("<textarea"), "组件内不得有 textarea");
    assert.ok(!html.includes("智能推荐追问"), "不得出现智能推荐追问区块");
    assert.ok(!html.includes("追问一"), "不得渲染 followUpQuestions");
    assert.ok(!html.includes("发送"), "不得出现发送按钮");
  });
});