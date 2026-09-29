import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "sources",
  name: "信源存证与网站直达",
  version: "1.0.0",
  apiVersion: 1,
  presence: "resident",
  description: "基于全网交叉核验的信源存证、权威认证与官方网站快捷直达通道",
  category: "synthesis",
  tags: [
    "信源溯源",
    "证据链",
    "权威认证",
    "交叉核验",
    "引用文献",
    "真实性存证"
  ],
  capabilities: [
    "evidence_chain",
    "citation_retrieval",
    "literature_archive",
    "verified_docs"
  ],
  intents: [
    "general_knowledge",
    "research",
    "concept_explanation"
  ],
  keywords: [
    "信源",
    "来源",
    "参考",
    "出处",
    "证据",
    "核验",
    "真实性"
  ],
  examples: [
    "查看本次检索引用的权威信源",
    "核验证据链与来源出处"
  ],
  layout: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 50,
    preferredHeight: 480,
    height: "auto",
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
