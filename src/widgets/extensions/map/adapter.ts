import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { MapWidgetData } from "./types.js";

export interface MapAdapterType extends WidgetAdapter<any, MapWidgetData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): MapWidgetData;
  validate(data: MapWidgetData): boolean;
}

export const mapAdapter: MapAdapterType = {
  canHandle(query: string) {
    return /(地图|位置|地址|景点|路线|导航|周边|旅游|攻略|交通|hotel|map|location)/i.test(query);
  },

  transform(query: string, result?: any): MapWidgetData {
    const q = query || result?.query || "探索周边";
    const loc = q.replace(/(地图|位置|地址|景点|路线|导航|周边|旅游|攻略|交通)/gi, "").trim() || "目的地";

    const pois = [
      {
        id: "poi-1",
        name: `${loc} 核心景观区`,
        category: "attraction" as const,
        address: `${loc} 中心大道 1 号`,
        rating: 4.9,
        tags: ["必游地标", "自然风光", "5A景区"],
        distance: "0 km",
        description: "核心标志性景区，四季景色宜人，配备完善的步道与导览系统。",
        openingHours: "08:00 - 18:30"
      },
      {
        id: "poi-2",
        name: "特色美食风情街",
        category: "food" as const,
        address: `${loc} 步行街东段`,
        rating: 4.7,
        tags: ["地道风味", "老字号", "夜市小吃"],
        distance: "1.2 km",
        description: "汇聚当地传统特色餐饮名店与非遗风味小吃，夜间氛围浓厚。",
        openingHours: "10:00 - 23:00"
      },
      {
        id: "poi-3",
        name: "精品度假酒店",
        category: "hotel" as const,
        address: `${loc} 湖畔路 88 号`,
        rating: 4.8,
        tags: ["景观客房", "免费接驳", "高品质早餐"],
        distance: "2.5 km",
        description: "毗邻主要景区，环境静谧雅致，提供高品质商旅与度假体验。",
        openingHours: "24 小时营业"
      },
      {
        id: "poi-4",
        name: "主轨道交通综合枢纽",
        category: "transit" as const,
        address: `${loc} 交通枢纽中心站`,
        rating: 4.6,
        tags: ["多线换乘", "高铁直达", "机场大巴"],
        distance: "3.8 km",
        description: "城市骨干交通节点，多条地铁线与城际公交便捷接驳换乘。",
        openingHours: "06:00 - 23:30"
      }
    ];

    return {
      cityOrRegion: loc,
      centerLocationName: `${loc} 地理坐标与周边导览`,
      destinationType: "热门旅游与商旅目的地",
      overviewSummary: `位于交通枢纽核心区域，周边涵盖国家级地标景区、风味美食街区与便捷的接驳轨道网络。`,
      pois,
      transportAdvice: "建议优先选用地铁与景区直通大巴出行，避开早晚高峰自驾拥堵。"
    };
  },

  validate(data: MapWidgetData): boolean {
    return Boolean(data && data.cityOrRegion && Array.isArray(data.pois) && data.pois.length > 0);
  }
};
