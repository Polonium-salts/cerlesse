import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateWidgetApplicability,
  filterApplicableWidgets
} from "../../src/widgets/applicability.js";
import { selectAgentWidgets } from "../../src/lib/adaptiveLayout.js";
import { resolveWidgetData } from "../../src/widgets/runtime.js";
import { initializeWidgetExtensions } from "../../src/widgets/registry/index.js";
import type { SearchSynthesisResult } from "../../src/types.js";

// 确保内置扩展已全部注册
initializeWidgetExtensions();

function makeMockResult(over: Partial<SearchSynthesisResult> = {}): SearchSynthesisResult {
  return {
    query: "google",
    timestamp: Date.now(),
    plan: {
      originalQuery: "google",
      intent: "general_knowledge",
      subQueries: [],
      comparisonDimensions: []
    },
    steps: [],
    filteredResults: [
      {
        id: "1",
        title: "Google Official Site",
        url: "https://www.google.com",
        snippet: "Google search homepage",
        isOfficial: true
      }
    ],
    rawResultCount: 1,
    summary: "Google 是全球领先的互联网搜索引擎。",
    keyTakeaways: ["Google 创立于 1998 年", "全球市场份额超过 90%"],
    comparisonTable: [],
    mindMap: { id: "root", label: "Google" },
    followUpQuestions: [],
    modelUsed: "test-model",
    executionTimeMs: 10,
    ...over
  } as SearchSynthesisResult;
}

describe("小组件适用性网关 (Unified Applicability Gate)", () => {
  describe("Google 纯文本/搜索引擎搜索场景", () => {
    const googleResult = makeMockResult({
      query: "google",
      relatedImages: [], // 无图片
      tokenUsage: undefined // 无 tokenUsage
    });

    it("AI智能回答与权威跳转必须适用", () => {
      const ai = evaluateWidgetApplicability("ai_answer", "google", googleResult);
      assert.equal(ai.applicable, true);
      assert.equal(ai.status, "ready");

      const links = evaluateWidgetApplicability("related_links", "google", googleResult);
      assert.equal(links.applicable, true);
      assert.equal(links.status, "ready");
    });

    it("搜索引擎直达组件因命中搜索引擎关键词而适用", () => {
      const se = evaluateWidgetApplicability("search_engine", "google", googleResult);
      assert.equal(se.applicable, true);
      assert.equal(se.status, "ready");
    });

    it("常驻图集即使无图片且无图片意图也必须适用", () => {
      const img = evaluateWidgetApplicability("image_gallery", "google", googleResult);
      assert.equal(img.applicable, true);
      assert.equal(img.status, "ready");
    });

    it("Token 消耗组件无指标且无度量意图，必须判定为不适用 (not_applicable)", () => {
      const token = evaluateWidgetApplicability("token_usage", "google", googleResult);
      assert.equal(token.applicable, false);
      assert.equal(token.status, "not_applicable");
      assert.equal(token.reason, "query_not_supported");
    });

    it("天气与翻译组件无对应意图，必须判定为不适用 (not_applicable)", () => {
      const weather = evaluateWidgetApplicability("weather", "google", googleResult);
      assert.equal(weather.applicable, false);
      assert.equal(weather.status, "not_applicable");

      const trans = evaluateWidgetApplicability("translation", "google", googleResult);
      assert.equal(trans.applicable, false);
      assert.equal(trans.status, "not_applicable");
    });
  });

  describe("图片检索场景", () => {
    it("当用户明确查询图片/壁纸时，图集组件适用", () => {
      const imgIntentResult = makeMockResult({
        query: "故宫雪景高清壁纸",
        relatedImages: []
      });
      const gate = evaluateWidgetApplicability("image_gallery", "故宫雪景高清壁纸", imgIntentResult);
      assert.equal(gate.applicable, true);
      assert.equal(gate.status, "ready");
    });

    it("当检索信源包含有效图片时，图集组件适用", () => {
      const withImagesResult = makeMockResult({
        query: "特斯拉 Cybertruck",
        relatedImages: [
          { url: "https://example.com/cybertruck.jpg", title: "Cybertruck" } as any
        ]
      });
      const gate = evaluateWidgetApplicability("image_gallery", "特斯拉 Cybertruck", withImagesResult);
      assert.equal(gate.applicable, true);
      assert.equal(gate.status, "ready");
    });
  });

  describe("Token 指标检索场景", () => {
    it("当用户明确询问 token 消耗时，token_usage 适用", () => {
      const tokenIntentResult = makeMockResult({
        query: "GPT-4o 单次推理 token 耗费与成本",
        tokenUsage: undefined
      });
      const gate = evaluateWidgetApplicability("token_usage", "GPT-4o 单次推理 token 耗费与成本", tokenIntentResult);
      assert.equal(gate.applicable, true);
      assert.equal(gate.status, "ready");
    });

    it("当上下文包含真实 tokenUsage 遥测时，token_usage 适用", () => {
      const withTokenDataResult = makeMockResult({
        query: "量子计算算法",
        tokenUsage: { promptTokens: 320, completionTokens: 140, totalTokens: 460 } as any
      });
      const gate = evaluateWidgetApplicability("token_usage", "量子计算算法", withTokenDataResult);
      assert.equal(gate.applicable, true);
      assert.equal(gate.status, "ready");
    });
  });

  describe("天气与翻译意图识别", () => {
    it("天气查询放行天气组件，拦截翻译组件", () => {
      const weatherResult = makeMockResult({ query: "杭州西湖下周天气预报" });
      assert.equal(evaluateWidgetApplicability("weather", "杭州西湖下周天气预报", weatherResult).applicable, true);
      assert.equal(evaluateWidgetApplicability("translation", "杭州西湖下周天气预报", weatherResult).applicable, false);
    });

    it("翻译查词查询放行翻译组件，拦截天气组件", () => {
      const transResult = makeMockResult({ query: "人工智能 英文怎么说 翻译" });
      assert.equal(evaluateWidgetApplicability("translation", "人工智能 英文怎么说 翻译", transResult).applicable, true);
      assert.equal(evaluateWidgetApplicability("weather", "人工智能 英文怎么说 翻译", transResult).applicable, false);
    });
  });

  describe("filterApplicableWidgets 与 selectAgentWidgets 联动", () => {
    it("Agent 规划包含常驻图集时，无图信号下仍保留并过滤其他不适用组件", () => {
      const googleResult = makeMockResult({
        query: "google",
        relatedImages: [],
        tokenUsage: undefined
      });

      const planned = ["ai_answer", "related_links", "image_gallery", "token_usage", "weather"] as const;
      const filtered = filterApplicableWidgets([...planned], "google", googleResult);

      assert.deepEqual(filtered, ["ai_answer", "related_links", "image_gallery"]);
    });

    it("selectAgentWidgets 结合适用性网关，保证输出清单皆为适用组件", () => {
      const googleResult = makeMockResult({
        query: "google",
        relatedImages: [],
        tokenUsage: undefined
      });

      const selected = selectAgentWidgets({
        intent: "balanced",
        signals: {
          summaryLength: 100,
          takeawayCount: 2,
          sourceCount: 1,
          comparisonRows: 0,
          mindMapBranches: 1,
          followUpCount: 0,
          hasOfficial: true,
          customCardCount: 0,
          imageCount: 0,
          imageIntent: false
        },
        plannedKeys: ["ai_answer", "related_links", "image_gallery", "token_usage"],
        query: "google",
        activeResult: googleResult
      });

      assert.ok(selected.includes("image_gallery"), "常驻图集即使没有图片信号也必须入选");
      assert.ok(!selected.includes("token_usage"), "不适用的 token_usage 不应入选");
      assert.ok(selected.includes("ai_answer"), "核心速答必须入选");
      assert.ok(selected.includes("related_links"), "权威入口必须入选");
    });
  });

  describe("运行时 resolveWidgetData 防御", () => {
    it("适配器返回 null 时，resolveWidgetData 转换为 not_applicable 状态而非报错", () => {
      const mockModule = {
        id: "test_widget",
        name: "测试组件",
        version: "1.0.0",
        width: 50 as const,
        data: () => null
      };

      const resolved = resolveWidgetData(mockModule, makeMockResult());
      assert.equal(resolved.status, "not_applicable");
      assert.ok(resolved.reason?.includes("null"));
    });

    it("适配器返回 structured not_applicable 时正确透传", () => {
      const mockModule = {
        id: "test_widget",
        name: "测试组件",
        version: "1.0.0",
        width: 50 as const,
        data: () => ({
          status: "not_applicable" as const,
          reason: "Query does not match"
        })
      };

      const resolved = resolveWidgetData(mockModule, makeMockResult());
      assert.equal(resolved.status, "not_applicable");
      assert.equal(resolved.reason, "Query does not match");
    });
  });
});
