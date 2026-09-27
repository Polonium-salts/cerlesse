import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "news_feed",
  name: "时事资讯",
  version: "1.0.0",
  apiVersion: 1,
  description: "汇聚全网即时要闻、热点资讯、科技动态与时序演进摘要",
  category: "data",
  tags: [
    "新闻",
    "时事",
    "热点",
    "快讯",
    "科技资讯",
    "动态",
    "资讯流"
  ],
  capabilities: [
    "temporal_analysis",
    "temporal_evolution",
    "citation_retrieval",
    "overview_synthesis"
  ],
  intents: [
    "general_knowledge",
    "research"
  ],
  keywords: [
    "新闻",
    "资讯",
    "news",
    "时事",
    "热点",
    "最新动态",
    "快讯",
    "要闻"
  ],
  examples: [
    "AI 人工智能最新行业要闻",
    "全球开源大模型前沿发布快讯",
    "近期科技产业热点速递"
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
    priority: 81,
    flexible: true
  },
  permissions: {
    network: true
  }
};
