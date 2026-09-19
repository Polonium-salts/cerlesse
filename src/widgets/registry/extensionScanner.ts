import type { WidgetExtension } from "../sdk/extension.js";
import { BUILTIN_WIDGET_EXTENSIONS } from "./generatedRegistry.js";

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
 * 具备双重保证：
 * 1. Vite 运行时 import.meta.glob 自动感应
 * 2. 静态生成的 BUILTIN_WIDGET_EXTENSIONS 兜底，确保 Node、EdgeOne、构建打包后零丢失
 */
export function scanExtensionEntries(): ScannedExtensionEntry[] {
  const entries: ScannedExtensionEntry[] = [];
  const seenIds = new Set<string>();

  // 1. 优先通过 Vite import.meta.glob 扫描
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

  // 2. 补全：加入静态生成的 BUILTIN_WIDGET_EXTENSIONS（补充 glob 未覆盖到的项）
  if (Array.isArray(BUILTIN_WIDGET_EXTENSIONS)) {
    for (const ext of BUILTIN_WIDGET_EXTENSIONS) {
      if (ext && ext.manifest && ext.manifest.id && !seenIds.has(ext.manifest.id)) {
        seenIds.add(ext.manifest.id);
        entries.push({
          directoryId: ext.manifest.id,
          filePath: `../extensions/${ext.manifest.id}/index.ts`,
          extension: ext
        });
      }
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

