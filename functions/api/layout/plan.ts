import { PagesFunction, jsonResponse, errorResponse } from "../types.js";
import { planWidgetLayout } from "../../../server/layoutAgent.js";

/**
 * EdgeOne Pages Function: 小组件排版 Agent (Widget Layout Agent)
 * 路由：/api/layout/plan
 * - GET  /api/layout/plan?q=关键词          快速探查
 * - POST /api/layout/plan  { query, results?, widgetPlan?, targetLanguage?, apiKey?, model?, signals? }
 */
export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  try {
    // GET 快速探查
    if (context.request.method === "GET") {
      const url = new URL(context.request.url);
      const q = url.searchParams.get("q");
      if (!q || q.trim() === "") {
        return errorResponse("缺少搜索关键词", 400);
      }
      const result = await planWidgetLayout({
        query: q.trim(),
        results: [],
        targetLanguage: url.searchParams.get("lang") || undefined,
        apiKey: url.searchParams.get("apiKey") || undefined,
        model: url.searchParams.get("model") || undefined,
        env: context.env
      });
      return jsonResponse(result);
    }

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return errorResponse("无效的 JSON 请求体", 400);
    }

    const { query, results, widgetPlan, targetLanguage, apiKey, model, signals } = body || {};
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const result = await planWidgetLayout({
      query: query.trim(),
      results: Array.isArray(results) ? results : [],
      widgetPlan: widgetPlan && typeof widgetPlan === "object" ? widgetPlan : undefined,
      targetLanguage,
      apiKey,
      model,
      signals: signals && typeof signals === "object" ? signals : undefined,
      env: context.env
    });

    return jsonResponse(result);
  } catch (error: any) {
    console.error("Edge widget layout agent error:", error);
    return errorResponse(error.message || "小组件排版服务异常", 500);
  }
};
