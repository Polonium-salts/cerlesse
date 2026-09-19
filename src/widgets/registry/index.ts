import { extensionRegistry, ExtensionRegistry } from "./extensionRegistry.js";
import { loadExtensions, LoadExtensionsResult } from "./extensionLoader.js";
import { scanExtensions, scanExtensionEntries } from "./extensionScanner.js";
import { getExtensionCatalog, manifestToCatalogEntry, ExtensionCatalogEntry } from "./extensionCatalog.js";
import { initExtensionSearchIndex, getExtensionSearchDb, searchExtensions } from "./extensionSearchIndex.js";
import {
  getWidgetRegistryHealth,
  setWidgetRegistryHealth,
  validateWidgetRegistryConsistency,
  type WidgetRegistryHealth,
  type WidgetRegistryState
} from "./registryHealth.js";

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
  getWidgetRegistryHealth,
  validateWidgetRegistryConsistency,
  type ExtensionCatalogEntry,
  type LoadExtensionsResult,
  type WidgetRegistryHealth,
  type WidgetRegistryState
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

  setWidgetRegistryHealth({
    initialized: loadResult.loaded.length > 0,
    registeredCount: loadResult.loaded.length,
    failedCount: loadResult.failed.length,
    failedWidgets: loadResult.failed
  });

  if (loadResult.loaded.length === 0) {
    console.error(
      "[WidgetRegistry] No widget extensions were loaded.",
      loadResult
    );
  }

  if (loadResult.failed.length > 0) {
    console.warn(
      `[WidgetRegistry] ${loadResult.failed.length} widget(s) failed to load.`,
      loadResult.failed
    );
  }

  // 异步建 Orama 索引，不阻塞同步主线程
  initExtensionSearchIndex().catch(err => {
    console.error("[initializeWidgetExtensions] 初始化 Orama 索引失败:", err);
  });

  isInitialized = true;
  return extensionRegistry;
}

