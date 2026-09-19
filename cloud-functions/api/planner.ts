import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { planWidgetStrategy } from "../../server/widgetPlanner.js";

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

    const { query, results, targetLanguage, apiKey, model } = body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const widgetPlan = await planWidgetStrategy({
      query: query.trim(),
      results: Array.isArray(results) ? results : [],
      targetLanguage,
      apiKey,
      model,
      env: context.env
    });

    return jsonResponse(widgetPlan);
  } catch (error: any) {
    console.error("Edge widget planner error:", error);
    return errorResponse(error.message || "小组件规划服务异常", 500);
  }
};

export default onRequest;
