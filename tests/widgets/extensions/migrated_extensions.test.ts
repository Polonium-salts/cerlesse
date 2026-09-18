import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extensionRegistry } from "../../../src/widgets/registry/extensionRegistry.js";
import { WidgetRegistry } from "../../../src/widgets/registry.js";

import actionsToolboxExtension from "../../../src/widgets/extensions/actions_toolbox/index.js";
import aiAnswerExtension from "../../../src/widgets/extensions/ai_answer/index.js";
import comparisonExtension from "../../../src/widgets/extensions/comparison/index.js";
import imageGalleryExtension from "../../../src/widgets/extensions/image_gallery/index.js";
import mindmapExtension from "../../../src/widgets/extensions/mindmap/index.js";
import relatedLinksExtension from "../../../src/widgets/extensions/related_links/index.js";
import searchEngineExtension from "../../../src/widgets/extensions/search_engine/index.js";
import sourcesExtension from "../../../src/widgets/extensions/sources/index.js";
import takeawaysExtension from "../../../src/widgets/extensions/takeaways/index.js";
import tokenUsageExtension from "../../../src/widgets/extensions/token_usage/index.js";

const MIGRATED_EXTENSIONS = [
  actionsToolboxExtension,
  aiAnswerExtension,
  comparisonExtension,
  imageGalleryExtension,
  mindmapExtension,
  relatedLinksExtension,
  searchEngineExtension,
  sourcesExtension,
  takeawaysExtension,
  tokenUsageExtension
];

// Register all in extensionRegistry if not already loaded by scanner
for (const ext of MIGRATED_EXTENSIONS) {
  if (!extensionRegistry.has(ext.manifest.id)) {
    extensionRegistry.register(ext);
  }
}

describe("Migrated Extensions Verification", () => {
  for (const ext of MIGRATED_EXTENSIONS) {
    const extId = ext.manifest.id;
    describe(`Extension: ${extId}`, () => {
      it(`should be registered in extensionRegistry with valid manifest`, () => {
        const found = extensionRegistry.get(extId);
        assert.ok(found, `Extension ${extId} must be present in extensionRegistry`);
        assert.equal(found.manifest.id, extId);
        assert.ok(found.manifest.name, `${extId} must have a name`);
        assert.ok(found.manifest.version, `${extId} must have a version`);
        assert.ok(Array.isArray(found.manifest.capabilities) && found.manifest.capabilities.length > 0);
        assert.ok(Array.isArray(found.manifest.intents) && found.manifest.intents.length > 0);
      });

      it(`should be resolvable via WidgetRegistry.get('${extId}') as a valid WidgetModule`, () => {
        const mod = WidgetRegistry.get(extId);
        assert.ok(mod, `WidgetRegistry.get('${extId}') must return a module`);
        assert.equal(mod.id, extId);
        assert.ok(typeof mod.render === "function", `Module ${extId} must have a render function`);
        assert.ok(mod.width === 25 || mod.width === 50 || mod.width === 75 || mod.width === 100);
      });

      it(`should have a working adapter with transform and validate`, () => {
        assert.ok(ext.adapter, `Extension ${extId} should have an adapter`);
        const dummyResult: any = {
          query: "test query",
          summary: "test summary",
          keyTakeaways: ["takeaway 1"],
          filteredResults: [{ title: "Doc", url: "https://example.com", isOfficial: true }],
          comparisonTable: [],
          mindMap: { name: "Root" }
        };
        const transformed = ext.adapter.transform("test query", dummyResult);
        assert.ok(transformed !== undefined, `Adapter transform should return data for ${extId}`);
        if (ext.adapter.validate) {
          assert.equal((ext.adapter.validate as (d: any) => boolean)(transformed), true, `Adapter validate should pass for ${extId}`);
        }
      });
    });
  }
});
