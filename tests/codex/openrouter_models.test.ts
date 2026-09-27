import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AI_MODEL, loadAvailableModels } from "../../server/aiProvider.js";

test("configured model is returned as safe static metadata without a provider request", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("model listing must not make a provider request");
  }) as typeof fetch;

  try {
    assert.deepEqual(loadAvailableModels({}), [{
      id: DEFAULT_AI_MODEL,
      name: DEFAULT_AI_MODEL,
      description: "由 AI_MODEL 配置的 OpenAI-compatible 模型",
      contextLength: "未知",
      pricing: "Unknown",
      isRecommended: true
    }]);
    assert.deepEqual(loadAvailableModels({ AI_API_DISABLED: "true" }), []);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
