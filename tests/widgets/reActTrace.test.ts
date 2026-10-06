import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildReActTrace,
  formatReActSummary,
  type ReActPhaseKind
} from "../../src/lib/reActTrace.js";
import type { AgentStep } from "../../src/types.js";

/**
 * ReAct-Read 循环思维链投影测试
 * ========================================================================
 * 锁定的不只是「函数能跑」，而是 AGENTS.md 的硬约束：
 *   Do not claim a tool was executed unless a real tool result exists.
 *
 * 因此本测试重点断言两件反造假的事：
 *   1. 没有 tool result 就绝不能出现 Read 节点；
 *   2. 没有 reasoning 记录就绝不能凭空出现 Thought 节点。
 */

function toolStep(over: Partial<AgentStep> = {}): AgentStep {
  return {
    id: "call_1",
    title: "检索网络：量子退火",
    description: "抓取到 12 条高置信度权威信源 (耗时 420ms)",
    status: "completed",
    timestamp: 1_000,
    details: ["耗时 420ms"],
    ...over
  };
}

function reasoningStep(over: Partial<AgentStep> = {}): AgentStep {
  return {
    id: "reason_1_0",
    title: "检索推理",
    description: "证据不足，补充检索量子退火优势",
    status: "completed",
    timestamp: 900,
    agentRole: "retrieval",
    agentName: "检索推理层",
    ...over
  };
}

describe("buildReActTrace · 空与异常输入", () => {
  it("undefined / null / 空数组都产出空链路，不抛异常", () => {
    for (const input of [undefined, null, []]) {
      const trace = buildReActTrace(input as any);
      assert.equal(trace.isEmpty, true);
      assert.deepEqual(trace.nodes, []);
      assert.equal(trace.isRunning, false);
    }
  });

  it("非对象元素被跳过，不影响其余步骤", () => {
    const trace = buildReActTrace([null, undefined as any, toolStep()] as any);
    assert.equal(trace.actCount, 1);
  });
});

describe("buildReActTrace · Act → Read 成对生成", () => {
  it("completed 的工具步骤同时产出 Act 与 Read 两个阶段", () => {
    const trace = buildReActTrace([toolStep()]);
    assert.equal(trace.actCount, 1);
    assert.equal(trace.readCount, 1);
    assert.equal(trace.rounds.length, 1);

    const kinds = trace.nodes.map((n) => n.kind);
    assert.deepEqual(kinds, ["act", "read"]);

    // Read 必须携带真实观测结论（recordToolResult 改写后的 description）
    const read = trace.nodes.find((n) => n.kind === "read")!;
    assert.match(read.detail ?? "", /12 条高置信度权威信源/);
    assert.deepEqual(read.details, ["耗时 420ms"]);
  });

  it("running 的工具步骤只有 Act，绝不伪造 Read", () => {
    const trace = buildReActTrace([
      toolStep({ status: "running", description: "参数: {query:\"量子退火\"}", details: undefined })
    ]);
    assert.equal(trace.readCount, 0);
    assert.equal(trace.isRunning, true);
    assert.deepEqual(trace.nodes.map((n) => n.kind), ["act"]);
    // 进行中的回合会被标记
    assert.equal(trace.rounds[0].inFlight, true);
    // Act 保留真实参数
    assert.match(trace.nodes[0].detail ?? "", /量子退火/);
  });

  it("error 的工具步骤产出 Read 且状态为 error", () => {
    const trace = buildReActTrace([toolStep({ status: "error", description: "工具执行失败" })]);
    assert.equal(trace.readCount, 1);
    const read = trace.nodes.find((n) => n.kind === "read")!;
    assert.equal(read.status, "error");
    assert.equal(read.title, "读回失败");
  });

  it("description 仍是参数回显时，Read 绝不把入参当作观测结论", () => {
    // 真实链路中 verify_source / search_images / get_widget_catalog 属于这一类：
    // recordToolResult 未改写 description，它仍是 `参数: {...}`。
    const trace = buildReActTrace([
      toolStep({
        id: "verify_1",
        title: "核验信源权威度与域安全",
        description: '参数: {"url":"https://example.com/post"}',
        details: ["耗时 50ms"]
      })
    ]);

    const read = trace.nodes.find((n) => n.kind === "read")!;
    assert.doesNotMatch(
      read.detail ?? "",
      /example\.com/,
      "入参 URL 不得出现在 Read 节点里冒充检索结果"
    );
    assert.equal(read.detail, "耗时 50ms");

    // 参数则归位到 Act 节点（Act 的语义就是「做了什么」）
    const act = trace.nodes.find((n) => n.kind === "act")!;
    assert.match(act.detail ?? "", /参数/);
    assert.match(act.detail ?? "", /example\.com/);
  });

  it("description 是观测结论时，Act 不重复展示观测内容", () => {
    const trace = buildReActTrace([
      toolStep({ id: "search_1", description: "抓取到 8 条高置信度权威信源 (耗时 4001ms)" })
    ]);
    const act = trace.nodes.find((n) => n.kind === "act")!;
    assert.equal(act.detail, undefined, "参数已被观测结论覆盖时不应编造 Act 参数");
    const read = trace.nodes.find((n) => n.kind === "read")!;
    assert.match(read.detail ?? "", /8 条高置信度权威信源/);
  });

  it("既无观测结论也无执行详情时，Read 留空而不是填充内容", () => {
    const trace = buildReActTrace([
      toolStep({ description: '参数: {}', details: undefined })
    ]);
    const read = trace.nodes.find((n) => n.kind === "read")!;
    assert.equal(read.detail, undefined);
  });

  it("节点 id 稳定可复用（act/read 以 :: 区分同一 callId）", () => {
    const trace = buildReActTrace([toolStep()]);
    assert.deepEqual(trace.nodes.map((n) => n.id), ["call_1::act", "call_1::read"]);
  });
});

describe("buildReActTrace · Thought 识别", () => {
  it("agentRole=retrieval 的步骤归为 Thought，且不产生工具回合", () => {
    const trace = buildReActTrace([reasoningStep()]);
    assert.equal(trace.thoughtCount, 1);
    assert.equal(trace.actCount, 0);
    assert.equal(trace.nodes[0].kind, "thought");
    assert.match(trace.nodes[0].detail ?? "", /证据不足/);
  });

  it("reason_ 前缀同样被识别为 Thought（历史数据不依赖单一字段）", () => {
    const trace = buildReActTrace([
      { id: "reason_x", title: "检索推理", description: "d", status: "completed", timestamp: 1 }
    ]);
    assert.equal(trace.thoughtCount, 1);
    assert.equal(trace.actCount, 0);
  });

  it("普通工具 callId 不会被误判为 Thought", () => {
    const trace = buildReActTrace([toolStep({ id: "reasoning_like_tool" })]);
    assert.equal(trace.thoughtCount, 0);
    assert.equal(trace.actCount, 1);
  });
});

describe("buildReActTrace · 混合真实链路", () => {
  it("完整 ReAct-Read 循环按时间顺序展平", () => {
    const trace = buildReActTrace([
      reasoningStep({ id: "reason_1", timestamp: 100 }),
      toolStep({ id: "call_1", timestamp: 200 }),
      toolStep({ id: "call_2", timestamp: 300, status: "running", description: "参数: {}" })
    ]);

    const kinds: ReActPhaseKind[] = trace.nodes.map((n) => n.kind);
    assert.deepEqual(kinds, ["thought", "act", "read", "act"]);
    assert.equal(trace.thoughtCount, 1);
    assert.equal(trace.actCount, 2);
    assert.equal(trace.readCount, 1);
    assert.equal(trace.isRunning, true);
    assert.equal(trace.isEmpty, false);

    // 时间戳单调不降
    const stamps = trace.nodes.map((n) => n.timestamp);
    assert.deepEqual(stamps, [...stamps].sort((a, b) => a - b));
  });

  it("纯函数：相同输入得到相同输出（可回放）", () => {
    const steps = [reasoningStep(), toolStep()];
    assert.deepEqual(buildReActTrace(steps), buildReActTrace(steps));
  });

  it("不修改传入的步骤数组（保持不可变）", () => {
    const steps = [toolStep({ status: "running" })];
    const snapshot = JSON.stringify(steps);
    buildReActTrace(steps);
    assert.equal(JSON.stringify(steps), snapshot);
  });
});

describe("formatReActSummary", () => {
  it("空链路返回明确文案", () => {
    assert.equal(formatReActSummary(buildReActTrace([])), "暂无 ReAct 循环记录");
  });

  it("汇总真实计数", () => {
    const summary = formatReActSummary(
      buildReActTrace([reasoningStep(), toolStep(), toolStep({ id: "call_2" })])
    );
    assert.equal(summary, "思考 1 步 · 调用 2 次工具 · 读回 2 次");
  });

  it("缺失的阶段不产生多余片段", () => {
    assert.equal(formatReActSummary(buildReActTrace([reasoningStep()])), "思考 1 步");
  });
});
