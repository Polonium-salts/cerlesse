import { getExtensionCatalog } from "../../src/widgets/registry/extensionCatalog.js";
import { getWidgetLayoutMeta } from "../../src/widgets/manifests/index.js";

export interface WidgetCatalogEntry {
  id: string;
  name: string;
  category: string;
  capabilities: string[];
  supportedWidths: number[];
  layout: {
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
    preferredRoles: string[];
    canPairWith?: string[];
    avoidPairWith?: string[];
  };
  dataRequirements: string[];
  intents: string[];
  keywords: string[];
  examples: string[];
  negativeIntents: string[];
  selectable: boolean;
  minConfidence: number;
  actions?: string[];
  description: string;
}

export interface PrepareWidgetInput {
  widgetId: string;
  query: string;
  sourceIds?: string[];
  params?: Record<string, unknown>;
}

export interface PreparedWidgetOutput {
  success: boolean;
  widgetId: string;
  name: string;
  category: string;
  defaultWidth: number;
  sourceIds: string[];
  params: Record<string, unknown>;
  error?: string;
}

/**
 * get_widget_catalog: 获取小组件注册中心所有合法组件
 */
export function getWidgetCatalogTool(): WidgetCatalogEntry[] {
  const catalog = getExtensionCatalog();
  return catalog.map(entry => {
    const layoutMeta = getWidgetLayoutMeta(entry.id);
    const min = layoutMeta.minWidth || entry.layout?.minWidth || 25;
    const max = layoutMeta.maxWidth || entry.layout?.maxWidth || 100;
    const def = layoutMeta.defaultWidth || entry.layout?.defaultWidth || 50;

    const supportedWidths: number[] = [];
    for (const w of [25, 50, 75, 100]) {
      if (w >= min && w <= max) {
        supportedWidths.push(w);
      }
    }
    if (!supportedWidths.includes(def)) {
      supportedWidths.push(def);
      supportedWidths.sort((a, b) => a - b);
    }

    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      capabilities: entry.capabilities,
      supportedWidths,
      layout: {
        defaultWidth: def,
        minWidth: min,
        maxWidth: max,
        preferredRoles: layoutMeta.preferredRoles || ["primary", "secondary"],
        canPairWith: layoutMeta.canPairWith || [],
        avoidPairWith: layoutMeta.avoidPairWith || []
      },
      dataRequirements: entry.requiredData || [],
      intents: entry.intents,
      keywords: entry.keywords,
      examples: entry.examples,
      negativeIntents: entry.negativeIntents || [],
      selectable: entry.agent?.selectable !== false,
      minConfidence: entry.agent?.minConfidence ?? 0.5,
      actions: entry.tags,
      description: entry.description
    };
  });
}

/**
 * prepare_widget: 实例化与绑定准备指定小组件
 * 强制校验：widgetId 必须来自 Registry。
 */
export function prepareWidgetTool(input: PrepareWidgetInput): PreparedWidgetOutput {
  const catalog = getExtensionCatalog();
  const entry = catalog.find(e => e.id === input.widgetId);

  if (!entry) {
    return {
      success: false,
      widgetId: input.widgetId,
      name: "Unknown Widget",
      category: "custom",
      defaultWidth: 50,
      sourceIds: input.sourceIds || [],
      params: input.params || {},
      error: `Widget ID "${input.widgetId}" is not registered in the Cerlesse Widget Registry.`
    };
  }

  return {
    success: true,
    widgetId: entry.id,
    name: entry.name,
    category: entry.category,
    defaultWidth: entry.layout?.defaultWidth ?? 50,
    sourceIds: input.sourceIds || [],
    params: {
      query: input.query,
      ...(input.params || {})
    }
  };
}
