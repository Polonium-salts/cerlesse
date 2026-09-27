import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../../../src/widgets/sdk/manifestValidator.js";
import type { WidgetManifest } from "../../../src/widgets/sdk/manifest.js";

describe("WidgetManifest Validation", () => {
  const validManifest: WidgetManifest = {
    id: "valid_extension",
    name: "Valid Extension",
    version: "1.0.0",
    apiVersion: 1,
    description: "A valid test extension manifest",
    category: "analysis",
    tags: ["test", "valid"],
    capabilities: ["direct_answer"],
    intents: ["general_knowledge"],
    keywords: ["valid"],
    examples: ["Example test"],
    layout: {
      defaultWidth: 50,
      minWidth: 25,
      maxWidth: 75
    }
  };

  it("should pass validation for a well-formed manifest", () => {
    assert.doesNotThrow(() => {
      validateManifest(validManifest);
    });
  });

  it("should throw when manifest has empty or missing id", () => {
    assert.throws(
      () => validateManifest({ ...validManifest, id: "" }),
      /requires id/
    );
  });

  it("should throw when manifest has empty or missing name", () => {
    assert.throws(
      () => validateManifest({ ...validManifest, name: "" }),
      /requires name/
    );
  });

  it("should throw when manifest has invalid category", () => {
    assert.throws(
      () => validateManifest({ ...validManifest, category: "invalid_cat" as any }),
      /invalid category/
    );
  });

  it("should throw when manifest has empty capabilities", () => {
    assert.throws(
      () => validateManifest({ ...validManifest, capabilities: [] }),
      /requires capabilities/
    );
  });

  it("should throw when manifest has empty intents", () => {
    assert.throws(
      () => validateManifest({ ...validManifest, intents: [] }),
      /requires intents/
    );
  });

  it("should throw when layout defaultWidth is invalid", () => {
    assert.throws(
      () => validateManifest({
        ...validManifest,
        layout: { defaultWidth: 33 as any, minWidth: 25, maxWidth: 75 }
      }),
      /layout defaultWidth must be 25, 50, 75, or 100/
    );
  });

  it("should throw when minWidth exceeds maxWidth", () => {
    assert.throws(
      () => validateManifest({
        ...validManifest,
        layout: { defaultWidth: 50, minWidth: 75, maxWidth: 50 }
      }),
      /minWidth \(75\) cannot exceed maxWidth \(50\)/
    );
  });
});
