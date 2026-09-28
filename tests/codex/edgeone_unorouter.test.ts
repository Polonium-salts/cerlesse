import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { onRequest as handleConfig } from "../../cloud-functions/api/config.js";
import { onRequest as handleDetect } from "../../cloud-functions/api/models/detect.js";
import { ModelProviderStatusSchema } from "../../src/contracts/index.js";

const TEST_UNO_KEY = "sk-unorouter-test-12345678";

describe("EdgeOne Cloud Functions UnoRouter Integration", () => {
  it("EdgeOne /api/config correctly returns UnoRouter models and satisfies ModelProviderStatusSchema", async () => {
    const mockContext: any = {
      request: new Request("https://example.com/api/config"),
      env: {
        UNOROUTER_API_KEY: TEST_UNO_KEY,
        MODEL_GATEWAY: "unorouter"
      }
    };

    const response = await handleConfig(mockContext);
    assert.equal(response.status, 200);

    const body = await response.json();
    try {
      const parsed = ModelProviderStatusSchema.parse(body);
      assert.equal(parsed.provider, "unorouter");
      assert.equal(parsed.ready, true);
      assert.ok(parsed.models.length >= 1);
      assert.ok(parsed.models.some((m) => m.id === "deepseek/deepseek-chat"));
      assert.equal(parsed.defaultModel, "deepseek/deepseek-chat");
    } catch (err: any) {
      console.error("Test 1 error body:", JSON.stringify(body, null, 2));
      throw err;
    }
  });

  it("EdgeOne /api/models/detect successfully returns UnoRouter models when provider=unorouter", async () => {
    const mockContext: any = {
      request: new Request("https://example.com/api/models/detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-custom-api-key": TEST_UNO_KEY
        },
        body: JSON.stringify({
          apiKey: TEST_UNO_KEY,
          apiBaseUrl: "https://api.unorouter.com/v1",
          provider: "unorouter"
        })
      }),
      env: {}
    };

    const response = await handleDetect(mockContext);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.provider, "unorouter");
    assert.ok(body.models.length >= 1);
    assert.ok(body.models.some((m: any) => m.id.includes("deepseek")));
  });

  it("EdgeOne /api/models/detect works when user selects UnoRouter preset without apiKey yet", async () => {
    const mockContext: any = {
      request: new Request("https://example.com/api/models/detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiBaseUrl: "https://api.unorouter.com/v1",
          provider: "unorouter"
        })
      }),
      env: {}
    };

    const response = await handleDetect(mockContext);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.provider, "unorouter");
    assert.ok(body.models.length >= 1);
    assert.ok(body.models.some((m: any) => m.id.includes("deepseek")));
  });
});
