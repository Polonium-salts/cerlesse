import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { WeatherData } from "./types.js";

export interface WeatherAdapterType extends WidgetAdapter<any, WeatherData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): WeatherData;
  validate(data: WeatherData): boolean;
}

export const weatherAdapter: WeatherAdapterType = {
  canHandle(query: string) {
    return /(天气|气象|气温|下雨|下雪|预报|weather|forecast)/i.test(query);
  },

  transform(query: string, result?: any): WeatherData {
    const q = query || result?.query || "实时天气";
    
    // 从 query 或 summary 中推断城市
    let city = "查询城市";
    const cityMatch = q.match(/(北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|重庆|香港|台北|巴黎|伦敦|纽约|东京|首尔|曼谷|悉尼|旧金山|洛杉矶|Singapore|Paris|Tokyo|London|New York|Beijing|Shanghai|Shenzhen)/i);
    if (cityMatch) {
      city = cityMatch[0];
    } else if (q.includes("天气")) {
      city = q.replace(/天气|实时|今日|预报|实时天气/g, "").trim() || "当地天气";
    }

    const temp = 22;
    const condition = q.includes("雨") ? "小雨转阴" : q.includes("雪") ? "小雪" : "晴朗微风";
    const high = 26;
    const low = 16;
    const humidity = "58%";
    const wind = "3级 东南风";
    const uv = "中等 (UV 5)";
    const airQuality = "52 良";

    const forecast = [
      { day: "今天", condition: "晴", temperature: "22° / 16°" },
      { day: "明天", condition: "多云", temperature: "24° / 17°" },
      { day: "后天", condition: "雷阵雨", temperature: "19° / 14°" },
      { day: "周四", condition: "阴天", temperature: "21° / 15°" },
      { day: "周五", condition: "晴朗", temperature: "25° / 18°" },
    ];

    return {
      location: city,
      temperature: temp,
      condition,
      high,
      low,
      humidity,
      wind,
      uv,
      airQuality,
      forecast
    };
  },

  validate(data: WeatherData): boolean {
    return Boolean(data && data.location && typeof data.temperature === "number");
  }
};
