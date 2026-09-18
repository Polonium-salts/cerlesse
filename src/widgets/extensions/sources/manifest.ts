import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "sources",
  name: "权威信源与存证",
  version: "1.0.0",
  apiVersion: 1,
  description: "全网引用文献溯源、权威认证标识与可信证据链",
  category: "portal",
  tags: ["信源", "文献", "引用", "存证", "sources", "citations"],
  capabilities: ["citation_retrieval", "evidence_chain", "verified_docs"],
  intents: ["research", "general_knowledge", "concept_explanation"],
  keywords: ["信源", "文献", "参考来源", "引用", "出处", "证据", "sources"],
  examples: ["AI 最新研究报告信源", "学术论文引用文献"],
  layout: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredHeight: 380
  },
  agent: {
    selectable: true,
    minConfidence: 0.5,
    priority: 85,
    flexible: true
  },
  permissions: {
    externalNavigation: true,
    clipboard: true
  }
};
