import { PagesFunction, jsonResponse } from "./types.js";
import { onRequest as handleDetect } from "./models/detect.js";
import { resolveModelProvider, loadAvailableModels } from "../../server/aiProvider.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  // If query params or headers for detect are present, delegate to detect handler
  const url = new URL(context.request.url);
  const hasKey = Boolean(
    context.request.headers.get("x-custom-api-key") ||
    url.searchParams.get("apiKey") ||
    context.request.method === "POST"
  );

  if (hasKey) {
    return handleDetect(context);
  }

  const env = {
    ...(typeof process !== "undefined" ? process.env : {}),
    ...(context.env || {})
  } as Record<string, string | undefined>;

  const status = resolveModelProvider(env);
  const models = status.models && status.models.length > 0 ? status.models : loadAvailableModels(env);

  return jsonResponse({
    models,
    provider: status.provider,
    defaultModel: status.defaultModel
  });
};

