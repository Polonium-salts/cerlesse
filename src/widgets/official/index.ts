/**
 * 官方小组件注册入口 (Official Widget Registration Entry)
 *
 * 模块化改造后，每个官方小组件都独立定义在 ../modules/ 下的单一文件中
 * （一个文件 = 一个小组件）。本文件只承担两件事：
 *   1. 汇总并对外再导出官方小组件模块 —— 保持既有导出名不变，避免破坏调用方
 *   2. 向全局 WidgetRegistry 批量登记官方小组件
 */
import { WidgetRegistry } from "../registry.js";
import { OFFICIAL_WIDGET_MODULES } from "../modules/index.js";

// 再导出，保持 `official/index` 作为官方小组件统一入口的历史契约
export {
  OFFICIAL_WIDGET_MODULES,
  quickAnswerModule,
  aiOverviewModule,
  sourcesModule,
  mindMapModule,
  comparisonModule,
  takeawaysModule,
  actionsToolboxModule,
  metricsTelemetryModule,
  officialPortalModule,
  followUpModule,
  verificationChecklistModule,
  analyticsTrendModule,
  fastChatModule,
  mobileQRModule,
  topicDigestModule,
  agentWorkflowModule
} from "../modules/index.js";

/** 初始化并自动向注册中心登记所有官方标准小组件模块 */
export function registerAllOfficialWidgets(): void {
  WidgetRegistry.registerAll(OFFICIAL_WIDGET_MODULES);
}

// 初始化：注入「补水器」，由注册中心完成首次登记（幂等，只登记一轮）。
// 之后任何查询未命中都会自动重新登记本清单 ——
// 因此即便模块被 HMR 重建、或同一文件被不同 specifier 重复加载，
// 磁贴也不会退化成"未注册小组件"空框，而是补全后正常渲染。
// 需要手动重新登记时，调用导出的 registerAllOfficialWidgets() 即可。
WidgetRegistry.setHydrator(() => OFFICIAL_WIDGET_MODULES);
