import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AI_API_BASE_URL,
  DEFAULT_AI_MODEL,
  getAiApiClient,
  getAiApiConfig,
  getProviderStatus,
  isAiApiDisabled,
  LlmProviderError,
  resolveAiApiKey
} from "../../server/aiProvider.js";

const VALID_KEY = "sk-test-abcdef123456";

test("OpenAI-compatible API reads endpoint, model, and credentials from server environment", () => {
  assert.equal(resolveAiApiKey({ AI_API_KEY: VALID_KEY }), VALID_KEY);
  assert.equal(resolveAiApiKey({ AI_API_KEY: "your_api_key_here" }), undefined);
  assert.equal(resolveAiApiKey({}), undefined);

  assert.deepEqual(getAiApiConfig({ AI_API_KEY: VALID_KEY }), {
    apiBaseUrl: "https://api.openai.com",
    model: DEFAULT_AI_MODEL,
    hasApiKey: true,
    isDisabled: false
  });
  assert.deepEqual(getAiApiConfig({
    AI_API_KEY: VALID_KEY,
    AI_API_BASE_URL: "https://gateway.example/v1/chat/completions/",
    AI_MODEL: "vendor/model-tool-use"
  }), {
    apiBaseUrl: "https://gateway.example",
    model: "vendor/model-tool-use",
    hasApiKey: true,
    isDisabled: false
  });
  assert.equal(getAiApiConfig({}).apiBaseUrl, DEFAULT_AI_API_BASE_URL);
});

test("legacy OpenRouter variables remain compatible while new AI_API_* settings take precedence", () => {
  const legacy = getAiApiConfig({ OPENROUTER_API_KEY: VALID_KEY });
  assert.equal(legacy.hasApiKey, true);
  assert.equal(legacy.apiBaseUrl, "https://openrouter.ai/api");
  assert.equal(legacy.model, "openrouter/free");

  const overridden = getAiApiConfig({
    OPENROUTER_API_KEY: VALID_KEY,
    AI_API_BASE_URL: "https://compatible.example/v1",
    AI_MODEL: "custom-tool-model"
  });
  assert.equal(overridden.apiBaseUrl, "https://compatible.example");
  assert.equal(overridden.model, "custom-tool-model");
});

test("AI_API_DISABLED=true fails closed and is reported by the status helper", () => {
  assert.equal(isAiApiDisabled({ AI_API_DISABLED: "true" }), true);
  assert.equal(isAiApiDisabled({ AI_API_DISABLED: " TRUE " }), true);
  assert.equal(isAiApiDisabled({ AI_API_DISABLED: "false" }), false);
  assert.equal(isAiApiDisabled({ OPENROUTER_DISABLED: "true" }), true);
  assert.equal(resolveAiApiKey({ AI_API_KEY: VALID_KEY, AI_API_DISABLED: "true" }), undefined);
  assert.deepEqual(getProviderStatus({ AI_API_KEY: VALID_KEY }), {
    hasApiKey: true,
    isAiApiDisabled: false
  });
  assert.deepEqual(getProviderStatus({ AI_API_DISABLED: "true" }), {
    hasApiKey: false,
    isAiApiDisabled: true
  });
});

test("client construction uses the configured OpenAI-compatible base URL and fails closed without network calls", () => {
  const client = getAiApiClient({
    AI_API_KEY: VALID_KEY,
    AI_API_BASE_URL: "https://gateway.example/v1",
    AI_MODEL: "tool-model"
  });
  assert.equal(client.provider.name, "openai");
  assert.equal(client.provider.baseUrl, "https://gateway.example");
  assert.equal(client.provider.apiKey, VALID_KEY);

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("AI provider network call must not be made");
  }) as typeof fetch;

  try {
    assert.throws(
      () => getAiApiClient({ AI_API_KEY: VALID_KEY, AI_API_DISABLED: "true" }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "provider_disabled" && error.status === 503
    );
    assert.throws(
      () => getAiApiClient({}),
      (error: unknown) => error instanceof LlmProviderError && error.code === "missing_api_key" && error.status === 503
    );
    assert.throws(
      () => getAiApiClient({ AI_API_KEY: VALID_KEY, AI_API_BASE_URL: "not a url" }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "invalid_base_url" && error.status === 500
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
