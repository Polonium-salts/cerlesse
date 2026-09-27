import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "software_info",
  name: "软件信息",
  version: "1.0.0",
  apiVersion: 1,
  description: "展示软件名称、版本、支持平台、开发者、开源许可证与核心规格",
  category: "data",
  tags: [
    "软件",
    "版本",
    "平台",
    "开发者",
    "许可证",
    "规格",
    "开源"
  ],
  capabilities: [
    "software_info",
    "version_history",
    "copy_text",
    "official_site",
    "license_info"
  ],
  intents: [
    "software_download",
    "github_project",
    "tool_discovery"
  ],
  keywords: [
    "软件",
    "版本",
    "开发者",
    "平台",
    "许可证",
    "license",
    "version",
    "developer",
    "software"
  ],
  examples: [
    "VS Code 软件信息",
    "Docker 版本与支持平台",
    "Node.js 运行环境与许可证"
  ],
  layout: {
    defaultWidth: 50,
    minWidth: 50,
    maxWidth: 75,
    preferredHeight: 380
  },
  agent: {
    selectable: true,
    minConfidence: 0.7,
    priority: 88,
    flexible: true
  },
  permissions: {
    network: true,
    clipboard: true
  }
};
