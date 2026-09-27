import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExtensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { buildExtensionCatalog } from "../../../src/widgets/registry/generatedCatalog.js";
import testExtension from "../../../src/widgets/extensions/_test/index.js";

describe("Extension Catalog Generation", () => {
  it("should generate catalog from registered extensions", () => {
    const registry = new ExtensionRegistry();
    registry.register(testExtension);

    const catalog = buildExtensionCatalog(registry);
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].id, "test_extension");
    assert.equal(catalog[0].name, "Test Extension");
    assert.deepEqual(catalog[0].capabilities, ["direct_answer"]);
    assert.deepEqual(catalog[0].intents, ["general_knowledge"]);
    assert.equal(catalog[0].category, "analysis");
  });
});
