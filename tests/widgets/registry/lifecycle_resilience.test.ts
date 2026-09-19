import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { 
  getExtensionRegistry, 
  ExtensionRegistry 
} from "../../../src/widgets/registry/extensionRegistry.js";
import { 
  getWidgetRegistryHealth, 
  setWidgetRegistryHealth,
  validateWidgetRegistryConsistency 
} from "../../../src/widgets/registry/registryHealth.js";
import { getExtensionCatalog } from "../../../src/widgets/registry/extensionCatalog.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";
import { resolveWidgetData } from "../../../src/widgets/runtime.js";
import type { WidgetModule } from "../../../src/widgets/sdk/types.js";

describe("Cerlesse Widget Lifecycle & Resilience Tests", () => {
  it("Registry: singleton instance maintained across multiple calls (HMR safety)", () => {
    const reg1 = getExtensionRegistry();
    const reg2 = getExtensionRegistry();
    assert.equal(reg1, reg2, "getExtensionRegistry should return the same singleton instance");
    assert.equal(
      (globalThis as any).__CERLESSE_EXTENSION_REGISTRY__, 
      reg1, 
      "Singleton must be anchored on globalThis"
    );
  });

  it("Registry Health: tracks status and failures properly", () => {
    const initialHealth = getWidgetRegistryHealth();
    assert.equal(typeof initialHealth.initialized, "boolean");
    assert.equal(Array.isArray(initialHealth.failedWidgets), true);

    setWidgetRegistryHealth({
      initialized: true,
      failedWidgets: [
        { id: "test_broken_ext", error: "Simulated load failure" }
      ]
    });

    const updated = getWidgetRegistryHealth();
    assert.equal(updated.initialized, true);
    assert.equal(updated.failedWidgets.length, 1);
    assert.equal(updated.failedWidgets[0].id, "test_broken_ext");

    // Clean up
    setWidgetRegistryHealth(initialHealth);
  });


  it("Consistency Validation: identifies widgets missing from registry/catalog", () => {
    const plannedKeys = ["weather", "fake_nonexistent_widget", "sources"];
    const registeredKeys = ["weather", "sources", "takeaways"];

    const missing = validateWidgetRegistryConsistency(plannedKeys, registeredKeys);
    assert.deepEqual(missing, ["fake_nonexistent_widget"]);
  });

  it("WidgetRegistry.diagnose: accurately reports presence and registry counts", () => {
    const all = WidgetRegistry.getAll();
    if (all.length > 0) {
      const firstId = all[0].id;
      const diagExisting = WidgetRegistry.diagnose(String(firstId));
      assert.equal(typeof diagExisting.inExtensionRegistry, "boolean");
      assert.equal(typeof diagExisting.totalWidgets, "number");
      assert.ok(diagExisting.totalWidgets > 0);

      const diagMissing = WidgetRegistry.diagnose("__totally_nonexistent_widget__");
      assert.equal(diagMissing.inExtensionRegistry, false);
      assert.equal(diagMissing.inRemoteRegistry, false);
      assert.equal(diagMissing.inRuntimeRegistry, false);
    }
  });

  it("WidgetRuntime.resolveWidgetData: safely catches throwing adapters without crashing", () => {
    const brokenModule: WidgetModule = {
      id: "broken_adapter_test" as any,
      name: "Broken Adapter Test",
      version: "1.0.0",
      category: "analysis",
      width: 50,
      render: () => null,
      data: () => {
        throw new Error("Simulated adapter error: Cannot read properties of undefined");
      }
    };

    // Should not throw, but return error object
    const result = resolveWidgetData(brokenModule, undefined, undefined);
    assert.equal(result.data, undefined);
    assert.ok(result.error instanceof Error);
    assert.match(result.error.message, /Simulated adapter error/);
  });


  it("Catalog: empty registry throws descriptive error in strict mode", () => {
    const emptyReg = new ExtensionRegistry();
    const origStrict = process.env.CERLESSE_STRICT_CATALOG;
    try {
      process.env.CERLESSE_STRICT_CATALOG = "true";
      assert.throws(() => {
        getExtensionCatalog(emptyReg);
      }, /\[WidgetCatalog\] Extension Registry is empty/);
    } finally {
      process.env.CERLESSE_STRICT_CATALOG = origStrict;
    }
  });


});
