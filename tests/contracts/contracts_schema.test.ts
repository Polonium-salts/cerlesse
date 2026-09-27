import { describe, it } from "node:test";
import assert from "node:assert";
import { 
  ModelProviderStatusSchema, 
  WidgetPlanItemSchema, 
  AgentStreamEventSchema 
} from "../../src/contracts/index.js";

describe("Contracts & Schemas Validation", () => {
  it("should validate healthy ModelProviderStatus correctly", () => {
    const raw = {
      provider: "deepseek",
      ready: true,
      hasApiKey: true,
      models: [
        { id: "deepseek-chat", name: "DeepSeek V3", contextWindow: 64000 }
      ],
      defaultModel: "deepseek-chat"
    };
    const parsed = ModelProviderStatusSchema.parse(raw);
    assert.strictEqual(parsed.provider, "deepseek");
    assert.strictEqual(parsed.ready, true);
    assert.strictEqual(parsed.models.length, 1);
  });

  it("should handle unconfigured provider gracefully with defaults", () => {
    const raw = {
      provider: "none",
      ready: false,
      reason: "No API keys configured"
    };
    const parsed = ModelProviderStatusSchema.parse(raw);
    assert.strictEqual(parsed.ready, false);
    assert.deepStrictEqual(parsed.models, []);
  });

  it("should throw on invalid model provider shape", () => {
    const badRaw = {
      provider: 12345, // invalid type
      ready: "not-a-boolean"
    };
    assert.throws(() => {
      ModelProviderStatusSchema.parse(badRaw);
    });
  });

  it("should validate WidgetPlanItem with default hasRenderer and presence", () => {
    const raw = {
      widgetId: "ai_answer",
      gridWidth: 50
    };
    const parsed = WidgetPlanItemSchema.parse(raw);
    assert.strictEqual(parsed.widgetId, "ai_answer");
    assert.strictEqual(parsed.presence, "conditional");
    assert.strictEqual(parsed.hasRenderer, true);
  });

  it("should parse provider_error stream event", () => {
    const raw = {
      type: "provider_error",
      message: "OpenRouter rate limit exceeded",
      retryable: true
    };
    const parsed = AgentStreamEventSchema.parse(raw);
    assert.strictEqual(parsed.type, "provider_error");
    if (parsed.type === "provider_error") {
      assert.strictEqual(parsed.message, "OpenRouter rate limit exceeded");
      assert.strictEqual(parsed.retryable, true);
    }
  });

  it("should parse widget_plan stream event", () => {
    const raw = {
      type: "widget_plan",
      items: [
        { widgetId: "sources", presence: "resident", gridWidth: 100, hasRenderer: true },
        { widgetId: "custom_experimental", presence: "conditional", gridWidth: 50, hasRenderer: false }
      ]
    };
    const parsed = AgentStreamEventSchema.parse(raw);
    assert.strictEqual(parsed.type, "widget_plan");
    if (parsed.type === "widget_plan") {
      assert.strictEqual(parsed.items.length, 2);
      assert.strictEqual(parsed.items[1].hasRenderer, false);
    }
  });
});
