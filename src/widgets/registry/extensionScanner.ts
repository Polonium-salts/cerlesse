import type { WidgetExtension } from "../sdk/extension.js";

export interface ScannedExtensionEntry {
  directoryId: string;
  filePath: string;
  extension?: WidgetExtension;
  error?: string;
}

// Vite 自动扫描所有小组件扩展入口: src/widgets/extensions/<id>/index.ts
const modules: Record<string, any> =
  typeof import.meta !== "undefined" && typeof (import.meta as any).glob === "function"
    ? (import.meta as any).glob("../extensions/*/index.ts", { eager: true })
    : {};

/**
 * 扫描全部 Extension 目录并解析 Entry
 * 具备容灾隔离：单个损坏或重复的组件不阻断其他合法组件的加载
 */
export function scanExtensionEntries(): ScannedExtensionEntry[] {
  const entries: ScannedExtensionEntry[] = [];
  const seenIds = new Set<string>();

  for (const [filePath, moduleObj] of Object.entries(modules)) {
    try {
      const extension = (moduleObj as any)?.default as WidgetExtension | undefined;

      // 提取目录 ID: ../extensions/<id>/index.ts
      const match = filePath.match(/(?:^|\/)extensions\/([^/]+)\/index\.ts$/);
      const directoryId = match ? match[1] : (extension?.manifest?.id || "unknown");

      if (!extension) {
        const errorMsg = `Extension 缺少 default export (${filePath})`;
        console.warn(`[ExtensionScanner] ${errorMsg}`);
        entries.push({ directoryId, filePath, error: errorMsg });
        continue;
      }

      if (!extension.manifest) {
        const errorMsg = `Extension 缺少 manifest (${filePath})`;
        console.warn(`[ExtensionScanner] ${errorMsg}`);
        entries.push({ directoryId, filePath, extension, error: errorMsg });
        continue;
      }

      if (seenIds.has(extension.manifest.id)) {
        const errorMsg = `Duplicate widget id: ${extension.manifest.id} (at ${filePath})`;
        console.error(`[ExtensionScanner] ${errorMsg}`);
        entries.push({ directoryId, filePath, extension, error: errorMsg });
        continue;
      }

      seenIds.add(extension.manifest.id);
      entries.push({
        directoryId,
        filePath,
        extension
      });
    } catch (entryErr: any) {
      const errorMsg = entryErr instanceof Error ? entryErr.message : String(entryErr);
      console.error(`[ExtensionScanner] 扫描文件异常: ${filePath}`, entryErr);
      entries.push({
        directoryId: filePath,
        filePath,
        error: errorMsg
      });
    }
  }

  return entries;
}

/**
 * 获取扫描到的所有可用 Extension 实例列表（已过滤故障项）
 */
export function scanExtensions(): WidgetExtension[] {
  return scanExtensionEntries()
    .filter((entry): entry is ScannedExtensionEntry & { extension: WidgetExtension } => Boolean(entry.extension && !entry.error))
    .map(entry => entry.extension);
}

