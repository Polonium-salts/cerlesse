import {
  getAiApiConfig,
  resolveModelProvider,
  loadAvailableModels,
  detectAndFetchModels
} from "../aiProvider.js";
import { SUPPORTED_LANGUAGES } from "../language.js";

export async function getSystemConfig(env?: Record<string, string | undefined>) {
  const effectiveEnv = env || (typeof process !== "undefined" ? process.env : {});
  const status = resolveModelProvider(effectiveEnv);
  const aiApiConfig = getAiApiConfig(effectiveEnv);

  let models = status.models;
  if (status.provider === "unorouter" || status.hasApiKey) {
    try {
      const detected = await detectAndFetchModels({ env: effectiveEnv, provider: status.provider });
      if (detected.models && detected.models.length > 0) {
        models = detected.models;
      }
    } catch {
      // ignore
    }
  }

  if (!models || models.length === 0) {
    models = loadAvailableModels(effectiveEnv);
  }

  return {
    ...status,
    hasCustomSearxngUrl: Boolean(effectiveEnv.SEARXNG_URL && effectiveEnv.SEARXNG_URL.trim()),
    defaultModel: status.defaultModel || aiApiConfig.model,
    models,
    supportedLanguages: SUPPORTED_LANGUAGES
  };
}

export async function detectModels(params: {
  apiKey?: string;
  apiBaseUrl?: string;
  provider?: string;
  env?: Record<string, string | undefined>;
}) {
  const effectiveEnv = params.env || (typeof process !== "undefined" ? process.env : {});
  return detectAndFetchModels({
    apiKey: params.apiKey,
    apiBaseUrl: params.apiBaseUrl,
    provider: params.provider,
    env: effectiveEnv
  });
}
