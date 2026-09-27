import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verificationChecklistAdapter } from "../../../src/widgets/extensions/verification_checklist/adapter.js";
import { manifest } from "../../../src/widgets/extensions/verification_checklist/manifest.js";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";
import verificationChecklistExtension from "../../../src/widgets/extensions/verification_checklist/index.js";

describe("Verification Checklist Extension Integration", () => {
  it("should have correct manifest configuration", () => {
    assert.equal(manifest.id, "verification_checklist");
    assert.equal(manifest.name, "排查与核验清单");
    assert.ok(manifest.capabilities.includes("verification_checklist"));
    assert.ok(manifest.intents.includes("troubleshooting"));
  });

  it("should adapt queries to structured checklist data", () => {
    assert.equal(verificationChecklistAdapter.canHandle?.("上线核验清单"), true);
    assert.equal(verificationChecklistAdapter.canHandle?.("北京天气"), false);

    const data = verificationChecklistAdapter.transform("错误排查清单");
    assert.ok(data.items.length > 0);
    assert.equal(verificationChecklistAdapter.validate?.(data), true);
  });

  it("should be registered and resolved by WidgetRegistry with extension priority", () => {
    if (!extensionRegistry.has("verification_checklist")) {
      extensionRegistry.register(verificationChecklistExtension);
    }
    assert.ok(extensionRegistry.has("verification_checklist"));

    const mod = WidgetRegistry.get("verification_checklist");
    assert.ok(mod, "WidgetRegistry should resolve verification_checklist module");
    assert.equal(mod.id, "verification_checklist");
    assert.equal(mod.name, "排查与核验清单");
  });
});
