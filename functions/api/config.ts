import { PagesFunction, jsonResponse } from "./types.js";
import { AVAILABLE_FREE_MODELS, resolveOpenRouterApiKey } from "../../server/openrouter.js";
import { SUPPORTED_LANGUAGES } from "../../server/language.js";

export const onRequest: PagesFunction = async (context) => {
  const env = context.env || {};
  const hasOpenRouterKey = Boolean(resolveOpenRouterApiKey(undefined, env));
  const customSearxngUrl = env.SEARXNG_URL || (typeof process !== "undefined" ? process.env?.SEARXNG_URL : undefined);

  return jsonResponse({
    hasGeminiKey: false,
    hasOpenRouterKey,
    hasCustomSearxngUrl: Boolean(customSearxngUrl && customSearxngUrl.trim() !== ""),
    defaultModel: "openrouter/free",
    models: AVAILABLE_FREE_MODELS,
    supportedLanguages: SUPPORTED_LANGUAGES,
    platform: "tencent-edgeone"
  });
};
