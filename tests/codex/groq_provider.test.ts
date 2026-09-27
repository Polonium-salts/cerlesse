import test from "node:test";
import assert from "node:assert/strict";
import { getAiApiConfig, loadAvailableModels } from "../../server/aiProvider.js";

test("configured OpenAI-compatible model metadata is exposed without secrets", () => {
  const env = {
    AI_API_KEY: "sk-test-not-for-response",
    AI_API_BASE_URL: "https://gateway.example/v1",
    AI_MODEL: "vendor/model-tools"
  };
  assert.deepEqual(getAiApiConfig(env), {
    apiBaseUrl: "https://gateway.example",
    model: "vendor/model-tools",
    hasApiKey: true,
    isDisabled: false
  });
  const models = loadAvailableModels(env);
  assert.equal(models[0].id, "vendor/model-tools");
  assert.equal(JSON.stringify(models).includes(env.AI_API_KEY), false);
});
