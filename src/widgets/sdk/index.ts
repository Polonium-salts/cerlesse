import { WidgetModule } from "./types.js";

export * from "./manifest.js";
export * from "./adapter.js";
export * from "./extension.js";
export * from "./manifestValidator.js";
export * from "./types.js";
export * from "./sandbox.js";

/**
 * 声明并创建符合规范的 JS Widget 模块 (Widget Module Factory)
 */
export function createWidget<TData = any>(definition: WidgetModule<TData>): WidgetModule<TData> {
  return {
    version: "1.0.0",
    supportedWidths: [25, 50, 75, 100],
    ...definition
  };
}
