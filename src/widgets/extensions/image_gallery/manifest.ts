import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "image_gallery",
  name: "相关图片 / 视觉图集",
  version: "1.0.0",
  apiVersion: 1,
  description: "聚合全网检索结果中的相关图片与视觉素材，支持点击放大预览与图源溯源",
  category: "media",
  tags: [
    "相关图片",
    "图片墙",
    "视觉素材",
    "缩略图",
    "图集",
    "媒体预览",
    "配图参考"
  ],
  capabilities: [
    "image_gallery",
    "resource_preview",
    "resource_search"
  ],
  intents: [
    "resource_search",
    "travel",
    "general_knowledge",
    "software_download"
  ],
  keywords: [
    "图片",
    "照片",
    "图集",
    "壁纸",
    "素材",
    "外观",
    "长什么样",
    "截图",
    "image",
    "photo"
  ],
  examples: [
    "金门大桥实景照片",
    "东京秋叶原街景图集",
    "iPhone 16 外观配色"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 440
  },
  agent: {
    selectable: true,
    minConfidence: 0.5,
    priority: 80,
    flexible: false
  },
  permissions: {
    network: true
  }
};
