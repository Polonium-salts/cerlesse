import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { MapWidgetData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { mapAdapter } from "./adapter.js";
import { WidgetContainer } from "../../core/WidgetContainer.js";
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
  Clock
} from "lucide-react";

export interface MapWidgetProps {
  data?: MapWidgetData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

const SKETCH_TILE =
  "linear-gradient(135deg, #eef3f8 0%, #e3eaf2 100%)";

function isBrowserWithWindow(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export const MapWidget: React.FC<MapWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [selectedPoiIdx, setSelectedPoiIdx] = useState<number>(0);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const realMapSupported = useRef<boolean | null>(null);

  const data: MapWidgetData =
    props.data ??
    mapAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const activePoi = data.pois[selectedPoiIdx] || data.pois[0];

  const sketchMarkers = useMemo(() => {
    const items = data.pois.map((poi, idx) => {
      const x = 18 + (idx * 22) % 64;
      const y = 26 + (idx * 13) % 34;
      return { poi, idx, x, y };
    });
    return items;
  }, [data.pois]);

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

  // Resolve center from region name or query, with a Beijing fallback.
  const resolvedCenter = useMemo(() => {
    const KNOWN_REGION_CENTERS: Record<string, [number, number]> = {
      杭州: [30.2741, 120.1551],
      东京: [35.6762, 139.6503],
      北京: [39.9042, 116.4074],
      上海: [31.2304, 121.4737],
      广州: [23.1291, 113.2644],
      西湖: [30.2741, 120.1551],
      故宫: [39.9163, 116.3972],
    };
    const haystack = `${data.cityOrRegion} ${props.context?.activeResult?.query || props.activeResult?.query || ""}`.trim();
    for (const [key, center] of Object.entries(KNOWN_REGION_CENTERS)) {
      if (haystack.includes(key)) {
        return center;
      }
    }
    return [39.9042, 116.4074] as [number, number];
  }, [data.cityOrRegion, props.context?.activeResult?.query, props.activeResult?.query]);

  useEffect(() => {
    if (!isBrowserWithWindow()) {
      realMapSupported.current = false;
      return;
    }

    // Feature-detect Leaflet availability and window geometry primitives at render time.
    const leafletOk =
      typeof (window as any).L !== "undefined" &&
      typeof (window as any).L.map === "function" &&
      typeof (window as any).L.tileLayer === "function" &&
      typeof window.requestAnimationFrame === "function";

    realMapSupported.current = leafletOk;
  }, []);

  useEffect(() => {
    if (!isBrowserWithWindow()) {
      return;
    }

    const leafletModule = (window as any).L;
    if (typeof leafletModule === "undefined" || typeof leafletModule.map !== "function") {
      return;
    }

    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    const map = leafletModule.map(mapRef.current, {
      center: resolvedCenter,
      zoom: 11,
      attributionControl: false,
    });

    leafletModule.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (map && typeof map.remove === "function") {
        map.remove();
      }
      mapInstanceRef.current = null;
    };
  }, [resolvedCenter]);

  useEffect(() => {
    const leafletModule = (window as any).L;
    const map = mapInstanceRef.current;
    if (!map || typeof leafletModule === "undefined") {
      return;
    }

    markersRef.current.forEach((m) => {
      if (typeof m.remove === "function") {
        m.remove();
      }
    });
    markersRef.current = [];

    data.pois.forEach((poi, idx) => {
      if (poi.lat == null || poi.lng == null) return;
      const marker = leafletModule.marker([poi.lat, poi.lng], {
        title: poi.name,
      })
        .addTo(map)
        .bindTooltip(poi.name, { sticky: true, direction: "top" });

      if (idx === selectedPoiIdx) {
        if (typeof marker.openTooltip === "function") {
          marker.openTooltip();
        }
      }

      marker.on("click", () => {
        setSelectedPoiIdx(idx);
      });

      markersRef.current.push(marker);
    });

    if (data.pois.length > 0 && data.pois[selectedPoiIdx]?.lat != null) {
      const target = data.pois[selectedPoiIdx];
      if (typeof map.setView === "function") {
        map.setView([target.lat, target.lng], 13, { animate: true });
      }
    }
  }, [data.pois, selectedPoiIdx]);

  const handlePoiSelect = useCallback(
    (idx: number) => {
      setSelectedPoiIdx(idx);
    },
    []
  );

  if (isCompact) {
    return (
      <WidgetContainer
        widgetId="map"
        size={25}
        isCompact={true}
        title={`${data.cityOrRegion} 地图`}
        icon={<MapPin className="w-4 h-4 text-emerald-500" />}
        badge={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
            {data.pois.length} 处 POI
          </span>
        }
        surfaceClassName="bg-gradient-to-br from-emerald-500/5 via-card to-teal-500/5"
      >
        <div className="flex flex-col justify-between h-full gap-2">
          <div className="my-1">
            <div className="text-xl font-black tracking-tight text-foreground">
              {activePoi.name}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {activePoi.address}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
            <span>{data.transportAdvice}</span>
          </div>
        </div>
      </WidgetContainer>
    );
  }

  const showRealMap = useRef<boolean>(false);
  useEffect(() => {
    showRealMap.current = realMapSupported.current === true;
  }, [realMapSupported.current]);
  useEffect(() => {
    void realMapSupported.current;
  }, [data.pois, selectedPoiIdx]);

  return (
    <WidgetContainer
      widgetId="map"
      size={75}
      isCompact={false}
      title={`${data.cityOrRegion} · 地理导览`}
      icon={<Compass className="w-4 h-4 text-emerald-500" />}
      badge={
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide">
            周边探索
          </span>
          <span className="text-xs text-muted-foreground">
            {realMapSupported.current ? "已加载实时地图" : "已加载示意地图"}
          </span>
        </div>
      }
      surfaceClassName="bg-gradient-to-br from-emerald-500/5 via-card to-teal-600/5"
    >
      <div className="flex flex-col justify-between h-full gap-3">
        {/* 头部标题与导航 */}
        <div>
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  地理导览与周边探索
                </span>
                <span className="text-xs font-bold text-foreground">
                  {data.cityOrRegion}
                </span>
              </div>
              <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
                {data.centerLocationName}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.overviewSummary}
              </p>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.cityOrRegion)}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <span>完整地图导航</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* 地图区域 */}
          <div className="relative rounded-2xl overflow-hidden border border-border/50 h-56 mt-1">
            {realMapSupported.current ? (
              <div ref={mapRef} className="w-full h-full" />
            ) : (
              <svg
                viewBox="0 0 120 80"
                className="w-full h-full"
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 地块底色 */}
                <rect x="0" y="0" width="120" height="80" fill={SKETCH_TILE} />

                {/* 次级水系示意 */}
                <path
                  d="M0,60 C 30,56 70,62 120,58"
                  stroke="#9fb6c9"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <path
                  d="M10,28 C 40,22 80,30 110,24"
                  stroke="#9fb6c9"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.4"
                />

                {/* 街道网格示意 */}
                <g stroke="#9aa7b4" strokeWidth="0.6" opacity="0.5">
                  {[12,24,36,48,60,72,84,96,108].map((x) => (
                    <line key={`v${x}`} x1={x} y1="0" x2={x} y2="80" />
                  ))}
                  {[10,20,30,40,50,60,70,80,90,100,110].map((y) => (
                    <line key={`h${y}`} x1="0" y1={y} x2="120" y2={y} />
                  ))}
                </g>

                {/* 道路粗线示意 */}
                <path
                  d="M24,0 L 24,80"
                  stroke="#7f8c96"
                  strokeWidth="2"
                  opacity="0.7"
                />
                <path
                  d="M84,0 L 84,80"
                  stroke="#7f8c96"
                  strokeWidth="2"
                  opacity="0.7"
                />
                <path
                  d="M0,40 L 120,40"
                  stroke="#7f8c96"
                  strokeWidth="2"
                  opacity="0.7"
                />

                {/* 标注文字：虚拟坐标与区域名 */}
                <text x="6" y="10" fontSize="5" fill="#5b6b76" fontFamily="monospace">
                  39.90°N 116.41°E
                </text>
                <text x="92" y="10" fontSize="5" fill="#5b6b76" fontFamily="monospace">
                  核心城区
                </text>

                {/* POI 标记 */}
                {sketchMarkers.map(({ poi, idx, x, y }) => {
                  const isSelected = idx === selectedPoiIdx;
                  return (
                    <g key={poi.id}>
                      {/* 选择环 */}
                      {isSelected && (
                        <circle
                          cx={x}
                          cy={y}
                          r="7"
                          fill="none"
                          stroke="#0f766e"
                          strokeWidth="1.2"
                          opacity="0.9"
                        />
                      )}
                      {/* 热力小脉冲 */}
                      {isSelected && (
                        <circle
                          cx={x}
                          cy={y}
                          r="9"
                          fill="#10b981"
                          opacity="0.18"
                        />
                      )}
                      {/* 图标点 */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 4 : 2.4}
                        fill={isSelected ? "#0f766e" : "#ffffff"}
                        stroke={isSelected ? "#0f766e" : "#0f766e"}
                        strokeWidth="1"
                      />
                      {/* 标签气泡 */}
                      {isSelected && (
                        <g>
                          <rect
                            x={x - 22}
                            y={y - 22}
                            width="44"
                            height="14"
                            rx="7"
                            ry="7"
                            fill="#0f172a"
                            opacity="0.92"
                          />
                          <text
                            x={x}
                            y={y - 12}
                            textAnchor="middle"
                            fontSize="5"
                            fill="#ffffff"
                            fontFamily="monospace"
                          >
                            {poi.name}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* 北箭头 */}
                <g transform="translate(106,12)">
                  <path
                    d="M0,0 L -3.2,-6 L 0,-9 L 3.2,-6 Z"
                    fill="#334155"
                  />
                  <text
                    x="0"
                    y="12"
                    textAnchor="middle"
                    fontSize="4"
                    fill="#334155"
                    fontFamily="monospace"
                  >
                    N
                  </text>
                </g>
              </svg>
            )}

            {/* 悬停焦点提示 */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-background/80 border border-border/50 text-[10px] text-muted-foreground flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-emerald-500" />
              <span>{activePoi.name} · {activePoi.distance}</span>
            </div>
          </div>
        </div>

        {/* POI 列表与详情 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2">
          {/* POI 切换列表 */}
          <div className="space-y-1.5">
            {data.pois.map((poi, idx) => (
              <button
                key={poi.id}
                onClick={() => handlePoiSelect(idx)}
                className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2 border ${
                  selectedPoiIdx === idx
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "bg-background/60 hover:bg-background border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getCategoryIcon(poi.category)}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">
                      {poi.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {poi.address}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-bold text-amber-500 flex items-center gap-0.5 justify-end">
                    <Star className="w-3 h-3 fill-amber-500" />
                    <span>{poi.rating}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {poi.distance}
                  </div>
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
                    <h3 className="text-sm font-bold text-foreground">
                      {activePoi.name}
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {activePoi.distance}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {activePoi.address}
                  </div>
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
                <Clock className="w-3 h-3 text-emerald-500" />
                营业: {activePoi.openingHours}
              </span>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activePoi.name + " " + activePoi.address)}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5"
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
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
          周边精准定位
        </span>
      </div>
    </WidgetContainer>
  );
};
