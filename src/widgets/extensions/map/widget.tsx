import React, { useState } from "react";
import type { MapWidgetData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { mapAdapter } from "./adapter.js";
import {
  MapPin,
  Navigation,
  Compass,
  Star,
  Bus,
  Utensils,
  Hotel,
  Landmark,
  ExternalLink,
  Info,
  Clock
} from "lucide-react";

export interface MapWidgetProps {
  data?: MapWidgetData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const MapWidget: React.FC<MapWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [selectedPoiIdx, setSelectedPoiIdx] = useState<number>(0);

  const data: MapWidgetData =
    props.data ??
    mapAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const activePoi = data.pois[selectedPoiIdx] || data.pois[0];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "attraction":
        return <Landmark className="w-4 h-4 text-emerald-500" />;
      case "food":
        return <Utensils className="w-4 h-4 text-amber-500" />;
      case "hotel":
        return <Hotel className="w-4 h-4 text-blue-500" />;
      case "transit":
        return <Bus className="w-4 h-4 text-purple-500" />;
      default:
        return <MapPin className="w-4 h-4 text-emerald-500" />;
    }
  };

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-emerald-500/10 via-card to-teal-500/5 rounded-2xl border border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span className="truncate max-w-[120px]">{data.cityOrRegion} 地图</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
            {data.pois.length} 处 POI
          </span>
        </div>
        <div className="my-2">
          <div className="text-xs font-bold text-foreground truncate">{activePoi.name}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{activePoi.address}</div>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{data.transportAdvice}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-teal-500/10 via-card to-emerald-600/5 rounded-3xl border border-teal-500/20 shadow-xs">
      {/* 头部标题与导航 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 text-xs font-bold tracking-wide flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                地理导览与周边探索
              </span>
              <span className="text-xs font-bold text-foreground">{data.cityOrRegion}</span>
            </div>
            <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
              {data.centerLocationName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{data.overviewSummary}</p>
          </div>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.cityOrRegion)}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 text-xs font-semibold shadow-xs"
          >
            <span>完整地图导航</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* POI 列表与详情 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2">
          {/* POI 切换列表 */}
          <div className="space-y-1.5">
            {data.pois.map((poi, idx) => (
              <button
                key={poi.id}
                onClick={() => setSelectedPoiIdx(idx)}
                className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2 border ${
                  selectedPoiIdx === idx
                    ? "bg-teal-500/15 border-teal-500/40 text-teal-700 dark:text-teal-300 shadow-xs"
                    : "bg-background/60 hover:bg-background border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getCategoryIcon(poi.category)}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">{poi.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{poi.address}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-bold text-amber-500 flex items-center gap-0.5 justify-end">
                    <Star className="w-3 h-3 fill-amber-500" />
                    <span>{poi.rating}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{poi.distance}</div>
                </div>
              </button>
            ))}
          </div>

          {/* 选中的 POI 卡片详情与路线推荐 */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-border/60 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{activePoi.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold">
                      {activePoi.distance}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{activePoi.address}</div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                {activePoi.description}
              </p>

              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                {activePoi.tags?.map((tag, ti) => (
                  <span
                    key={ti}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-teal-500" />
                营业: {activePoi.openingHours}
              </span>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activePoi.name + " " + activePoi.address)}`}
                target="_blank"
                rel="noreferrer"
                className="text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-0.5"
              >
                <span>规划路线</span>
                <Navigation className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 底部出行建议 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>💡 交通建议: {data.transportAdvice}</span>
        <span className="text-teal-600 dark:text-teal-400 font-medium">周边精准定位</span>
      </div>
    </div>
  );
};
