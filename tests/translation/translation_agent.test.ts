import test from "node:test";
import assert from "node:assert/strict";
import { translateText } from "../../server/translationAgent.js";
import { LlmProviderError } from "../../server/aiProvider.js";

const VALID_KEY = "sk-test-abcdef123456";

function chatResponse(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

test("translateText maps the structured payload and preserves the endpoint shape", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let requestedUrl = "";
  let requestedBody: any = null;
  let authorizationHeader = "";

  globalThis.fetch = (async (input, init) => {
    calls++;
    requestedUrl = String(input);
    requestedBody = JSON.parse(String(init?.body));
    authorizationHeader = new Headers(init?.headers).get("Authorization") || "";
    return chatResponse(JSON.stringify({
      text: "苹果",
      detectedSourceLang: "en",
      phonetic: "/ˈæp.əl/",
      pronunciation: "AE-pul",
      partOfSpeech: "n.",
      definitions: ["苹果", "苹果树"],
      examples: [{ source: "an apple", target: "一个苹果" }],
      synonyms: ["fruit"],
      grammarNotes: "可数名词"
    }));
  }) as typeof fetch;

  try {
    const result = await translateText({
      text: "apple",
      sourceLang: "en",
      targetLang: "zh",
      model: "deepseek/deepseek-chat",
      env: { AI_API_KEY: VALID_KEY, AI_API_BASE_URL: "https://api.unorouter.com/v1" }
    });

    assert.equal(calls, 1);
    assert.equal(requestedUrl, "https://api.unorouter.com/v1/chat/completions");
    assert.equal(authorizationHeader, `Bearer ${VALID_KEY}`);
    assert.equal(requestedBody.model, "deepseek/deepseek-chat");
    assert.ok(Array.isArray(requestedBody.messages));

    assert.equal(result.text, "苹果");
    assert.equal(result.sourceLang, "en");
    assert.equal(result.targetLang, "zh");
    assert.equal(result.phonetic, "/ˈæp.əl/");
    assert.equal(result.pronunciation, "AE-pul");
    assert.equal(result.partOfSpeech, "n.");
    assert.deepEqual(result.definitions, ["苹果", "苹果树"]);
    assert.deepEqual(result.examples, [{ source: "an apple", target: "一个苹果" }]);
    assert.deepEqual(result.synonyms, ["fruit"]);
    assert.equal(result.grammarNotes, "可数名词");
    assert.equal(result.cached, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("repeated lookups are served from the cache without a second provider call", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return chatResponse(JSON.stringify({
      text: "世界",
      detectedSourceLang: "en",
      definitions: ["世界"],
      examples: [],
      synonyms: []
    }));
  }) as unknown as typeof fetch;

  try {
    const first = await translateText({ text: "world", sourceLang: "en", targetLang: "zh", env: { AI_API_KEY: VALID_KEY } });
    const second = await translateText({ text: "world", sourceLang: "en", targetLang: "zh", env: { AI_API_KEY: VALID_KEY } });

    assert.equal(calls, 1);
    assert.equal(second.cached, true);
    assert.deepEqual(second.definitions, first.definitions);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid model output and provider failures surface as LlmProviderError", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () => chatResponse("这不是 JSON")) as unknown as typeof fetch;
    await assert.rejects(
      translateText({ text: "broken payload", sourceLang: "en", targetLang: "zh", env: { AI_API_KEY: VALID_KEY } }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "invalid_response" && error.status === 502
    );

    globalThis.fetch = (async () => new Response("Unauthorized", { status: 401 })) as unknown as typeof fetch;
    await assert.rejects(
      translateText({ text: "unauthorized", sourceLang: "en", targetLang: "zh", env: { AI_API_KEY: VALID_KEY } }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "invalid_api_key" && error.status === 401
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("translation fails closed before fetch when the provider is disabled or unconfigured", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("AI provider network call must not be made");
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(
      translateText({ text: "disabled", env: { AI_API_KEY: VALID_KEY, AI_API_DISABLED: "true" } }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "provider_disabled" && error.status === 503
    );
    await assert.rejects(
      translateText({ text: "unconfigured", env: {} }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "missing_api_key" && error.status === 503
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
