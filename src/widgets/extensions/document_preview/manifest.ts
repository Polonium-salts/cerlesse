import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "document_preview",
  name: "文档速览与研报",
  version: "1.0.0",
  apiVersion: 1,
  description: "快速预览技术规范、PDF 研报、Markdown 手册与学术证据链摘要",
  category: "data",
  tags: [
    "文档",
    "预览",
    "PDF",
    "Markdown",
    "研报",
    "文献",
    "规范",
    "摘要"
  ],
  capabilities: [
    "verified_docs",
    "literature_archive",
    "citation_retrieval",
    "evidence_chain"
  ],
  intents: [
    "research",
    "concept_explanation",
    "study_tutorial"
  ],
  keywords: [
    "文档",
    "预览",
    "pdf",
    "markdown",
    "论文",
    "白皮书",
    "研报",
    "规范",
    "rfc",
    "手册"
  ],
  examples: [
    "TypeScript 5.0 规范白皮书速览",
    "深度学习模型论文摘要与证据链",
    "RFC 9110 HTTP 语义规范预览"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 420
  },
  agent: {
    selectable: true,
    minConfidence: 0.72,
    priority: 83,
    flexible: true
  },
  permissions: {
    network: true,
    clipboard: true
  }
};
