import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "actions_toolbox",
  name: "行动工具箱",
  version: "1.0.0",
  apiVersion: 1,
  description: "一键运行 CLI、环境配置脚本、命令复制与实用工具链",
  category: "action",
  tags: ["工具", "命令", "脚本", "CLI", "actions", "toolbox"],
  capabilities: ["install_command", "fix_command", "cli_execution", "copy_text"],
  intents: ["software_download", "troubleshooting", "study_tutorial"],
  keywords: ["命令", "安装", "运行", "执行", "脚本", "command", "bash", "cli"],
  examples: ["npm install 安装命令", "Docker 启动脚本", "系统故障修复指令"],
  layout: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredHeight: 360
  },
  agent: {
    selectable: true,
    minConfidence: 0.6,
    priority: 85,
    flexible: true
  },
  permissions: {
    clipboard: true
  }
};
