import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "search_engine",
  name: "搜索引擎直达",
  version: "1.0.0",
  apiVersion: 1,
  description: "提供主流搜索引擎（Google、Bing、百度等）快速搜索栏与一键跳转",
  category: "action",
  tags: [
    "搜索引擎",
    "搜索直达",
    "Google",
    "Bing",
    "百度",
    "外部搜索",
    "一键跳转"
  ],
  capabilities: [
    "search_engine_redirect",
    "external_search_query",
    "web_search_portal",
    "engine_launcher",
    "quick_links"
  ],
  intents: [
    "tool_discovery",
    "search_engine_portal",
    "portal_navigation"
  ],
  keywords: [
    "google",
    "bing",
    "baidu",
    "百度",
    "必应",
    "谷歌",
    "搜索引擎",
    "搜狗",
    "sogou",
    "duckduckgo",
    "360",
    "search",
    "engine"
  ],
  examples: [
    "百度一下 人工智能",
    "Google search deep learning",
    "必应检索 最新论文"
  ],
  layout: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredHeight: 280
  },
  agent: {
    selectable: true,
    minConfidence: 0.8,
    priority: 92,
    flexible: true
  },
  permissions: {
    externalNavigation: true,
    clipboard: true
  }
};
