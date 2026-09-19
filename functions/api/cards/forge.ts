import { PagesFunction, jsonResponse, errorResponse } from "../types.js";
import { forgeUniqueCard } from "../../../server/cardForge.js";

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

    const { query, results, archetype, userPrompt, themeColor, colSpan, iconName, apiKey } = body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const card = await forgeUniqueCard({
      query: query.trim(),
      results: Array.isArray(results) ? results : [],
      archetype,
      userPrompt,
      themeColor,
      colSpan: typeof colSpan === "number" ? colSpan : 6,
      iconName,
      apiKey,
      env: context.env
    });

    return jsonResponse({ card });
  } catch (error: any) {
    console.error("Edge card forge error:", error);
    return errorResponse(error.message || "创建独有卡片失败", 500);
  }
};
