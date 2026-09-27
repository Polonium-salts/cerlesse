import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "related_links",
  name: "官网跳转 / 权威入口",
  version: "1.0.0",
  apiVersion: 1,
  description: "智能提取检索结果中的权威官方网站、产品主页与官方文档，提供安全卡片式快速跳转通道",
  category: "portal",
  tags: [
    "官方入口",
    "官网直达",
    "多链接",
    "权威信源",
    "导航",
    "外部跳转",
    "防钓鱼"
  ],
  capabilities: [
    "official_site",
    "official_url",
    "verified_docs",
    "authoritative_entry",
    "official_portal",
    "quick_links"
  ],
  intents: [
    "software_download",
    "portal_navigation",
    "tool_discovery"
  ],
  keywords: [
    "官网",
    "官方网站",
    "入口",
    "登录",
    "下载",
    "主页",
    "文档",
    "平台",
    "网址",
    "official",
    "portal"
  ],
  examples: [
    "Node.js 官方网站",
    "Docker 官方文档入口",
    "GitHub 登录直达"
  ],
  layout: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredHeight: 380
  },
  agent: {
    selectable: true,
    minConfidence: 0.6,
    priority: 85,
    flexible: true
  },
  permissions: {
    externalNavigation: true,
    clipboard: true
  }
};
