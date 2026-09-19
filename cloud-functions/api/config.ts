import { PagesFunction, jsonResponse } from "./types.js";
import { AVAILABLE_FREE_MODELS, resolveOpenRouterApiKey } from "../../server/openrouter.js";
import { SUPPORTED_LANGUAGES } from "../../server/language.js";

export const onRequest: PagesFunction = async (context) => {
  const env = context.env || (typeof process !== "undefined" ? process.env : {});
  const openRouterKey = resolveOpenRouterApiKey(undefined, env);
  const searxngUrl = env?.SEARXNG_URL || env?.SEARX_URL;
  const geminiKey = env?.GEMINI_API_KEY;

  return jsonResponse({
    hasOpenRouterKey: Boolean(openRouterKey && openRouterKey.trim() !== ""),
    hasSearxngUrl: Boolean(searxngUrl && searxngUrl.trim() !== ""),
    hasGeminiKey: Boolean(geminiKey && geminiKey.trim() !== "" && geminiKey !== "MY_GEMINI_API_KEY"),
    defaultModel: "openrouter/free",
    models: AVAILABLE_FREE_MODELS,
    supportedLanguages: SUPPORTED_LANGUAGES,
    platform: "Tencent Cloud EdgeOne"
  });
};

export default onRequest;
