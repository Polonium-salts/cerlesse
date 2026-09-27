import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "takeaways",
  name: "核心要点 / 结论速览",
  version: "1.0.0",
  apiVersion: 1,
  description: "高密度条目式核心结论提炼，支持逐条勾选并本地记忆掌握进度",
  category: "synthesis",
  tags: [
    "核心要点",
    "结论提炼",
    "速记清单",
    "关键洞察",
    "要点速览"
  ],
  capabilities: [
    "bullet_conclusions",
    "high_density_takeaways",
    "summary_points"
  ],
  intents: [
    "research",
    "tech_comparison",
    "study_tutorial",
    "general_knowledge"
  ],
  keywords: [
    "要点",
    "核心",
    "结论",
    "速览",
    "总结",
    "提炼",
    "洞察",
    "摘录",
    "干货",
    "takeaways"
  ],
  examples: [
    "量子计算核心突破要点",
    "2024 AI 趋势关键结论",
    "Rust 语言核心优势"
  ],
  layout: {
    defaultWidth: 25,
    minWidth: 25,
    maxWidth: 50,
    preferredHeight: 320
  },
  agent: {
    selectable: true,
    minConfidence: 0.6,
    priority: 84,
    flexible: true
  },
  permissions: {
    storage: true,
    clipboard: true
  }
};
