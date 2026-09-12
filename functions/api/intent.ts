import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { analyzeWidgetIntent } from "../../server/widgetIntentAnalyzer.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  try {
    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return errorResponse("无效的 JSON 请求体", 400);
    }

    const { query, results, targetLanguage } = body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const intentAnalysis = await analyzeWidgetIntent({
      query: query.trim(),
      results: Array.isArray(results) ? results : [],
      targetLanguage,
      env: context.env
    });

    return jsonResponse({
      intent: intentAnalysis.intent,
      intents: intentAnalysis.intents,
      entity: intentAnalysis.entity,
      goal: intentAnalysis.goal,
      needs: intentAnalysis.needs,
      requiredCapabilities: intentAnalysis.requiredCapabilities,
      suggestedLayout: intentAnalysis.suggestedLayout,
      confidence: intentAnalysis.confidence
    });
  } catch (error: any) {
    console.error("Edge intent analysis error:", error);
    return errorResponse(error.message || "意图分析服务异常", 500);
  }
};
