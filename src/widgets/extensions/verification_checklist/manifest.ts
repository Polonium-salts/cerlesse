import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "verification_checklist",
  name: "排查与核验清单",
  version: "1.0.0",
  apiVersion: 1,
  description: "故障诊断、环境依赖检查与实操交互式核验避坑清单",
  category: "action",
  tags: [
    "排查",
    "诊断",
    "核验",
    "清单",
    "checklist",
    "troubleshooting"
  ],
  capabilities: [
    "verification_checklist",
    "prerequisites_check"
  ],
  intents: [
    "troubleshooting"
  ],
  keywords: [
    "核验",
    "清单",
    "检查",
    "checklist",
    "verification",
    "排查清单",
    "避坑"
  ],
  examples: [
    "上线发布前核验清单",
    "Node.js 环境安装核查清单",
    "服务崩溃排查检查表"
  ],
  dataRequirements: [
    "verification_checklist"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 100,
    preferredHeight: 400
  },
  agent: {
    selectable: true,
    minConfidence: 0.75
  },
  permissions: {
    clipboard: false,
    storage: false
  }
};
