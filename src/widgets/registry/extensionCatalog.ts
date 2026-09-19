import { extensionRegistry, ExtensionRegistry } from "./extensionRegistry.js";
import type { WidgetManifest } from "../sdk/manifest.js";
import { GENERATED_EXTENSION_CATALOG } from "./generatedCatalog.js";

/**
 * 纯 JSON 格式的扩展 Catalog 条目 (无任何 React/函数/DOM)
 * 供 Agent 规划与 Orama 搜索引擎专用
 */
export interface ExtensionCatalogEntry {
  id: string;
  name: string;
  version: string;
  apiVersion: number;
  description: string;
  category: string;
  tags: string[];
  capabilities: string[];
  intents: string[];
  keywords: string[];
  examples: string[];
  negativeIntents?: string[];
  requiredData?: string[];
  layout: {
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
  };
  agent?: {
    selectable?: boolean;
    minConfidence?: number;
    priority?: number;
    flexible?: boolean;
  };
}

/**
 * 从 Manifest 提取纯 JSON 的 Catalog 条目
 */
export function manifestToCatalogEntry(manifest: WidgetManifest): ExtensionCatalogEntry {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    description: manifest.description,
    category: manifest.category,
    tags: [...manifest.tags],
    capabilities: [...manifest.capabilities],
    intents: [...manifest.intents],
    keywords: [...manifest.keywords],
    examples: [...manifest.examples],
    negativeIntents: manifest.negativeIntents ? [...manifest.negativeIntents] : undefined,
    requiredData: manifest.requiredData ? [...manifest.requiredData] : undefined,
    layout: {
      defaultWidth: manifest.layout.defaultWidth,
      minWidth: manifest.layout.minWidth,
      maxWidth: manifest.layout.maxWidth
    },
    agent: manifest.agent
      ? {
          selectable: manifest.agent.selectable,
          minConfidence: manifest.agent.minConfidence,
          priority: manifest.agent.priority,
          flexible: manifest.agent.flexible
        }
      : undefined
  };
}

import { getWidgetRegistryHealth, type WidgetRegistryHealth } from "./registryHealth.js";

export { getWidgetRegistryHealth, type WidgetRegistryHealth };

import { initializeWidgetExtensions } from "./index.js";

/**
 * 从注册中心获取全部 Extension 的纯 JSON Catalog 列表（唯一真理来源：Extension Registry）
 */
export function getExtensionCatalog(
  targetRegistry: ExtensionRegistry = extensionRegistry
): ExtensionCatalogEntry[] {
  let registered = targetRegistry.getAll().map(ext => manifestToCatalogEntry(ext.manifest));
  if (registered.length > 0) {
    return registered;
  }

  // 若注册中心为空，尝试显式触发一次扩展初始化
  try {
    initializeWidgetExtensions({ force: true });
    registered = targetRegistry.getAll().map(ext => manifestToCatalogEntry(ext.manifest));
  } catch (err) {
    console.error("[WidgetCatalog] 自动触发 initializeWidgetExtensions 异常:", err);
  }

  if (registered.length > 0) {
    return registered;
  }

  // 如果初始化后依然为空，必须抛错以暴露 Registry 故障，禁止静默掩盖致使 Catalog 与 Registry 状态漂移
  console.error("[WidgetCatalog] CRITICAL: Extension Registry is empty even after initialization!");
  throw new Error(
    "[WidgetCatalog] Extension Registry is empty. Widget extension initialization failed."
  );
}


