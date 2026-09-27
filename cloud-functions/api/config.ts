import { PagesFunction, jsonResponse } from "./types.js";
import { getAiApiConfig, resolveModelProvider, loadAvailableModels } from "../../server/aiProvider.js";
import { SUPPORTED_LANGUAGES } from "../../server/language.js";

export const onRequest: PagesFunction = async (context) => {
  const env = {
    ...(typeof process !== "undefined" ? process.env : {}),
    ...(context.env || {})
  } as Record<string, string | undefined>;

  const status = resolveModelProvider(env);
  const aiApiConfig = getAiApiConfig(env);
  const models = status.models && status.models.length > 0 ? status.models : loadAvailableModels(env);

  return jsonResponse({
    ...status,
    hasCustomSearxngUrl: Boolean(env.SEARXNG_URL || env.SEARXNG_URLS),
    defaultModel: status.defaultModel || aiApiConfig.model,
    models,
    supportedLanguages: SUPPORTED_LANGUAGES,
    platform: "Tencent Cloud EdgeOne"
  });
};

