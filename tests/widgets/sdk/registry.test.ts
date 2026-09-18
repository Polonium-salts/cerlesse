import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ExtensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { loadExtension } from "../../../src/widgets/registry/extensionLoader.js";
import type { WidgetExtension } from "../../../src/widgets/sdk/extension.js";

describe("ExtensionRegistry & Loader", () => {
  let registry: ExtensionRegistry;

  const mockExtension: WidgetExtension = {
    manifest: {
      id: "weather_test",
      name: "Weather Test",
      version: "1.0.0",
      apiVersion: 1,
      description: "Weather forecast extension",
      category: "data",
      tags: ["weather", "forecast"],
      capabilities: ["weather_current", "weather_forecast"],
      intents: ["weather", "travel"],
      keywords: ["weather", "temp"],
      examples: ["Tokyo weather"],
      layout: {
        defaultWidth: 50,
        minWidth: 25,
        maxWidth: 75
      }
    },
    component: () => null
  };

  const mockToolExtension: WidgetExtension = {
    manifest: {
      id: "toolbox_test",
      name: "Toolbox Test",
      version: "1.0.0",
      apiVersion: 1,
      description: "Action toolbox extension",
      category: "action",
      tags: ["tools"],
      capabilities: ["copy_text", "cli_execution"],
      intents: ["install", "troubleshooting"],
      keywords: ["cli"],
      examples: ["npm install"],
      layout: {
        defaultWidth: 75,
        minWidth: 50,
        maxWidth: 100
      }
    },
    component: () => null
  };

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  it("should successfully register an extension and retrieve it", () => {
    registry.register(mockExtension);
    assert.equal(registry.has("weather_test"), true);
    assert.deepEqual(registry.get("weather_test")?.manifest.id, "weather_test");
    assert.equal(registry.getAll().length, 1);
  });

  it("should throw when registering an extension with duplicated id", () => {
    registry.register(mockExtension);
    assert.throws(() => {
      registry.register(mockExtension);
    }, /Widget extension already registered: weather_test/);
  });

  it("should successfully unregister an extension", () => {
    registry.register(mockExtension);
    assert.equal(registry.has("weather_test"), true);
    const removed = registry.unregister("weather_test");
    assert.equal(removed, true);
    assert.equal(registry.has("weather_test"), false);
    assert.equal(registry.get("weather_test"), undefined);
  });

  it("should find extensions by capability", () => {
    registry.register(mockExtension);
    registry.register(mockToolExtension);

    const weatherCaps = registry.findByCapability("weather_current");
    assert.equal(weatherCaps.length, 1);
    assert.equal(weatherCaps[0].manifest.id, "weather_test");

    const cliCaps = registry.findByCapability("cli_execution");
    assert.equal(cliCaps.length, 1);
    assert.equal(cliCaps[0].manifest.id, "toolbox_test");

    const nonExistent = registry.findByCapability("non_existent");
    assert.equal(nonExistent.length, 0);
  });

  it("should find extensions by intent", () => {
    registry.register(mockExtension);
    registry.register(mockToolExtension);

    const travelExtensions = registry.findByIntent("travel");
    assert.equal(travelExtensions.length, 1);
    assert.equal(travelExtensions[0].manifest.id, "weather_test");

    const installExtensions = registry.findByIntent("install");
    assert.equal(installExtensions.length, 1);
    assert.equal(installExtensions[0].manifest.id, "toolbox_test");
  });

  it("should load valid extension via loadExtension and reject invalid ones", () => {
    loadExtension(mockExtension, registry);
    assert.equal(registry.has("weather_test"), true);

    const invalidExtension: WidgetExtension = {
      manifest: {
        ...mockExtension.manifest,
        id: ""
      },
      component: () => null
    };

    assert.throws(() => {
      loadExtension(invalidExtension, registry);
    }, /Widget manifest requires id/);
  });
});
