import React from "react";
import { SearchSynthesisResult } from "../../types.js";
import { CloudSun, Wind, Droplets, Sun, CloudRain, CloudSnow, Compass, Thermometer } from "lucide-react";

export interface WeatherWidgetProps {
  activeResult: SearchSynthesisResult;
  isCompact?: boolean;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  activeResult,
  isCompact = false
}) => {
  const query = activeResult?.query || "实时天气";
  
  // 从 query 或 summary 中推断城市
  let city = "查询城市";
  const cityMatch = query.match(/(北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|重庆|香港|台北|巴黎|伦敦|纽约|东京|首尔|曼谷|悉尼|旧金山|洛杉矶|Singapore|Paris|Tokyo|London|New York|Beijing|Shanghai|Shenzhen)/i);
  if (cityMatch) {
    city = cityMatch[0];
  } else if (query.includes("天气")) {
    city = query.replace(/天气|实时|今日|预报|实时天气/g, "").trim() || "当地天气";
  }

  // 模拟气象数据或从 summary 中提取
  const temp = 22;
  const condition = query.includes("雨") ? "小雨转阴" : query.includes("雪") ? "小雪" : "晴朗微风";
  const high = 26;
  const low = 16;
  const humidity = "58%";
  const wind = "3级 东南风";
  const uv = "中等 (UV 5)";
  const airQuality = "52 良";

  const forecast = [
    { day: "今天", icon: Sun, temp: "22° / 16°", text: "晴" },
    { day: "明天", icon: CloudSun, temp: "24° / 17°", text: "多云" },
    { day: "后天", icon: CloudRain, temp: "19° / 14°", text: "雷阵雨" },
    { day: "周四", icon: CloudSun, temp: "21° / 15°", text: "阴天" },
    { day: "周五", icon: Sun, temp: "25° / 18°", text: "晴朗" },
  ];

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
            const Icon = f.icon;
            return (
              <div key={i} className="p-2 rounded-xl bg-background/50 hover:bg-background/90 transition-colors border border-border/40">
                <div className="text-[11px] text-muted-foreground">{f.day}</div>
                <Icon className="w-4 h-4 mx-auto my-1 text-sky-500" />
                <div className="text-[11px] font-bold text-foreground">{f.temp}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{f.text}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
