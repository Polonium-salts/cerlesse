import type { WidgetExtension } from "../sdk/extension.js";
import { validateManifest } from "../sdk/manifestValidator.js";
import { extensionRegistry, ExtensionRegistry } from "./extensionRegistry.js";
import { scanExtensionEntries, ScannedExtensionEntry } from "./extensionScanner.js";

export interface LoadExtensionsResult {
  loaded: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * 校验并加载单个 Extension
 */
export function loadExtension(
  extension: WidgetExtension,
  targetRegistry: ExtensionRegistry = extensionRegistry,
  expectedDirectoryId?: string,
  options?: { replace?: boolean }
): void {
  if (!extension) {
    throw new Error("Extension is required");
  }
  validateManifest(extension.manifest, expectedDirectoryId);
  targetRegistry.register(extension, options);
}

/**
 * 自动扫描或批量加载 Extensions
 * 具备容灾隔离能力：单个组件校验或注册失败，绝不影响其他扩展的加载
 */
export function loadExtensions(
  extensions?: WidgetExtension[],
  targetRegistry: ExtensionRegistry = extensionRegistry,
  options?: { replace?: boolean; isDev?: boolean }
): LoadExtensionsResult {
  const result: LoadExtensionsResult = {
    loaded: [],
    failed: []
  };

  const isDev = options?.isDev ?? (typeof process !== "undefined" && process.env?.NODE_ENV !== "production");
  const allowReplace = options?.replace ?? isDev;

  // 如果没有显式传 extensions，则通过 Scanner 自动扫描发现
  if (!extensions) {
    let entries: ScannedExtensionEntry[] = [];
    try {
      entries = scanExtensionEntries();
    } catch (err: any) {
      console.error("[ExtensionLoader] 自动扫描 Extension 失败:", err);
      result.failed.push({
        id: "__scanner__",
        error: err instanceof Error ? err.message : String(err)
      });
      return result;
    }

    for (const entry of entries) {
      const id = entry.extension?.manifest?.id || entry.directoryId || "unknown";

      if (entry.error || !entry.extension) {
        const errorMsg = entry.error || "Missing extension export";
        result.failed.push({ id, error: errorMsg });
        console.error(`[WidgetExtension] ✗ ${id}: ${errorMsg}`);
        continue;
      }

      try {
        validateManifest(entry.extension.manifest, entry.directoryId);
        targetRegistry.register(entry.extension, { replace: allowReplace });
        result.loaded.push(id);
        console.log(`[WidgetExtension] ✓ ${id}`);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        result.failed.push({ id, error: errorMsg });
        console.error(`[WidgetExtension] ✗ ${id}: ${errorMsg}`);
      }
    }

    return result;
  }


  // 显式传入 extensions 的情况
  for (const ext of extensions) {
    const id = ext?.manifest?.id || "unknown";
    try {
      validateManifest(ext.manifest);
      targetRegistry.register(ext, { replace: allowReplace });
      result.loaded.push(id);
      console.log(`[WidgetExtension] ✓ ${id}`);
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      result.failed.push({ id, error: errorMsg });
      console.error(`[WidgetExtension] ✗ ${id}: ${errorMsg}`);
    }
  }

  return result;
}
