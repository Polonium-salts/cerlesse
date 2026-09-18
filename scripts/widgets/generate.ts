import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverExtensionDirs } from "./utils.js";
import { validateManifest } from "../../src/widgets/sdk/manifestValidator.js";
import { manifestToCatalogEntry, ExtensionCatalogEntry } from "../../src/widgets/registry/extensionCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_FILE = path.resolve(__dirname, "../../src/widgets/registry/generatedCatalog.ts");

async function run() {
  console.log("📦 Generating static extension catalog...\n");
  const list = await discoverExtensionDirs();
  const validEntries: ExtensionCatalogEntry[] = [];
  const seenIds = new Set<string>();

  for (const item of list) {
    if (item.error || !item.manifest) {
      console.error(`  ✗ Skipping ${item.directoryName}: ${item.error || "No manifest"}`);
      continue;
    }

    if (seenIds.has(item.manifest.id)) {
      console.error(`  ✗ Skipping duplicate id: ${item.manifest.id}`);
      continue;
    }
    seenIds.add(item.manifest.id);

    try {
      validateManifest(item.manifest, item.directoryName);
      validEntries.push(manifestToCatalogEntry(item.manifest));
      console.log(`  ✓ Included ${item.manifest.id}`);
    } catch (err: any) {
      console.error(`  ✗ Skipping invalid ${item.directoryName}: ${err.message}`);
    }
  }

  const fileContent = `/**
 * 该文件由 scripts/widgets/generate.ts 自动构建生成
 * 严禁手动修改！构建期已执行 Manifest 与标准 Capabilities/Intents 校验。
 */
import type { ExtensionCatalogEntry } from "./extensionCatalog.js";

export const GENERATED_EXTENSION_CATALOG: ExtensionCatalogEntry[] = ${JSON.stringify(validEntries, null, 2)};

export function getGeneratedExtensionCatalog(): ExtensionCatalogEntry[] {
  return GENERATED_EXTENSION_CATALOG;
}

export function buildExtensionCatalog(registry?: any): ExtensionCatalogEntry[] {
  if (registry && typeof registry.getAll === "function") {
    return registry.getAll().map((ext: any) => ({
      ...ext.manifest,
      layout: ext.manifest?.layout,
      agent: ext.manifest?.agent
    }));
  }
  return GENERATED_EXTENSION_CATALOG;
}
`;

  fs.writeFileSync(TARGET_FILE, fileContent, "utf-8");
  console.log(`\n✓ Generated static catalog for ${validEntries.length} extensions at:`);
  console.log(`  ${TARGET_FILE}`);
}

run().catch(err => {
  console.error("Fatal generator error:", err);
  process.exit(1);
});
