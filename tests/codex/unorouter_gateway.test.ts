import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveGateway,
  loadGatewayModels,
  GATEWAY_REGISTRY
} from "../../server/gateway.js";
import {
  resolveModelProvider,
  getAiApiConfig,
  resolveAiApiKey,
  getAiApiClient
} from "../../server/aiProvider.js";

const TEST_UNO_KEY = "sk-unorouter-test-12345678";
const TEST_OR_KEY = "sk-or-v1-abcdefgh12345678";

test("resolveGateway detects UnoRouter when UNOROUTER_API_KEY is present", () => {
  const result = resolveGateway({ UNOROUTER_API_KEY: TEST_UNO_KEY });
  assert.equal(result.provider, "unorouter");
  assert.equal(result.baseUrl, "https://api.unorouter.com/v1");
  assert.equal(result.apiKey, TEST_UNO_KEY);
  assert.equal(result.defaultModel, "deepseek/deepseek-v4-flash");
});

test("resolveGateway falls back to OpenRouter when UNOROUTER_API_KEY is absent but OPENROUTER_API_KEY is set", () => {
  const result = resolveGateway({ OPENROUTER_API_KEY: TEST_OR_KEY });
  assert.equal(result.provider, "openrouter");
  assert.equal(result.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(result.apiKey, TEST_OR_KEY);
});

test("resolveGateway respects MODEL_GATEWAY explicit preference", () => {
  const preferOR = resolveGateway({
    UNOROUTER_API_KEY: TEST_UNO_KEY,
    OPENROUTER_API_KEY: TEST_OR_KEY,
    MODEL_GATEWAY: "openrouter"
  });
  assert.equal(preferOR.provider, "openrouter");
  assert.equal(preferOR.apiKey, TEST_OR_KEY);

  const preferUno = resolveGateway({
    UNOROUTER_API_KEY: TEST_UNO_KEY,
    OPENROUTER_API_KEY: TEST_OR_KEY,
    MODEL_GATEWAY: "unorouter"
  });
  assert.equal(preferUno.provider, "unorouter");
  assert.equal(preferUno.apiKey, TEST_UNO_KEY);
});

test("resolveGateway returns none when disabled", () => {
  const disabled1 = resolveGateway({
    UNOROUTER_API_KEY: TEST_UNO_KEY,
    AI_API_DISABLED: "true"
  });
  assert.equal(disabled1.provider, "none");

  const disabled2 = resolveGateway({
    UNOROUTER_API_KEY: TEST_UNO_KEY,
    GATEWAY_DISABLED: "true"
  });
  assert.equal(disabled2.provider, "none");
});

test("resolveModelProvider returns full status for UnoRouter", async () => {
  const status = resolveModelProvider({ UNOROUTER_API_KEY: TEST_UNO_KEY });
  assert.equal(status.provider, "unorouter");
  assert.equal(status.ready, true);
  assert.equal(status.hasUnoRouterKey, true);
  assert.equal(status.defaultModel, "deepseek/deepseek-v4-flash");
  assert.ok(status.models.some((m) => m.id === "deepseek/deepseek-v4-flash"));

  const config = getAiApiConfig({ UNOROUTER_API_KEY: TEST_UNO_KEY });
  assert.equal(config.apiBaseUrl, "https://api.unorouter.com");
  assert.equal(config.model, "deepseek/deepseek-v4-flash");
  assert.equal(config.hasApiKey, true);

  const client = getAiApiClient({ UNOROUTER_API_KEY: TEST_UNO_KEY });
  assert.equal(client.provider.apiKey, TEST_UNO_KEY);
});
