import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { composeWidgetsForTask } from "../../server/widgetComposer.js";
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

    const { query, results, intentAnalysis: incomingIntent, targetLanguage } = body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const validResults = Array.isArray(results) ? results : [];

    // 若未预先提供 intentAnalysis，则在边缘自动执行语义分析
    const intentAnalysis = incomingIntent || await analyzeWidgetIntent({
      query: query.trim(),
      results: validResults,
      targetLanguage,
      env: context.env
    });

    const blueprint = composeWidgetsForTask({
      query: query.trim(),
      results: validResults,
      intentAnalysis,
      targetLanguage
    });

    return jsonResponse(blueprint);
  } catch (error: any) {
    console.error("Edge widget composer error:", error);
    return errorResponse(error.message || "小组件组合装配服务异常", 500);
  }
};
