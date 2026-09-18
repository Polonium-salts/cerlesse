import type { WidgetManifest } from "./manifest.js";
import type { WidgetAdapter } from "./adapter.js";
import React, { type ComponentType } from "react";
import type { WidgetContext, WidgetModule } from "./types.js";
import type { TileWidth } from "../../lib/tileLayoutEngine.js";

export interface ExtensionComponentProps<TData = unknown> {
  data: TData;
  context: WidgetContext;
}

export interface WidgetExtension<TData = unknown> {
  manifest: WidgetManifest;
  component: ComponentType<ExtensionComponentProps<TData>> | ComponentType<{ data: TData; context: any }>;
  adapter?: WidgetAdapter<any, TData>;
}

/**
 * 将符合 WidgetExtension 规范的扩展适配为系统通用的 WidgetModule
 */
export function createModuleFromExtension<TData = unknown>(extension: WidgetExtension<TData>): WidgetModule<TData> {
  const { manifest, component: Component, adapter } = extension;
  const supportedWidths: TileWidth[] = [25, 50, 75, 100];
  const validSupported = supportedWidths.filter(w => {
    const min = manifest.layout?.minWidth ?? 25;
    const max = manifest.layout?.maxWidth ?? 100;
    return w >= min && w <= max;
  });

  return {
    id: manifest.id as any,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    category: manifest.category as any,
    width: (manifest.layout?.defaultWidth ?? 50) as TileWidth,
    supportedWidths: validSupported.length > 0 ? validSupported : [manifest.layout?.defaultWidth ?? 50],
    tags: manifest.tags,
    capabilities: manifest.capabilities as any,
    intents: manifest.intents as any,
    data: (activeResult: any) => {
      if (!adapter) {
        return activeResult;
      }
      const query = activeResult?.query || "";
      if (typeof adapter.canHandle === "function" && !adapter.canHandle(query, activeResult)) {
        return null;
      }
      return typeof adapter.transform === "function" ? adapter.transform(query, activeResult) : activeResult;
    },
    render: (context: WidgetContext) => {
      const data = context.data as TData;
      if (adapter && typeof adapter.validate === "function" && !adapter.validate(data)) {
        return null;
      }
      return React.createElement(Component, { data, context });
    }
  };
}

