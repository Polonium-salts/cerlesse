import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "repository",
  name: "开源代码库",
  version: "1.0.0",
  apiVersion: 1,
  description: "展示 GitHub/GitLab 仓库详情、Star/Fork 统计、语言构成、快速克隆指令与健康度",
  category: "data",
  tags: [
    "GitHub",
    "GitLab",
    "代码仓库",
    "Star",
    "Fork",
    "开源项目",
    "git clone",
    "开源"
  ],
  capabilities: [
    "git_clone",
    "software_info",
    "trend_signals",
    "copy_text",
    "verified_docs"
  ],
  intents: [
    "github_project",
    "study_tutorial",
    "software_download"
  ],
  keywords: [
    "github",
    "gitlab",
    "repo",
    "repository",
    "开源",
    "star",
    "git clone",
    "代码库",
    "源码"
  ],
  examples: [
    "facebook/react GitHub 仓库",
    "vercel/next.js 代码库与 Star 趋势",
    "tailwindlabs/tailwindcss 开源项目"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 380
  },
  agent: {
    selectable: true,
    minConfidence: 0.75,
    priority: 86,
    flexible: true
  },
  permissions: {
    network: true,
    clipboard: true
  }
};
