import {
  PagesFunction,
  jsonResponse,
  errorResponse,
  cleanParam,
  extractAuthHeaders,
  getEffectiveEnv
} from "./types.js";
import { executeAgentRun } from "../../server/services/agentService.js";
import { respondAgentError } from "../../server/aiProvider.js";

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

    const { apiKey, apiBaseUrl } = extractAuthHeaders(context.request);
    const effectiveApiKey = cleanParam(body?.apiKey) || apiKey;
    const effectiveApiBaseUrl = cleanParam(body?.apiBaseUrl) || apiBaseUrl;
    const env = getEffectiveEnv(context.env);

    const result = await executeAgentRun({
      query: query.trim(),
      model: cleanParam(model),
      customSearxngUrl: cleanParam(customSearxngUrl),
      apiKey: effectiveApiKey,
      apiBaseUrl: effectiveApiBaseUrl,
      env
    });

    return jsonResponse(result.legacySynthesis);
  } catch (error) {
    const { status, message } = respondAgentError(error);
    return errorResponse(message, status);
  }
};
