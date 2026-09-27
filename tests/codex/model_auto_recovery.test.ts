import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeModelForBaseUrl } from "../../server/aiProvider.js";

describe("Model Sanitization & Auto Fallback", () => {
  it("should sanitize unsupported free model names when calling DeepSeek endpoints", () => {
    const raw = "nemotron-3-ultra-550b-a55b:free";
    const sanitized = sanitizeModelForBaseUrl(raw, "https://api.deepseek.com/v1");
    assert.strictEqual(sanitized, "deepseek-flash");
  });

  it("should keep valid deepseek model names intact", () => {
    const raw = "deepseek-v4-pro";
    const sanitized = sanitizeModelForBaseUrl(raw, "https://api.deepseek.com/v1");
    assert.strictEqual(sanitized, "deepseek-v4-pro");
  });

  it("should sanitize openrouter-specific paths when calling OpenAI endpoint", () => {
    const raw = "deepseek/deepseek-chat:free";
    const sanitized = sanitizeModelForBaseUrl(raw, "https://api.openai.com/v1");
    assert.strictEqual(sanitized, "gpt-4o-mini");
  });
});
