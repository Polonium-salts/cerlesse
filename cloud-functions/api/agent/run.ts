import { PagesFunction, jsonResponse, errorResponse } from "../types.js";
import { runCodexAgent } from "../../../server/codex/index.js";
import { respondAgentError } from "../../../server/aiProvider.js";

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

    const { query, model, customSearxngUrl, apiKey: bodyApiKey, apiBaseUrl: bodyApiBaseUrl } = body || {};
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const reqHeaders = context.request.headers;
    const apiKey =
      cleanParam(reqHeaders.get("x-custom-api-key")) ||
      cleanParam(reqHeaders.get("authorization")?.replace(/^Bearer\s+/i, "")) ||
      cleanParam(bodyApiKey);

    const apiBaseUrl =
      cleanParam(reqHeaders.get("x-custom-base-url")) ||
      cleanParam(bodyApiBaseUrl);

    const effectiveEnv = {
      ...(typeof process !== "undefined" ? process.env : {}),
      ...(context.env || {})
    } as Record<string, string | undefined>;

    const result = await runCodexAgent(query.trim(), {
      model: cleanParam(model),
      customSearxngUrl: cleanParam(customSearxngUrl),
      apiKey,
      apiBaseUrl,
      env: effectiveEnv
    });

    return jsonResponse(result.legacySynthesis);
  } catch (error) {
    const { status, message } = respondAgentError(error);
    return errorResponse(message, status);
  }
};

