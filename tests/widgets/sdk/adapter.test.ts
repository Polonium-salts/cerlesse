import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter } from "../../../src/widgets/extensions/_test/adapter.js";
import testExtension from "../../../src/widgets/extensions/_test/index.js";
import { createModuleFromExtension } from "../../../src/widgets/sdk/extension.js";

describe("WidgetAdapter & createModuleFromExtension", () => {
  it("should handle transform and validation correctly in test adapter", () => {
    assert.equal(adapter.canHandle("any query", {}), true);
    const transformed = adapter.transform("any query", {});
    assert.deepEqual(transformed, { message: "Extension Adapter OK" });
    assert.equal(adapter.validate(transformed), true);
    assert.equal(adapter.validate({} as any), false);
    assert.equal(adapter.validate(null as any), false);
  });

  it("should adapt WidgetExtension into valid WidgetModule", () => {
    const module = createModuleFromExtension(testExtension);
    assert.equal(module.id, "test_extension");
    assert.equal(module.name, "Test Extension");
    assert.equal(module.width, 50);
    assert.deepEqual(module.capabilities, ["direct_answer"]);

    // 测试 data pipeline
    const resolvedData = module.data?.({ query: "test" } as any);
    assert.deepEqual(resolvedData, { message: "Extension Adapter OK" });
  });
});
