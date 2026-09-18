/**
 * 官方小组件注册入口 (Official Widget Registration Entry)
 * 当前系统加载与登记的官方小组件全部模块
 */
import { WidgetRegistry } from "../registry.js";
import { OFFICIAL_WIDGET_MODULES } from "../modules/index.js";

// 再导出，保持作为官方小组件统一入口的契约
export {
  OFFICIAL_WIDGET_MODULES,
  aiAnswerModule,
  relatedLinksModule,
  takeawaysModule,
  imageGalleryModule,
  searchEngineModule,
  tokenUsageModule,
  comparisonModule,
  sourcesModule,
  mindmapModule,
  actionsToolboxModule
} from "../modules/index.js";

/** 初始化并自动向注册中心登记小组件模块 */
export function registerAllOfficialWidgets(): void {
  WidgetRegistry.registerAll(OFFICIAL_WIDGET_MODULES);
}

WidgetRegistry.setHydrator(() => OFFICIAL_WIDGET_MODULES);
