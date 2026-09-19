import { WidgetModule } from "../sdk/types.js";
import { aiAnswerModule } from "./aiAnswer.js";
import { relatedLinksModule } from "./relatedLinks.js";
import { takeawaysModule } from "./takeaways.js";
import { imageGalleryModule } from "./imageGallery.js";
import { searchEngineModule } from "./searchEngine.js";
import { tokenUsageModule } from "./tokenUsage.js";
import { comparisonModule } from "./comparison.js";
import { sourcesModule } from "./sources.js";
import { mindmapModule } from "./mindmap.js";
import { actionsToolboxModule } from "./actionsToolbox.js";

/**
 * 小组件模块目录 (Widget Module Catalog)
 */
export {
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
};

/** 全部小组件模块清单 */
export const OFFICIAL_WIDGET_MODULES: WidgetModule[] = [
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
];
