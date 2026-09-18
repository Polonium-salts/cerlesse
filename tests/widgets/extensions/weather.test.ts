import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { weatherAdapter } from "../../../src/widgets/extensions/weather/adapter.js";
import { manifest } from "../../../src/widgets/extensions/weather/manifest.js";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";
import weatherExtension from "../../../src/widgets/extensions/weather/index.js";

describe("Weather Extension Integration", () => {
  it("should have correct manifest configuration", () => {
    assert.equal(manifest.id, "weather");
    assert.equal(manifest.name, "实时天气");
    assert.ok(manifest.capabilities.includes("weather_current"));
    assert.ok(manifest.intents.includes("weather"));
  });

  it("should adapt search query to weather data", () => {
    assert.equal(weatherAdapter.canHandle?.("北京今天天气"), true);
    assert.equal(weatherAdapter.canHandle?.("npm install error"), false);

    const data = weatherAdapter.transform("北京今天天气", { query: "北京今天天气" });
    assert.equal(data.location, "北京");
    assert.equal(typeof data.temperature, "number");
    assert.ok(data.forecast.length > 0);
    assert.equal(weatherAdapter.validate?.(data), true);
  });

  it("should be registered and resolved by WidgetRegistry with extension priority", () => {
    if (!extensionRegistry.has("weather")) {
      extensionRegistry.register(weatherExtension);
    }
    assert.ok(extensionRegistry.has("weather"));

    const mod = WidgetRegistry.get("weather");
    assert.ok(mod, "WidgetRegistry should resolve weather module");
    assert.equal(mod.id, "weather");
    assert.equal(mod.name, "实时天气");
  });
});
