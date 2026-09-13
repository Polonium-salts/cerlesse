import { WidgetModule } from "../sdk/types.js";
import { aiAnswerModule } from "./aiAnswer.js";
import { relatedLinksModule } from "./relatedLinks.js";

/**
 * 小组件模块目录 (Widget Module Catalog)
 */
export {
  aiAnswerModule,
  relatedLinksModule
};

/** 全部小组件模块清单 */
export const OFFICIAL_WIDGET_MODULES: WidgetModule[] = [
  aiAnswerModule,
  relatedLinksModule
];


