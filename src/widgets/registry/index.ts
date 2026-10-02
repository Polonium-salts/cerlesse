import { extensionRegistry, ExtensionRegistry } from "./extensionRegistry.js";
import { loadExtensions, LoadExtensionsResult } from "./extensionLoader.js";
import { scanExtensions, scanExtensionEntries } from "./extensionScanner.js";
import { BUILTIN_WIDGET_EXTENSIONS } from "./generatedRegistry.js";
import { getExtensionCatalog, manifestToCatalogEntry, ExtensionCatalogEntry } from "./extensionCatalog.js";
import { initExtensionSearchIndex, getExtensionSearchDb, searchExtensions } from "./extensionSearchIndex.js";
import {
  getWidgetRegistryHealth,
  setWidgetRegistryHealth,
  validateWidgetRegistryConsistency,
  type WidgetRegistryHealth,
  type WidgetRegistryState
} from "./registryHealth.js";

let isInitialized = false;

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

/**
 * 初始化系统内所有小组件扩展：
 * 自动扫描 -> 校验 Manifest -> 自动注册 -> 自动接入 Orama 索引
 */
export function initializeWidgetExtensions(options?: { force?: boolean; replace?: boolean }): ExtensionRegistry {
  // 已初始化且注册中心非空：视为有效状态，直接复用。
  // 注意不能只看 isInitialized —— HMR / 并发 force 重建可能留下一个"标记已完成但内容为空"的注册中心，
  // 那种状态下后续所有查询的候选池都是 0，启用数量必然塌方。
  if (isInitialized && !options?.force && extensionRegistry.getAll().length > 0) {
    return extensionRegistry;
  }

  const loadResult = loadExtensions(undefined, extensionRegistry, {
    replace: options?.replace ?? true
  });

  // 自动扫描一条都没加载成功时，直接注入静态生成的权威清单兜底。
  // 这条路径专门覆盖 EdgeOne / Node / 打包产物里 `import.meta.glob` 不可用、
  // 而 generatedRegistry 依然持有全部扩展的情形 —— 绝不让注册中心停在空集。
  if (loadResult.loaded.length === 0) {
    console.error(
      "[WidgetRegistry] 自动扫描未加载任何小组件扩展，改用静态 BUILTIN 清单强制注入。",
      loadResult
    );
    for (const ext of BUILTIN_WIDGET_EXTENSIONS) {
      try {
        extensionRegistry.register(ext, { replace: true });
        loadResult.loaded.push(ext.manifest.id);
      } catch (err: any) {
        loadResult.failed.push({
          id: ext?.manifest?.id || "unknown",
          error: err?.message || String(err)
        });
      }
    }
  }

  setWidgetRegistryHealth({
    initialized: loadResult.loaded.length > 0,
    registeredCount: loadResult.loaded.length,
    failedCount: loadResult.failed.length,
    failedWidgets: loadResult.failed
  });

  if (loadResult.loaded.length === 0) {
    console.error(
      "[WidgetRegistry] CRITICAL: No widget extensions were loaded even after BUILTIN fallback.",
      loadResult
    );
  } else {
    console.info(
      `[WidgetRegistry] 小组件初始化完成：已注册 ${loadResult.loaded.length} 个` +
      (loadResult.failed.length > 0 ? `，失败 ${loadResult.failed.length} 个` : "，无失败项")
    );
  }

  if (loadResult.failed.length > 0) {
    console.warn(
      `[WidgetRegistry] ${loadResult.failed.length} widget(s) failed to load.`,
      loadResult.failed
    );
  }

  // 异步建 Orama 索引，不阻塞同步主线程。
  // 索引失败不影响同步注册结果：retrieveWidgets 已具备"索引不可用时降级为全量召回"的能力。
  initExtensionSearchIndex().catch(err => {
    console.error("[initializeWidgetExtensions] 初始化 Orama 索引失败（已降级为确定性召回，不影响启用数量）:", err);
  });

  isInitialized = true;
  return extensionRegistry;
}

