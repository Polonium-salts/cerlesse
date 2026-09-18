import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "code_playground",
  name: "代码演练场",
  version: "1.0.0",
  apiVersion: 1,
  description: "提供交互式代码编辑、即时运行控制台、多语言代码片段与控制台输出模拟",
  category: "developer",
  tags: [
    "代码",
    "运行",
    "Playground",
    "TypeScript",
    "Python",
    "调试",
    "Console",
    "语法高亮"
  ],
  capabilities: [
    "code_snippet",
    "code_run",
    "copy_text",
    "cli_execution"
  ],
  intents: [
    "study_tutorial",
    "troubleshooting",
    "concept_explanation"
  ],
  keywords: [
    "代码",
    "运行",
    "playground",
    "code",
    "snippet",
    "调试",
    "控制台",
    "输出",
    "示例代码"
  ],
  examples: [
    "JavaScript 异步并发控制代码运行",
    "Python 列表推导式与数据处理示例",
    "TypeScript 泛型与条件类型演练"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 75,
    maxWidth: 100,
    preferredHeight: 440
  },
  agent: {
    selectable: true,
    minConfidence: 0.7,
    priority: 85,
    flexible: true
  },
  permissions: {
    clipboard: true
  }
};
