import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "ai_answer",
  name: "AI 智能回答",
  version: "1.0.0",
  apiVersion: 1,
  description: "基于全网信源的 AI 深度结构化回答、要点提炼与智能拓展追问",
  category: "synthesis",
  tags: [
    "AI回答",
    "全网总结",
    "深度要点",
    "问答",
    "结论",
    "知识综合",
    "多信源提炼"
  ],
  capabilities: [
    "direct_answer",
    "definition_snippet",
    "instant_verdict",
    "overview_synthesis",
    "summary_points",
    "bullet_conclusions",
    "high_density_takeaways"
  ],
  intents: [
    "concept_explanation",
    "research",
    "general_knowledge",
    "study_tutorial",
    "tech_comparison"
  ],
  keywords: [
    "是什么",
    "为什么",
    "如何",
    "总结",
    "分析",
    "原理",
    "介绍",
    "概况",
    "解释",
    "含义",
    "核心要点"
  ],
  examples: [
    "什么是量子退火算法",
    "光伏发电原理与应用",
    "React 和 Vue 核心理念解析"
  ],
  layout: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 100,
    preferredHeight: 480
  },
  agent: {
    selectable: true,
    minConfidence: 0.5,
    priority: 95,
    flexible: true
  },
  permissions: {
    clipboard: true
  }
};
