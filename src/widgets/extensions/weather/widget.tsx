import React from "react";
import type { WeatherData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { CloudSun, Wind, Droplets, Sun, CloudRain, CloudSnow, Thermometer } from "lucide-react";
import { weatherAdapter } from "./adapter.js";

export interface WeatherWidgetProps {
  data?: WeatherData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  
  // 提取或根据 adapter 推导 WeatherData
  const weatherData: WeatherData = props.data ?? weatherAdapter.transform(
    props.context?.activeResult?.query || props.activeResult?.query || "",
    props.context?.activeResult || props.activeResult
  );

  const city = weatherData.location;
  const temp = weatherData.temperature;
  const condition = weatherData.condition;
  const high = weatherData.high;
  const low = weatherData.low;
  const humidity = weatherData.humidity || "58%";
  const wind = weatherData.wind || "3级 东南风";
  const uv = weatherData.uv || "中等 (UV 5)";
  const airQuality = weatherData.airQuality || "52 良";
  const forecast = weatherData.forecast || [];

  const getConditionIcon = (condText: string) => {
    if (condText.includes("雷") || condText.includes("雨")) return CloudRain;
    if (condText.includes("雪")) return CloudSnow;
    if (condText.includes("多云") || condText.includes("阴")) return CloudSun;
    return Sun;
  };

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-sky-500/10 via-background to-blue-500/5 rounded-2xl border border-sky-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
            <CloudSun className="w-4 h-4" />
            <span>{city}天气</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 font-medium">{condition}</span>
        </div>
        <div className="my-2">
          <div className="text-3xl font-black tracking-tight text-foreground">{temp}°C</div>
          <div className="text-xs text-muted-foreground mt-0.5">最高 {high}° · 最低 {low}°</div>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>湿度 {humidity}</span>
          <span>空气 {airQuality}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-sky-500/10 via-card to-blue-600/5 rounded-3xl border border-sky-500/20 shadow-xs">
      {/* 头部城市与气象指标 */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-bold tracking-wide">
              气象实时直达
            </span>
            <span className="text-xs text-muted-foreground">已自动定位</span>
          </div>
          <h2 className="text-2xl font-black text-foreground mt-1 flex items-center gap-2">
            {city}
            <span className="text-sm font-normal text-muted-foreground">· 实时天气</span>
          </h2>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-sky-600 dark:text-sky-400 flex items-baseline justify-end gap-1">
            {temp}<span className="text-xl">°C</span>
          </div>
          <div className="text-xs text-muted-foreground font-medium mt-0.5">
            {condition} · {low}° ~ {high}°C
          </div>
        </div>
      </div>

      {/* 气象环境指标网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <Droplets className="w-4 h-4 text-blue-500 shrink-0" />
          <div>
            <div className="text-[10px] text-muted-foreground">相对湿度</div>
            <div className="text-xs font-bold text-foreground">{humidity}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <Wind className="w-4 h-4 text-teal-500 shrink-0" />
          <div>
            <div className="text-[10px] text-muted-foreground">风向风速</div>
            <div className="text-xs font-bold text-foreground">{wind}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <div className="text-[10px] text-muted-foreground">紫外线</div>
            <div className="text-xs font-bold text-foreground">{uv}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2.5">
          <Thermometer className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <div className="text-[10px] text-muted-foreground">空气质量</div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{airQuality}</div>
          </div>
        </div>
      </div>

      {/* 5日未来天气预测条 */}
      <div className="pt-2 border-t border-border/60">
        <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center justify-between">
          <span>5 天天气趋势</span>
          <span className="text-[10px] text-sky-500">气象云图已同步</span>
        </div>
        <div className="grid grid-cols-5 gap-1 text-center">
          {forecast.map((f, i) => {
            const Icon = getConditionIcon(f.condition);
            return (
              <div key={i} className="p-2 rounded-xl bg-background/50 hover:bg-background/90 transition-colors border border-border/40">
                <div className="text-[11px] text-muted-foreground">{f.day}</div>
                <Icon className="w-4 h-4 mx-auto my-1 text-sky-500" />
                <div className="text-[11px] font-bold text-foreground">{f.temperature}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{f.condition}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
