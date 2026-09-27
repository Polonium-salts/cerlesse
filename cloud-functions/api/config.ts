import { PagesFunction, jsonResponse } from "./types.js";
import { getAiApiConfig, getProviderStatus, loadAvailableModels } from "../../server/aiProvider.js";
import { SUPPORTED_LANGUAGES } from "../../server/language.js";

export const onRequest: PagesFunction = async (context) => {
  const env = {
    ...(typeof process !== "undefined" ? process.env : {}),
    ...(context.env || {})
  } as Record<string, string | undefined>;

  const providerStatus = getProviderStatus(env);
  const aiApiConfig = getAiApiConfig(env);
  const models = loadAvailableModels(env);

  return jsonResponse({
    ...providerStatus,
    hasCustomSearxngUrl: Boolean(env.SEARXNG_URL || env.SEARXNG_URLS),
    defaultModel: aiApiConfig.model,
    models,
    supportedLanguages: SUPPORTED_LANGUAGES,
    platform: "Tencent Cloud EdgeOne"
  });
};

export default onRequest;
