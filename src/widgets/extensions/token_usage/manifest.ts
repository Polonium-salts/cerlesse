import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "token_usage",
  name: "Token 消耗统计",
  version: "1.0.0",
  apiVersion: 1,
  presence: "resident",
  description: "展示每次搜索与 Codex Agent 调用的真实 Token 消耗、吞吐速率、历史记录与全局累计监控",
  category: "developer",
  tags: [
    "Token",
    "消耗统计",
    "吞吐效率",
    "大模型度量",
    "成本监控",
    "性能度量",
    "遥测监控"
  ],
  capabilities: [
    "agent_telemetry",
    "token_telemetry",
    "cost_telemetry",
    "search_history"
  ],
  intents: [
    "research",
    "tech_comparison"
  ],
  keywords: [
    "token",
    "tokens",
    "消耗",
    "开销",
    "成本",
    "用量",
    "吞吐",
    "速度",
    "模型用量",
    "usage",
    "cost"
  ],
  examples: [
    "大模型 Token 消耗监控",
    "生成吞吐速率度量"
  ],
  layout: {
    defaultWidth: 25,
    minWidth: 25,
    maxWidth: 50,
    preferredHeight: 320
      height: "auto",
},
  agent: {
    selectable: true,
    minConfidence: 0.7,
    priority: 70,
    flexible: true
  },
  permissions: {
    clipboard: true
  }
};
