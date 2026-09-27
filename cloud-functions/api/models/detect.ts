import { PagesFunction, jsonResponse, errorResponse } from "../types.js";
import { detectAndFetchModels } from "../../../server/aiProvider.js";

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
    if (context.request.method === "POST" || context.request.method === "PUT") {
      try {
        body = await context.request.json();
      } catch {
        body = {};
      }
    }

    const url = new URL(context.request.url);
    const reqHeaders = context.request.headers;

    const apiKey =
      cleanParam(reqHeaders.get("x-custom-api-key")) ||
      cleanParam(reqHeaders.get("authorization")?.replace(/^Bearer\s+/i, "")) ||
      cleanParam(body?.apiKey) ||
      cleanParam(url.searchParams.get("apiKey"));

    const apiBaseUrl =
      cleanParam(reqHeaders.get("x-custom-base-url")) ||
      cleanParam(body?.apiBaseUrl) ||
      cleanParam(url.searchParams.get("apiBaseUrl"));

    const provider =
      cleanParam(reqHeaders.get("x-custom-provider")) ||
      cleanParam(body?.provider) ||
      cleanParam(url.searchParams.get("provider"));

    const env = {
      ...(typeof process !== "undefined" ? process.env : {}),
      ...(context.env || {})
    } as Record<string, string | undefined>;

    const result = await detectAndFetchModels({
      apiKey,
      apiBaseUrl,
      provider,
      env
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "自动检测模型提供商失败",
      500
    );
  }
};

export default onRequest;
