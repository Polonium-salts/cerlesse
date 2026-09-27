import { describe, it } from "node:test";
import assert from "node:assert";
import { detectAndFetchModels } from "../../server/aiProvider.js";

describe("Model Auto Detection & Loading", () => {
  it("should detect DeepSeek provider from key/url and load preset models", async () => {
    const result = await detectAndFetchModels({
      apiKey: "sk-1234567890abcdef12345678",
      apiBaseUrl: "https://api.deepseek.com/v1"
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, "deepseek");
    assert.ok(result.models.length > 0);
    assert.ok(result.models.some((m) => m.id.includes("deepseek")));
  });

  it("should detect UnoRouter provider and load its model catalog", async () => {
    const result = await detectAndFetchModels({
      apiKey: "unorouter-test-key-123456",
      apiBaseUrl: "https://api.unorouter.com/v1"
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, "unorouter");
    assert.ok(result.models.length > 0);
  });

  it("should detect OpenRouter provider from sk-or- prefix", async () => {
    const result = await detectAndFetchModels({
      apiKey: "sk-or-v1-abcdef12345678901234567890"
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, "openrouter");
    assert.ok(result.models.length > 0);
  });
});
