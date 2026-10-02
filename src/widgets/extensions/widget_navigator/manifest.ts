import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "widget_navigator",
  name: "桌面导览",
  version: "1.0.0",
  apiVersion: 1,
  presence: "conditional",
  description: "展示本次搜索桌面已加载的全部小组件，支持一键平滑滚动定位与高亮导览",
  category: "portal",
  tags: [
    "导航",
    "小组件列表",
    "快速跳转",
    "桌面导览",
    "视图总览",
    "目录大纲"
  ],
  capabilities: [
    "quick_links",
    "quick_action",
    "overview_synthesis"
  ],
  intents: [
    "portal_navigation",
    "research",
    "general_knowledge"
  ],
  keywords: [
    "导航",
    "导览",
    "目录",
    "小组件",
    "大纲",
    "跳转",
    "定位",
    "nav",
    "navigator",
    "outline"
  ],
  examples: [
    "小组件快速跳转与大纲导览",
    "多卡片视图导航"
  ],
  layout: {
    defaultWidth: 25,
    minWidth: 25,
    maxWidth: 50,
    preferredHeight: 340,
    height: "auto"
  },
  agent: {
    selectable: true,
    minConfidence: 0.6,
    priority: 85,
    flexible: true
  }
};
