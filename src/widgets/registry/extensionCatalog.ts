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

/**
 * 从注册中心获取全部 Extension 的纯 JSON Catalog 列表（优先 Extension Registry，Node 环境兜底静态生成清单）
 */
export function getExtensionCatalog(
  targetRegistry: ExtensionRegistry = extensionRegistry
): ExtensionCatalogEntry[] {
  const registered = targetRegistry.getAll().map(ext => manifestToCatalogEntry(ext.manifest));
  if (registered.length > 0) {
    return registered;
  }

  // 浏览器开发环境（Vite DEV）或显式声明严格模式下，若扩展注册中心为空，直接抛错以便快速暴露初始化故障，禁止静默掩盖
  const isDevBrowser = typeof window !== "undefined" && Boolean((import.meta as any)?.env?.DEV);
  const isStrict = process.env.CERLESSE_STRICT_CATALOG === "true";

  if (isDevBrowser || isStrict) {
    throw new Error(
      "[WidgetCatalog] Extension Registry is empty. Widget extension initialization failed."
    );
  }

  return GENERATED_EXTENSION_CATALOG;
}


