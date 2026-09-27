/**
 * 官方小组件注册入口 (Official Widget Registration Entry)
 * 全面收敛为基于 Extension Registry 的主体系
 */
import { initializeWidgetExtensions, extensionRegistry } from "../registry/index.js";
import { createModuleFromExtension } from "../sdk/extension.js";
import type { WidgetModule } from "../sdk/types.js";

/** 初始化并自动向注册中心登记小组件模块 */
export function registerAllOfficialWidgets(): void {
  initializeWidgetExtensions();
}

/** 获取所有标准小组件模块列表 */
export function getOfficialWidgetModules(): WidgetModule[] {
  initializeWidgetExtensions();
  return extensionRegistry.getAll().map(ext => createModuleFromExtension(ext));
}
