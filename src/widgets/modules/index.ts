import { WidgetModule } from "../sdk/types.js";

/**
 * 官方小组件模块目录 (Official Widget Module Catalog)
 *
 * 模块化约定：**一个文件即一个小组件**。
 * 每个小组件模块（元信息 + 尺寸规格 + 磁贴主题 + 正/背面渲染）都独立定义在
 * 本目录下的单一文件中，本文件只负责把散落的单文件小组件汇聚成清单，
 * 便于注册中心批量登记，也便于按需增删而不牵动其它小组件。
 */
import { quickAnswerModule } from "./quickAnswer.js";
import { aiOverviewModule } from "./aiOverview.js";
import { sourcesModule } from "./sources.js";
import { mindMapModule } from "./mindMap.js";
import { comparisonModule } from "./comparison.js";
import { takeawaysModule } from "./takeaways.js";
import { actionsToolboxModule } from "./actionsToolbox.js";
import { metricsTelemetryModule } from "./metricsTelemetry.js";
import { officialPortalModule } from "./officialPortal.js";
import { followUpModule } from "./followUp.js";
import { verificationChecklistModule } from "./verificationChecklist.js";
import { analyticsTrendModule } from "./analyticsTrend.js";
import { fastChatModule } from "./fastChat.js";
import { mobileQRModule } from "./mobileQR.js";
import { topicDigestModule } from "./topicDigest.js";
import { agentWorkflowModule } from "./agentWorkflow.js";

export {
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
};

/** 全部官方标准小组件模块清单（新增小组件只需在末尾追加一项） */
export const OFFICIAL_WIDGET_MODULES: WidgetModule[] = [
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
];
