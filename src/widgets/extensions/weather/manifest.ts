import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "weather",
  name: "实时天气",
  version: "1.0.0",
  apiVersion: 1,
  description: "展示目标地区实时天气、未来预报与气象指标",
  category: "data",
  tags: [
    "天气",
    "气象",
    "气温",
    "预报",
    "降雨",
    "空气质量"
  ],
  capabilities: [
    "weather_current",
    "weather_forecast",
    "weather_indices",
    "air_quality",
    "clothing_advice"
  ],
  intents: [
    "weather",
    "travel"
  ],
  keywords: [
    "天气",
    "气象",
    "气温",
    "下雨",
    "下雪",
    "预报",
    "weather",
    "forecast"
  ],
  examples: [
    "北京今天天气",
    "上海周末天气",
    "伦敦未来三天天气"
  ],
  dataRequirements: [
    "weather"
  ],
  layout: {
    defaultWidth: 75,
    minWidth: 50,
    maxWidth: 75,
    preferredHeight: 420
  },
  agent: {
    selectable: true,
    minConfidence: 0.75
  },
  permissions: {
    network: true,
    storage: false,
    clipboard: false,
    location: false,
    externalNavigation: false
  },
  performance: {
    lazy: true,
    maxLoadMs: 1500,
    maxDataMs: 3000
  }
};
