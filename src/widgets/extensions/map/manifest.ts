import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "map",
  name: "地理位置与地图导览",
  version: "1.0.0",
  apiVersion: 1,
  description: "展示地理位置、周边 POI 兴趣点探索、路线规划与旅行交通建议",
  category: "location",
  tags: [
    "地图",
    "地理位置",
    "POI",
    "景点",
    "导航",
    "路线规划",
    "旅行",
    "周边"
  ],
  capabilities: [
    "location_map",
    "attractions_map",
    "route_plan",
    "itinerary_timeline"
  ],
  intents: [
    "travel",
    "general_knowledge"
  ],
  keywords: [
    "地图",
    "位置",
    "地址",
    "景点",
    "路线",
    "导航",
    "交通",
    "周边",
    "map",
    "location",
    "旅游攻略"
  ],
  examples: [
    "杭州西湖旅游地图与周边景点",
    "东京新宿美食与交通路线导览",
    "北京故宫博物院参观路线与周边"
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
    priority: 85,
    flexible: true
  },
  permissions: {
    network: true,
    location: true
  }
};
