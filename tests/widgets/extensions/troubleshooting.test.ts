import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { troubleshootingAdapter } from "../../../src/widgets/extensions/troubleshooting/adapter.js";
import { manifest } from "../../../src/widgets/extensions/troubleshooting/manifest.js";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";
import troubleshootingExtension from "../../../src/widgets/extensions/troubleshooting/index.js";

describe("Troubleshooting Extension Integration", () => {
  it("should have correct manifest configuration", () => {
    assert.equal(manifest.id, "troubleshooting");
    assert.equal(manifest.name, "故障排查与诊断指南");
    assert.ok(manifest.capabilities.includes("error_diagnosis"));
    assert.ok(manifest.intents.includes("troubleshooting"));
  });

  it("should adapt error queries to structured troubleshooting plan", () => {
    assert.equal(troubleshootingAdapter.canHandle?.("npm install 报错怎么解决"), true);
    assert.equal(troubleshootingAdapter.canHandle?.("502 bad gateway error"), true);
    assert.equal(troubleshootingAdapter.canHandle?.("上海今天气温"), false);

    const plan = troubleshootingAdapter.transform("npm install 报错怎么解决");
    assert.ok(plan.errorName);
    assert.ok(plan.solutions.length > 0);
    assert.ok(plan.rootCause);
    assert.equal(troubleshootingAdapter.validate?.(plan), true);
  });

  it("should be registered and resolved by WidgetRegistry with extension priority", () => {
    if (!extensionRegistry.has("troubleshooting")) {
      extensionRegistry.register(troubleshootingExtension);
    }
    assert.ok(extensionRegistry.has("troubleshooting"));

    const mod = WidgetRegistry.get("troubleshooting");
    assert.ok(mod, "WidgetRegistry should resolve troubleshooting module");
    assert.equal(mod.id, "troubleshooting");
    assert.equal(mod.name, "故障排查与诊断指南");
  });
});
