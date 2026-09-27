import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "mindmap",
  name: "思维导图与知识全景",
  version: "1.0.0",
  apiVersion: 1,
  description: "可视化树状思维导图，呈现核心概念、分支知识与层级脉络",
  category: "analysis",
  tags: ["思维导图", "架构", "拓扑", "路线图", "mindmap"],
  capabilities: ["mindmap_tree", "knowledge_topology", "architecture_tree"],
  intents: ["concept_explanation", "study_tutorial", "research"],
  keywords: ["思维导图", "架构", "拓扑", "知识树", "导图", "mindmap", "体系"],
  examples: ["计算机系统知识全景思维导图", "前端技术路线导图"],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 450
  },
  agent: {
    selectable: true,
    minConfidence: 0.6,
    priority: 82,
    flexible: true
  }
};
