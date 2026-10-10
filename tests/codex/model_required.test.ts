import test from "node:test";
import assert from "node:assert/strict";
import { APIError } from "@aktagon/llmkit-ts";
import { LlmProviderError, toLlmProviderError } from "../../server/aiProvider.js";
import { runCodexAgent } from "../../server/codex/appServerClient.js";

const VALID_KEY = "sk-test-abcdef123456";

test("Agent fails closed without server-side credentials and never touches fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("AI network call must not be made");
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(
      runCodexAgent("regression check", { env: {} }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "missing_api_key" && error.status === 503
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an explicitly disabled provider stops the Agent before any request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("AI network call must not be made");
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(
      runCodexAgent("regression check", {
        env: { AI_API_KEY: VALID_KEY, AI_API_DISABLED: "true" }
      }),
      (error: unknown) => error instanceof LlmProviderError && error.code === "provider_disabled" && error.status === 503
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider failures map to stable error codes and HTTP statuses", () => {
  const cases = [
    [401, "invalid_api_key", 401],
    [403, "access_denied", 403],
    [429, "rate_limited", 429],
    [500, "provider_error", 502]
  ] as const;

  for (const [status, code, httpStatus] of cases) {
    const mapped = toLlmProviderError(new APIError(status, "upstream failure", false));
    assert.equal(mapped.code, code);
    assert.equal(mapped.status, httpStatus);
  }

  // HTTP 400 with upstream JSON containing API Key not found
  const rawJsonError = '{"error":{"message":"API Key not found. Please pass a valid API key. (request id: 123)","type":"bad_response_status_code","param":"","code":"bad_response_status_code"}}';
  const mapped400 = toLlmProviderError(new APIError(400, rawJsonError, false));
  assert.equal(mapped400.code, "invalid_api_key");
  assert.equal(mapped400.status, 401);
  assert.ok(mapped400.message.includes("API Key not found. Please pass a valid API key"));
  assert.ok(!mapped400.message.includes('{"error"'));

  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(toLlmProviderError(abort).code, "provider_timeout");
  assert.equal(toLlmProviderError(abort).status, 504);

  const alreadyMapped = new LlmProviderError("已禁用", "provider_disabled", 503);
  assert.equal(toLlmProviderError(alreadyMapped), alreadyMapped);
});
