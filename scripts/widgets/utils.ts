import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { WidgetExtension } from "../../src/widgets/sdk/extension.js";
import type { WidgetManifest } from "../../src/widgets/sdk/manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const EXTENSIONS_DIR = path.resolve(__dirname, "../../src/widgets/extensions");

export interface DiscoveredExtension {
  directoryName: string;
  directoryPath: string;
  indexPath: string;
  manifestPath: string;
  extension?: WidgetExtension;
  manifest?: WidgetManifest;
  error?: string;
}

/**
 * 从文件系统扫描 src/widgets/extensions/ 下的所有扩展目录
 */
export async function discoverExtensionDirs(): Promise<DiscoveredExtension[]> {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    return [];
  }

  const items = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true });
  const results: DiscoveredExtension[] = [];

  for (const item of items) {
    if (!item.isDirectory()) continue;
    // 忽略隐藏目录（除了 _ 开头的测试目录）
    if (item.name.startsWith(".") || item.name === "node_modules") continue;

    const dirPath = path.join(EXTENSIONS_DIR, item.name);
    const indexPath = path.join(dirPath, "index.ts");
    const manifestPath = path.join(dirPath, "manifest.ts");

    const discovered: DiscoveredExtension = {
      directoryName: item.name,
      directoryPath: dirPath,
      indexPath,
      manifestPath
    };

    if (!fs.existsSync(indexPath)) {
      discovered.error = `Missing index.ts in ${dirPath}`;
      results.push(discovered);
      continue;
    }

    try {
      const fileUrl = pathToFileURL(indexPath).href;
      const mod = await import(fileUrl);
      const ext = mod.default as WidgetExtension | undefined;
      if (!ext) {
        discovered.error = `Missing default export in ${indexPath}`;
      } else {
        discovered.extension = ext;
        discovered.manifest = ext.manifest;
      }
    } catch (err: any) {
      discovered.error = `Failed to import ${indexPath}: ${err.message}`;
    }

    results.push(discovered);
  }

  return results;
}
