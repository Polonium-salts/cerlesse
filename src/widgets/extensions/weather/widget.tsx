import React from "react";
import type { WeatherData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { CloudSun, Wind, Droplets, Sun, CloudRain, CloudSnow, Thermometer } from "lucide-react";
import { weatherAdapter } from "./adapter.js";
import { WidgetContainer } from "../../core/WidgetContainer.js";

export interface WeatherWidgetProps {
  data?: WeatherData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
  isLoading?: boolean;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const isLoading = props.isLoading ?? false;
  
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
      <WidgetContainer
        widgetId="weather"
        size={25}
        isCompact={true}
        isLoading={isLoading}
        title={`${city}天气`}
        icon={<CloudSun className="w-4 h-4 text-sky-500" />}
        badge={
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
            {condition}
          </span>
        }
        surfaceClassName="bg-gradient-to-br from-sky-500/5 via-card to-blue-500/5"
      >
        <div className="flex flex-col justify-between h-full gap-2">
          <div className="my-1">
            <div className="text-3xl font-black tracking-tight text-foreground">{temp}°C</div>
            <div className="text-xs text-muted-foreground mt-0.5">最高 {high}° · 最低 {low}°</div>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
            <span>湿度 {humidity}</span>
            <span>空气 {airQuality}</span>
          </div>
        </div>
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer
      widgetId="weather"
      size={50}
      isCompact={false}
      isLoading={isLoading}
      title={`${city} · 实时天气`}
      icon={<CloudSun className="w-4 h-4 text-sky-500" />}
      badge={
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-bold tracking-wide">
            实时气象
          </span>
          <span className="text-xs text-muted-foreground">已自动定位</span>
        </div>
      }
      surfaceClassName="bg-gradient-to-br from-sky-500/5 via-card to-blue-600/5"
    >
      <div className="flex flex-col justify-between h-full gap-3">
        {/* 顶部气温与天气状况 */}
        <div className="flex items-baseline justify-between pt-1">
          <div className="text-xs text-muted-foreground font-medium">
            {condition} · {low}° ~ {high}°C
          </div>
          <div className="text-4xl font-black text-sky-600 dark:text-sky-400 flex items-baseline justify-end gap-1">
            {temp}<span className="text-xl font-bold">°C</span>
          </div>
        </div>

        {/* 气象环境指标网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
          <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">相对湿度</div>
              <div className="text-xs font-bold text-foreground">{humidity}</div>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2">
            <Wind className="w-4 h-4 text-teal-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">风向风速</div>
              <div className="text-xs font-bold text-foreground">{wind}</div>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">紫外线</div>
              <div className="text-xs font-bold text-foreground">{uv}</div>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">空气质量</div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{airQuality}</div>
            </div>
          </div>
        </div>

        {/* 5日未来天气预测条 */}
        <div className="pt-2 border-t border-border/60">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
            <span>5 天天气趋势</span>
            <span className="text-[10px] text-sky-500">气象云图已同步</span>
          </div>
          <div className="grid grid-cols-5 gap-1 text-center">
            {forecast.map((f, i) => {
              const Icon = getConditionIcon(f.condition);
              return (
                <div key={i} className="p-1.5 rounded-xl bg-background/50 hover:bg-background/90 transition-colors border border-border/40">
                  <div className="text-[11px] text-muted-foreground">{f.day}</div>
                  <Icon className="w-3.5 h-3.5 mx-auto my-1 text-sky-500" />
                  <div className="text-[11px] font-bold text-foreground">{f.temperature}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{f.condition}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </WidgetContainer>
  );
};
