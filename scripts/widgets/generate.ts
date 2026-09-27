import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverExtensionDirs } from "./utils.js";
import { validateManifest } from "../../src/widgets/sdk/manifestValidator.js";
import { manifestToCatalogEntry, ExtensionCatalogEntry } from "../../src/widgets/registry/extensionCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_CATALOG_FILE = path.resolve(__dirname, "../../src/widgets/registry/generatedCatalog.ts");
const TARGET_REGISTRY_FILE = path.resolve(__dirname, "../../src/widgets/registry/generatedRegistry.ts");

function toVarName(dirName: string): string {
  const cleanName = dirName.startsWith("_") ? "_" + dirName.slice(1) : dirName;
  return cleanName.replace(/_([a-z0-9])/gi, (_, c) => c.toUpperCase());
}

async function run() {
  console.log("📦 Generating static extension catalog & static extension registry...\n");
  const list = await discoverExtensionDirs();
  const validCatalogEntries: ExtensionCatalogEntry[] = [];
  const validExtensionDirs: Array<{ dirName: string; varName: string; id: string }> = [];
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
      validCatalogEntries.push(manifestToCatalogEntry(item.manifest));
      validExtensionDirs.push({
        dirName: item.directoryName,
        varName: toVarName(item.directoryName),
        id: item.manifest.id
      });
      console.log(`  ✓ Included ${item.manifest.id}`);
    } catch (err: any) {
      console.error(`  ✗ Skipping invalid ${item.directoryName}: ${err.message}`);
    }
  }

  // 1. 生成 Catalog 清单
  const catalogContent = `/**
 * 该文件由 scripts/widgets/generate.ts 自动构建生成
 * 严禁手动修改！构建期已执行 Manifest 与标准 Capabilities/Intents 校验。
 */
import type { ExtensionCatalogEntry } from "./extensionCatalog.js";

export const GENERATED_EXTENSION_CATALOG: ExtensionCatalogEntry[] = ${JSON.stringify(validCatalogEntries, null, 2)};

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

  fs.writeFileSync(TARGET_CATALOG_FILE, catalogContent, "utf-8");
  console.log(`\n✓ Generated static catalog for ${validCatalogEntries.length} extensions at:\n  ${TARGET_CATALOG_FILE}`);

  // 2. 生成静态 Registry 清单（直接 import index.ts，彻底摆脱运行期 import.meta.glob 的不确定性）
  const registryImports = validExtensionDirs
    .map(ext => `import ${ext.varName} from "../extensions/${ext.dirName}/index.js";`)
    .join("\n");

  const registryArrayItems = validExtensionDirs
    .map(ext => `  ${ext.varName}`)
    .join(",\n");

  const registryContent = `/**
 * 该文件由 scripts/widgets/generate.ts 自动构建生成
 * 严禁手动修改！静态引入所有合法扩展，确保生产环境、Node、EdgeOne 等无缝加载。
 */
import type { WidgetExtension } from "../sdk/extension.js";
${registryImports}

export const BUILTIN_WIDGET_EXTENSIONS: WidgetExtension<any>[] = [
${registryArrayItems}
].filter((ext): ext is WidgetExtension<any> => Boolean(ext && ext?.manifest?.id));
`;

  fs.writeFileSync(TARGET_REGISTRY_FILE, registryContent, "utf-8");
  console.log(`✓ Generated static registry imports for ${validExtensionDirs.length} extensions at:\n  ${TARGET_REGISTRY_FILE}\n`);
}

run().catch(err => {
  console.error("Fatal generator error:", err);
  process.exit(1);
});
