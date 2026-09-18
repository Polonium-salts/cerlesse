import { extensionRegistry, ExtensionRegistry } from "./extensionRegistry.js";
import type { WidgetManifest } from "../sdk/manifest.js";

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

/**
 * 从注册中心获取全部 Extension 的纯 JSON Catalog 列表
 */
export function getExtensionCatalog(
  targetRegistry: ExtensionRegistry = extensionRegistry
): ExtensionCatalogEntry[] {
  return targetRegistry.getAll().map(ext => manifestToCatalogEntry(ext.manifest));
}
