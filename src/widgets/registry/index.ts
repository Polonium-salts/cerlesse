import { extensionRegistry, ExtensionRegistry } from "./extensionRegistry.js";
import { loadExtensions, LoadExtensionsResult } from "./extensionLoader.js";
import { scanExtensions, scanExtensionEntries } from "./extensionScanner.js";
import { getExtensionCatalog, manifestToCatalogEntry, ExtensionCatalogEntry } from "./extensionCatalog.js";
import { initExtensionSearchIndex, getExtensionSearchDb, searchExtensions } from "./extensionSearchIndex.js";

export {
  extensionRegistry,
  ExtensionRegistry,
  loadExtensions,
  scanExtensions,
  scanExtensionEntries,
  getExtensionCatalog,
  manifestToCatalogEntry,
  initExtensionSearchIndex,
  getExtensionSearchDb,
  searchExtensions,
  type ExtensionCatalogEntry,
  type LoadExtensionsResult
};

let isInitialized = false;

/**
 * 初始化系统内所有小组件扩展：
 * 自动扫描 -> 校验 Manifest -> 自动注册 -> 自动接入 Orama 索引
 */
export function initializeWidgetExtensions(options?: { force?: boolean; replace?: boolean }): ExtensionRegistry {
  if (isInitialized && !options?.force) {
    return extensionRegistry;
  }

  const loadResult = loadExtensions(undefined, extensionRegistry, {
    replace: options?.replace ?? true
  });

  // 异步建 Orama 索引，不阻塞同步主线程
  initExtensionSearchIndex().catch(err => {
    console.error("[initializeWidgetExtensions] 初始化 Orama 索引失败:", err);
  });

  isInitialized = true;
  return extensionRegistry;
}
