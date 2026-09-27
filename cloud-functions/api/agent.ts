import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { runCodexAgent } from "../../server/codex/index.js";
import { LlmProviderError } from "../../server/aiProvider.js";

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

    const { query, model, customSearxngUrl } = body || {};
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const result = await runCodexAgent(query.trim(), {
      model: cleanParam(model),
      customSearxngUrl: cleanParam(customSearxngUrl),
      env: context.env
    });

    return jsonResponse(result.legacySynthesis);
  } catch (error) {
    if (error instanceof LlmProviderError) {
      console.warn("Edge agent provider error:", error.message);
      return errorResponse(error.message, error.status || 502);
    }
    console.error("Edge agent error:", error);
    return errorResponse(error instanceof Error ? error.message : "执行 Codex Agent 失败", 500);
  }
};

