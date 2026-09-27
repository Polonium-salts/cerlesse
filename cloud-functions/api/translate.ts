import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { translateText } from "../../server/translationAgent.js";
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

    const { text, sourceLang, targetLang, model } = body || {};
    if (typeof text !== "string" || !text.trim()) {
      return errorResponse("缺少待翻译文本", 400);
    }

    const result = await translateText({
      text: text.trim(),
      sourceLang: cleanParam(sourceLang),
      targetLang: cleanParam(targetLang),
      model: cleanParam(model),
      env: context.env
    });

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof LlmProviderError) {
      console.warn("Edge translation provider error:", error.message);
      return errorResponse(error.message, error.status || 502);
    }
    console.error("Edge translation error:", error);
    return errorResponse(error instanceof Error ? error.message : "翻译请求处理失败", 500);
  }
};

