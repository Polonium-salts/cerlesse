import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ALWAYS_ON_WIDGETS,
  isAlwaysOnWidget,
  injectAlwaysOnWidgets,
  applyAlwaysOnGuarantee,
  WIDGET_ACTIVATION_POLICY
} from "../../../src/widgets/widgetContract.js";
import { determineClientWidgetActivation } from "../../../src/lib/adaptiveLayout.js";
import { prepareWidgetTool } from "../../../server/tools/widgetTool.js";
import {
  ALL_RESULT_WIDGET_KEYS,
  type ResultWidgetKey,
  type SearchSynthesisResult,
  type WidgetPlan
} from "../../../src/types.js";

/**
 * 常驻小组件回归测试
 * ============================================================
 * 修复的问题：「AI 回答」与「网站跳转」卡片间歇性不显示。
 *
 * 根因是三处按优先级排序 + 截断的环节把 basePriority 较低的常驻组件挤掉，
 * 而图片图集还会被旧的"无图"判据剔除。
 *
 * 本测试锁定最终行为：无论输入如何，三个常驻组件必须出现在最终清单里，
 * 且不会因为超限被裁掉。这样后续任何一处新增排序都不会让问题复发。
 */

function makeResult(over: Partial<SearchSynthesisResult> = {}): SearchSynthesisResult {
  return {
    query: "docker 安装",
    timestamp: Date.now(),
    plan: {
      originalQuery: "docker 安装",
      intent: "general_knowledge",
      subQueries: [],
      comparisonDimensions: []
    },
    steps: [],
    filteredResults: [],
    rawResultCount: 0,
    summary: "这是一段用于测试的总结文本。",
    keyTakeaways: [],
    comparisonTable: [],
    mindMap: { id: "root", label: "docker 安装" },
    followUpQuestions: [],
    modelUsed: "test-model",
    executionTimeMs: 1,
    ...over
  } as SearchSynthesisResult;
}

function makePlan(widgetOrder: ResultWidgetKey[]): WidgetPlan {
  return {
    intent: "general_knowledge",
    userGoal: "test",
    suggestedArchetype: "verdict_summary",
    capabilities: [],
    widgets: widgetOrder.map((type, idx) => ({
      type,
      priority: 90 - idx,
      size: 50 as 25 | 50 | 75 | 100,
      flexible: true,
      reason: "测试规划"
    })),
    widgetOrder,
    primaryActions: []
  } as WidgetPlan;
}

describe("常驻组件契约", () => {
  it("常驻清单固定为 AI 回答 / 权威跳转 / 图片图集三件套", () => {
    assert.deepEqual(ALWAYS_ON_WIDGETS, ["ai_answer", "related_links", "image_gallery"]);
  });

  it("isAlwaysOnWidget 只认这三个键", () => {
    assert.equal(isAlwaysOnWidget("ai_answer"), true);
    assert.equal(isAlwaysOnWidget("related_links"), true);
    assert.equal(isAlwaysOnWidget("image_gallery"), true);
    assert.equal(isAlwaysOnWidget("weather"), false);
    assert.equal(isAlwaysOnWidget("takeaways"), false);
  });
});

describe("injectAlwaysOnWidgets", () => {
  it("缺失的常驻组件会被补入，且速答置顶、跳转紧随其后", () => {
    const result = injectAlwaysOnWidgets(["weather", "mindmap"]);
    assert.equal(result[0], "ai_answer", "速答应置顶");
    assert.equal(result[1], "related_links", "权威入口应紧跟速答");
  });

  it("已存在的常驻组件保持原位不动，不被重复插入", () => {
    const result = injectAlwaysOnWidgets(["mindmap", "ai_answer", "related_links", "image_gallery"]);
    assert.deepEqual(result, ["mindmap", "ai_answer", "related_links", "image_gallery"]);
  });

  it("完全为空的清单也能被补齐", () => {
    const result = injectAlwaysOnWidgets([]);
    assert.deepEqual(result, ["ai_answer", "related_links", "image_gallery"]);
  });
});

describe("applyAlwaysOnGuarantee", () => {
  it("超出上限时只裁非常驻组件，常驻一个都不掉", () => {
    // 构造一个远超 max 的清单，且常驻故意放在最容易被裁掉的尾部
    const oversized = (ALL_RESULT_WIDGET_KEYS.filter(
      (k) => !ALWAYS_ON_WIDGETS.includes(k)
    ) as ResultWidgetKey[]).concat(ALWAYS_ON_WIDGETS);

    assert.ok(oversized.length > WIDGET_ACTIVATION_POLICY.max, "构造的清单应超过上限");

    const result = applyAlwaysOnGuarantee(oversized);
    assert.ok(
      result.length <= WIDGET_ACTIVATION_POLICY.max,
      `结果应被裁到上限内，实际 ${result.length}`
    );
    for (const key of ALWAYS_ON_WIDGETS) {
      assert.ok(result.includes(key), `常驻组件 ${key} 不应被裁掉`);
    }
  });

  it("幂等：重复调用结果不变", () => {
    const once = applyAlwaysOnGuarantee(["weather", "mindmap"]);
    const twice = applyAlwaysOnGuarantee(once);
    assert.deepEqual(twice, once);
  });
});

describe("最终排版输出恒含核心常驻组件", () => {
  it("零信源、零图片、零要点的最贫瘠场景下仍全部上桌", () => {
    const strategy = determineClientWidgetActivation({
      result: makeResult({ summary: "", filteredResults: [], relatedImages: [] }),
      query: "docker 安装",
      targetLanguage: "zh"
    });

    for (const key of ALWAYS_ON_WIDGETS) {
      assert.ok(
        strategy.enabledWidgets?.includes(key),
        `贫瘠场景下常驻组件 ${key} 缺失（实际启用：${strategy.enabledWidgets?.join(", ")}）`
      );
      assert.ok(
        strategy.componentOrder.includes(key),
        `常驻组件 ${key} 未进入阅读流`
      );
    }
  });

  it("上游规划清单完全不含常驻组件时也会被补齐", () => {
    const strategy = determineClientWidgetActivation({
      result: makeResult(),
      query: "docker 安装",
      targetLanguage: "zh",
      widgetPlan: makePlan(["weather", "mindmap", "comparison"])
    });

    for (const key of ALWAYS_ON_WIDGETS) {
      assert.ok(
        strategy.enabledWidgets?.includes(key),
        `上游未点名时仍应补齐 ${key}`
      );
    }
  });

  it("上游规划清单超长且不含常驻时，补齐同时不超限", () => {
    const longOrder = ALL_RESULT_WIDGET_KEYS.filter(
      (k) => !ALWAYS_ON_WIDGETS.includes(k)
    ) as ResultWidgetKey[];

    const strategy = determineClientWidgetActivation({
      result: makeResult(),
      query: "docker 安装",
      targetLanguage: "zh",
      widgetPlan: makePlan(longOrder)
    });

    for (const key of ALWAYS_ON_WIDGETS) {
      assert.ok(strategy.enabledWidgets?.includes(key), `超长清单下 ${key} 仍须上桌`);
    }
    assert.ok(
      (strategy.enabledWidgets?.length ?? 0) <= WIDGET_ACTIVATION_POLICY.max,
      "启用总数不应超出策略上限"
    );
  });

  it("连续多次启用结果稳定（防状态污染导致的间歇性消失）", () => {
    for (let i = 0; i < 5; i++) {
      const strategy = determineClientWidgetActivation({
        result: makeResult(),
        query: "docker 安装",
        targetLanguage: "zh",
        widgetPlan: makePlan(["weather", "mindmap"])
      });
      for (const key of ALWAYS_ON_WIDGETS) {
        assert.ok(
          strategy.enabledWidgets?.includes(key),
          `第 ${i + 1} 次启用时 ${key} 缺失`
        );
      }
    }
  });

  it("常驻组件注入函数保证常驻组件", () => {
    const list = injectAlwaysOnWidgets(["weather"]);
    for (const key of ALWAYS_ON_WIDGETS) {
      assert.ok(
        list.includes(key),
        `常驻组件注入缺少 ${key}（实际：${list.join(", ")}）`
      );
    }
  });

  it("其余组件仍由 Agent 自主决定（未把整个清单钉死）", () => {
    const withoutWeather = determineClientWidgetActivation({
      result: makeResult(),
      query: "docker 安装",
      targetLanguage: "zh"
    });
    const withWeather = determineClientWidgetActivation({
      result: makeResult(),
      query: "北京天气",
      targetLanguage: "zh"
    });

    // 天气组件只在天气类查询下出现，说明"其他组件由 agent 自动选择"这一条未被破坏
    assert.equal(
      withoutWeather.enabledWidgets?.includes("weather"),
      false,
      "非天气查询不应出现天气卡片"
    );
    assert.equal(
      withWeather.enabledWidgets?.includes("weather"),
      true,
      "天气查询应自动选中天气卡片"
    );
  });
});
