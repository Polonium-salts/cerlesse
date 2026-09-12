import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { runAgentTeam } from "../../server/agentTeam.js";

function cleanParam(val?: any): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

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

    const { query, model, apiKey, customSearxngUrl, enableDeepSearch, targetLanguage } = body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const result = await runAgentTeam({
      query: query.trim(),
      model: cleanParam(model),
      openRouterApiKey: cleanParam(apiKey),
      customSearxngUrl: cleanParam(customSearxngUrl),
      targetLanguage: cleanParam(targetLanguage),
      enableDeepSearch: Boolean(enableDeepSearch),
      env: context.env
    });

    return jsonResponse(result);
  } catch (error: any) {
    console.error("Edge agent error:", error);
    return errorResponse(error.message || "执行 Agent 协作失败", 500);
  }
};
