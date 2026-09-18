import type { WidgetExtension } from "../sdk/extension.js";

export interface ScannedExtensionEntry {
  directoryId: string;
  filePath: string;
  extension: WidgetExtension;
}

// Vite 自动扫描所有小组件扩展入口: src/widgets/extensions/<id>/index.ts
const modules: Record<string, any> =
  typeof import.meta !== "undefined" && typeof (import.meta as any).glob === "function"
    ? (import.meta as any).glob("../extensions/*/index.ts", { eager: true })
    : {};

/**
 * 扫描全部 Extension 目录并解析 Entry
 * 严格检查重复 ID 与缺失 default 导出的错误
 */
export function scanExtensionEntries(): ScannedExtensionEntry[] {
  const entries: ScannedExtensionEntry[] = [];
  const seenIds = new Set<string>();

  for (const [filePath, moduleObj] of Object.entries(modules)) {
    const extension = (moduleObj as any)?.default as WidgetExtension | undefined;

    if (!extension) {
      console.warn(`[ExtensionScanner] Extension 缺少 default export: ${filePath}`);
      continue;
    }

    if (!extension.manifest) {
      console.warn(`[ExtensionScanner] Extension 缺少 manifest: ${filePath}`);
      continue;
    }

    // 提取目录 ID: ../extensions/<id>/index.ts
    const match = filePath.match(/(?:^|\/)extensions\/([^/]+)\/index\.ts$/);
    const directoryId = match ? match[1] : extension.manifest.id;

    if (seenIds.has(extension.manifest.id)) {
      throw new Error(`[ExtensionScanner] Duplicate widget id: ${extension.manifest.id} (at ${filePath})`);
    }

    seenIds.add(extension.manifest.id);
    entries.push({
      directoryId,
      filePath,
      extension
    });
  }

  return entries;
}

/**
 * 获取扫描到的所有可用 Extension 实例列表
 */
export function scanExtensions(): WidgetExtension[] {
  return scanExtensionEntries().map(entry => entry.extension);
}
