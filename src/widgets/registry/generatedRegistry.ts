/**
 * 该文件由 scripts/widgets/generate.ts 自动构建生成
 * 严禁手动修改！静态引入所有合法扩展，确保生产环境、Node、EdgeOne 等无缝加载。
 */
import type { WidgetExtension } from "../sdk/extension.js";
import Test from "../extensions/_test/index.js";
import actionsToolbox from "../extensions/actions_toolbox/index.js";
import aiAnswer from "../extensions/ai_answer/index.js";
import codePlayground from "../extensions/code_playground/index.js";
import comparison from "../extensions/comparison/index.js";
import documentPreview from "../extensions/document_preview/index.js";
import download from "../extensions/download/index.js";
import imageGallery from "../extensions/image_gallery/index.js";
import map from "../extensions/map/index.js";
import mindmap from "../extensions/mindmap/index.js";
import newsFeed from "../extensions/news_feed/index.js";
import relatedLinks from "../extensions/related_links/index.js";
import releaseHistory from "../extensions/release_history/index.js";
import repository from "../extensions/repository/index.js";
import searchEngine from "../extensions/search_engine/index.js";
import softwareInfo from "../extensions/software_info/index.js";
import sources from "../extensions/sources/index.js";
import takeaways from "../extensions/takeaways/index.js";
import tokenUsage from "../extensions/token_usage/index.js";
import toolDiscovery from "../extensions/tool_discovery/index.js";
import translation from "../extensions/translation/index.js";
import trendChart from "../extensions/trend_chart/index.js";
import troubleshooting from "../extensions/troubleshooting/index.js";
import verificationChecklist from "../extensions/verification_checklist/index.js";
import weather from "../extensions/weather/index.js";

export const BUILTIN_WIDGET_EXTENSIONS: WidgetExtension<any>[] = [
  Test,
  actionsToolbox,
  aiAnswer,
  codePlayground,
  comparison,
  documentPreview,
  download,
  imageGallery,
  map,
  mindmap,
  newsFeed,
  relatedLinks,
  releaseHistory,
  repository,
  searchEngine,
  softwareInfo,
  sources,
  takeaways,
  tokenUsage,
  toolDiscovery,
  translation,
  trendChart,
  troubleshooting,
  verificationChecklist,
  weather
].filter((ext): ext is WidgetExtension<any> => Boolean(ext && ext?.manifest?.id));
