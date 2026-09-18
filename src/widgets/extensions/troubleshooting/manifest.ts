import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "troubleshooting",
  name: "故障排查与诊断指南",
  version: "1.0.0",
  apiVersion: 1,
  description: "分步式问题排查、终端命令快速复制与解决流程",
  category: "action",
  tags: [
    "排错",
    "故障",
    "诊断",
    "报错",
    "修复",
    "终端",
    "命令行",
    "troubleshooting"
  ],
  capabilities: [
    "error_diagnosis",
    "troubleshooting_audit",
    "fix_command"
  ],
  intents: [
    "troubleshooting"
  ],
  keywords: [
    "报错",
    "错误",
    "故障",
    "异常",
    "失败",
    "error",
    "failed",
    "exception",
    "fix",
    "crash"
  ],
  examples: [
    "npm install 报错怎么解决",
    "502 bad gateway 排查",
    "git merge conflict 怎么修复"
  ],
  dataRequirements: [
    "troubleshooting"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 460
  },
  agent: {
    selectable: true,
    minConfidence: 0.75
  },
  permissions: {
    clipboard: true
  }
};
