import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "trend_chart",
  name: "趋势与时序图表",
  version: "1.0.0",
  apiVersion: 1,
  description: "可视化时序趋势走势、行业增长曲线、Star 增长率与对比图表",
  category: "data",
  tags: [
    "趋势",
    "图表",
    "时序",
    "增长率",
    "走势",
    "数据可视化",
    "统计"
  ],
  capabilities: [
    "trend_signals",
    "temporal_evolution",
    "sentiment_distribution",
    "temporal_analysis"
  ],
  intents: [
    "research",
    "tech_comparison",
    "github_project"
  ],
  keywords: [
    "趋势",
    "走势",
    "图表",
    "增长",
    "数据",
    "统计",
    "chart",
    "trend",
    "历史走势"
  ],
  examples: [
    "AI 大模型关注度增长走势图",
    "React vs Vue 过去 12 个月 npm 下载量趋势",
    "GitHub Star 增长历史曲线"
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
