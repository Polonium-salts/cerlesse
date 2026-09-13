import { WidgetModule } from "../sdk/types.js";
import { aiAnswerModule } from "./aiAnswer.js";
import { relatedLinksModule } from "./relatedLinks.js";
import { takeawaysModule } from "./takeaways.js";
import { imageGalleryModule } from "./imageGallery.js";

/**
 * 小组件模块目录 (Widget Module Catalog)
 */
export {
  aiAnswerModule,
  relatedLinksModule,
  takeawaysModule,
  imageGalleryModule
};

/** 全部小组件模块清单 */
export const OFFICIAL_WIDGET_MODULES: WidgetModule[] = [
  aiAnswerModule,
  relatedLinksModule,
  takeawaysModule,
  imageGalleryModule
];
