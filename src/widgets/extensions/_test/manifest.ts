import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "test_extension",
  name: "Test Extension",
  version: "1.0.0",
  apiVersion: 1,
  description: "Widget Extension SDK 测试组件",
  category: "analysis",
  tags: ["test"],
  capabilities: ["direct_answer"],
  intents: ["general_knowledge"],
  keywords: ["test"],
  examples: ["测试组件"],
  layout: {
    defaultWidth: 50,
    minWidth: 25,
    maxWidth: 75,
    preferredHeight: 300
  },
  agent: {
    selectable: false
  },
  permissions: {
    network: false,
    storage: false,
    clipboard: false,
    location: false,
    externalNavigation: false
  }
};
