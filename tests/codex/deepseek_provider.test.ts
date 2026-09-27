import test from "node:test";
import assert from "node:assert/strict";
import {
  isDeepSeekEnabled,
  resolveDeepSeekApiKey,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODELS
} from "../../server/deepseek.js";
import {
  getAiApiConfig,
  getAiApiClient,
  resolveModelProvider,
  loadAvailableModels,
  getProviderStatus,
  pingModel
} from "../../server/aiProvider.js";

const VALID_DEEPSEEK_KEY = "sk-0123456789abcdef0123456789abcdef";

test("DeepSeek key resolution and enablement checks", () => {
  assert.equal(resolveDeepSeekApiKey({ DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY }), VALID_DEEPSEEK_KEY);
  assert.equal(isDeepSeekEnabled({ DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY }), true);

  assert.equal(resolveDeepSeekApiKey({ DEEPSEEK_API_KEY: "your_api_key_here" }), undefined);
  assert.equal(isDeepSeekEnabled({ DEEPSEEK_API_KEY: "your_api_key_here" }), false);

  assert.equal(resolveDeepSeekApiKey({}), undefined);
  assert.equal(isDeepSeekEnabled({}), false);
});

test("DeepSeek defaults to api.deepseek.com and deepseek-v4-flash", () => {
  const config = getAiApiConfig({ DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY });
  assert.equal(config.hasApiKey, true);
  assert.equal(config.apiBaseUrl, "https://api.deepseek.com");
  assert.equal(config.model, "deepseek-v4-flash");
  assert.equal(config.isDisabled, false);

  const customModelConfig = getAiApiConfig({
    DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY,
    AI_MODEL: "deepseek-v4-pro"
  });
  assert.equal(customModelConfig.model, "deepseek-v4-pro");
  assert.equal(customModelConfig.apiBaseUrl, "https://api.deepseek.com");
});

test("client construction builds OpenAI-compatible client targeting DeepSeek official endpoint", () => {
  const client = getAiApiClient({ DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY });
  assert.equal(client.provider.name, "openai");
  assert.equal(client.provider.baseUrl, "https://api.deepseek.com");
  assert.equal(client.provider.apiKey, VALID_DEEPSEEK_KEY);
});

test("resolveModelProvider reports deepseek provider, ready status, and official models", () => {
  const status = resolveModelProvider({ DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY });
  assert.equal(status.ready, true);
  assert.equal(status.provider, "deepseek");
  assert.equal(status.hasApiKey, true);
  assert.equal(status.hasDeepSeekKey, true);
  assert.equal(status.defaultModel, "deepseek-v4-flash");

  assert.ok(status.models.some((m) => m.id === "deepseek-v4-flash"));
  assert.ok(status.models.some((m) => m.id === "deepseek-v4-pro"));
  const flashModel = status.models.find((m) => m.id === "deepseek-v4-flash");
  assert.equal(flashModel?.contextLength, "1,000k");
  assert.equal(flashModel?.isRecommended, true);
});

test("loadAvailableModels returns DeepSeek catalog when DEEPSEEK_API_KEY is present", () => {
  const models = loadAvailableModels({ DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY });
  assert.equal(models.length, 2);
  assert.equal(models[0].id, "deepseek-v4-flash");
  assert.equal(models[1].id, "deepseek-v4-pro");
});

test("resolveModelProvider reports hasDeepSeekKey accurately", () => {
  const status = resolveModelProvider({ DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY });
  assert.equal(status.hasDeepSeekKey, true);
  assert.equal(status.hasApiKey, true);
  assert.equal(status.isAiApiDisabled, false);

  const disabledStatus = resolveModelProvider({
    DEEPSEEK_API_KEY: VALID_DEEPSEEK_KEY,
    AI_API_DISABLED: "true"
  });
  assert.equal(disabledStatus.isAiApiDisabled, true);
  assert.equal(disabledStatus.ready, false);
});
