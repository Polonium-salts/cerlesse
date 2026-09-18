import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "download",
  name: "下载中心",
  version: "1.0.0",
  apiVersion: 1,
  description: "提供多平台安装包下载、包管理器一键安装指令、版本镜像与 SHA256 校验",
  category: "action",
  tags: [
    "下载",
    "安装包",
    "Release",
    "平台包",
    "macOS",
    "Windows",
    "Linux",
    "Docker"
  ],
  capabilities: [
    "download",
    "releases",
    "release_binary",
    "install_command",
    "package_manager",
    "official_site"
  ],
  intents: [
    "software_download",
    "github_project"
  ],
  keywords: [
    "下载",
    "安装",
    "installer",
    "dmg",
    "exe",
    "release",
    "brew",
    "npm",
    "pip",
    "curl",
    "download"
  ],
  examples: [
    "Node.js 安装包下载",
    "Docker Desktop 客户端下载",
    "VS Code macOS 与 Windows 下载"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 420
  },
  agent: {
    selectable: true,
    minConfidence: 0.75,
    priority: 95,
    flexible: true
  },
  permissions: {
    network: true,
    clipboard: true
  }
};
