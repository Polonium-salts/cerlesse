/**
 * 官方小组件注册入口 (Official Widget Registration Entry)
 * 当前系统加载与登记的官方小组件：官网跳转、AI 智能回答、核心要点、相关图片
 */
import { WidgetRegistry } from "../registry.js";
import { OFFICIAL_WIDGET_MODULES } from "../modules/index.js";

// 再导出，保持作为官方小组件统一入口的契约
export {
  OFFICIAL_WIDGET_MODULES,
  aiAnswerModule,
  relatedLinksModule,
  takeawaysModule,
  imageGalleryModule
} from "../modules/index.js";

/** 初始化并自动向注册中心登记小组件模块 */
export function registerAllOfficialWidgets(): void {
  WidgetRegistry.registerAll(OFFICIAL_WIDGET_MODULES);
}

WidgetRegistry.setHydrator(() => OFFICIAL_WIDGET_MODULES);
