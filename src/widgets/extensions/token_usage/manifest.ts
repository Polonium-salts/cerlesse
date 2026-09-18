import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "token_usage",
  name: "Token 消耗统计",
  version: "1.0.0",
  apiVersion: 1,
  description: "显示本次搜索与 AI 研报生成的 Prompt、Output 及总 Token 消耗与吞吐效率",
  category: "developer",
  tags: [
    "Token",
    "消耗统计",
    "吞吐效率",
    "大模型度量",
    "成本监控",
    "性能度量"
  ],
  capabilities: [
    "agent_telemetry",
    "source_telemetry",
    "confidence_meter"
  ],
  intents: [
    "research",
    "tech_comparison"
  ],
  keywords: [
    "token",
    "消耗",
    "开销",
    "成本",
    "字数",
    "吞吐",
    "速度",
    "模型用量"
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
