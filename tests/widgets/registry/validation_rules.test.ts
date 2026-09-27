import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../../../src/widgets/sdk/manifestValidator.js";
import type { WidgetManifest } from "../../../src/widgets/sdk/manifest.js";

describe("Validation Rules (Capability, Intent, Layout, Agent, Directory)", () => {
  const baseManifest: WidgetManifest = {
    id: "weather",
    name: "Weather Widget",
    version: "1.0.0",
    apiVersion: 1,
    description: "Real-time weather forecast",
    category: "data",
    tags: ["weather", "forecast"],
    capabilities: ["weather_current", "weather_forecast"],
    intents: ["weather", "travel"],
    keywords: ["weather", "temperature"],
    examples: ["What is the weather in Tokyo?"],
    layout: {
      defaultWidth: 50,
      minWidth: 25,
      maxWidth: 75
    },
    agent: {
      selectable: true,
      minConfidence: 0.65
    }
  };

  it("should pass when manifest and directory match", () => {
    assert.doesNotThrow(() => {
      validateManifest(baseManifest, "weather");
    });
  });

  it("should reject when directory does not match manifest id", () => {
    assert.throws(
      () => validateManifest(baseManifest, "repository"),
      /Directory ID "repository" does not match Manifest ID "weather"/
    );
  });

  it("should reject invalid capabilities not in CANONICAL_CAPABILITIES", () => {
    assert.throws(
      () => validateManifest({
        ...baseManifest,
        capabilities: ["weather_current", "magic_weather_power"]
      }),
      /has invalid capability: magic_weather_power/
    );
  });

  it("should reject invalid intents not in CANONICAL_INTENTS", () => {
    assert.throws(
      () => validateManifest({
        ...baseManifest,
        intents: ["weather", "custom_unknown_intent"]
      }),
      /has invalid intent: custom_unknown_intent/
    );
  });

  it("should reject when defaultWidth is outside minWidth and maxWidth", () => {
    assert.throws(
      () => validateManifest({
        ...baseManifest,
        layout: {
          defaultWidth: 100,
          minWidth: 25,
          maxWidth: 75
        }
      }),
      /layout defaultWidth \(100\) must be between minWidth \(25\) and maxWidth \(75\)/
    );
  });

  it("should reject agent minConfidence > 1 or < 0", () => {
    assert.throws(
      () => validateManifest({
        ...baseManifest,
        agent: {
          selectable: true,
          minConfidence: 1.5
        }
      }),
      /agent minConfidence \(1.5\) must be between 0 and 1/
    );

    assert.throws(
      () => validateManifest({
        ...baseManifest,
        agent: {
          selectable: true,
          minConfidence: -0.2
        }
      }),
      /agent minConfidence \(-0.2\) must be between 0 and 1/
    );
  });
});
