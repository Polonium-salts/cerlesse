import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "release_history",
  name: "版本历史",
  version: "1.0.0",
  apiVersion: 1,
  description: "展示软件/项目的历史版本演进、更新日志 (Changelog)、重大特性与破坏性变更",
  category: "data",
  tags: [
    "版本历史",
    "更新日志",
    "Changelog",
    "Release",
    "里程碑",
    "版本更新",
    "演进"
  ],
  capabilities: [
    "version_history",
    "releases",
    "timeline_evolution",
    "milestones",
    "history"
  ],
  intents: [
    "software_download",
    "github_project",
    "research"
  ],
  keywords: [
    "版本历史",
    "更新日志",
    "changelog",
    "releases",
    "更新了什么",
    "新特性",
    "历史版本",
    "v2",
    "v3"
  ],
  examples: [
    "React 19 更新日志与破坏性改动",
    "Next.js 历史版本演进",
    "Tailwind CSS v4 发布说明"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 400
  },
  agent: {
    selectable: true,
    minConfidence: 0.7,
    priority: 82,
    flexible: true
  },
  permissions: {
    network: true,
    clipboard: true
  }
};
