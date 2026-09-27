import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeModelForBaseUrl } from "../../server/aiProvider.js";

describe("Model Sanitization & Auto Fallback", () => {
  it("should keep valid UnoRouter model names intact", () => {
    const raw = "deepseek/deepseek-v4-flash";
    const sanitized = sanitizeModelForBaseUrl(raw, "https://api.unorouter.com/v1");
    assert.strictEqual(sanitized, "deepseek/deepseek-v4-flash");
  });

  it("should sanitize provider-specific paths when calling OpenAI endpoint", () => {
    const raw = "deepseek/deepseek-chat";
    const sanitized = sanitizeModelForBaseUrl(raw, "https://api.openai.com/v1");
    assert.strictEqual(sanitized, "gpt-4o-mini");
  });
});
