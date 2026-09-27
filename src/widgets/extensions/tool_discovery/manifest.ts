import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "tool_discovery",
  name: "工具发现与替代品",
  version: "1.0.0",
  apiVersion: 1,
  description: "发现精选效能工具、竞品与开源替代方案，包含价格模型与核心优势对比",
  category: "portal",
  tags: [
    "工具",
    "替代品",
    "竞品",
    "开源替代",
    "生产力",
    "SaaS",
    "推荐",
    "发现"
  ],
  capabilities: [
    "tool_cards",
    "try_online",
    "software_directory",
    "free_tool",
    "pricing_comparison"
  ],
  intents: [
    "tool_discovery",
    "software_download",
    "tech_comparison"
  ],
  keywords: [
    "工具",
    "替代品",
    "alternative",
    "推荐",
    "好用",
    "开源替代",
    "竞品",
    "类似软件"
  ],
  examples: [
    "Notion 开源替代品推荐",
    "Figma 替代设计工具",
    "Postman 现代化 API 测试工具发现"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 400
  },
  agent: {
    selectable: true,
    minConfidence: 0.72,
    priority: 84,
    flexible: true
  },
  permissions: {
    network: true
  }
};
