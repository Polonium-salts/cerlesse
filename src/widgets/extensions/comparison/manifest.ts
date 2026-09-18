import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "comparison",
  name: "对比评测矩阵",
  version: "1.0.0",
  apiVersion: 1,
  description: "技术方案与实体横向参数评测、优缺点裁决与选型指南",
  category: "analysis",
  tags: ["对比", "矩阵", "PK", "区别", "选型", "comparison"],
  capabilities: ["compare_table", "feature_matrix", "instant_verdict"],
  intents: ["tech_comparison", "research"],
  keywords: ["对比", "区别", "vs", "versus", "哪个好", "选型", "优劣", "横评"],
  examples: ["React vs Vue 核心差异对比", "PostgreSQL 与 MySQL 选型评估"],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 400
  },
  agent: {
    selectable: true,
    minConfidence: 0.6,
    priority: 88,
    flexible: true
  }
};
