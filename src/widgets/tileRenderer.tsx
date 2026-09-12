import React from "react";
import { TileSchemaDescriptor, TileAtomNode, WidgetContext } from "./sdk/types.js";
import { 
  Sun, 
  Cloud, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Zap, 
  Sparkles, 
  Play, 
  Compass, 
  CheckCircle2, 
  Cpu, 
  FileText,
  ExternalLink,
  ArrowRight
} from "lucide-react";

interface TileRendererProps {
  descriptor: TileSchemaDescriptor;
  context: WidgetContext;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  cloud: Cloud,
  trend_up: TrendingUp,
  trend_down: TrendingDown,
  activity: Activity,
  zap: Zap,
  sparkles: Sparkles,
  play: Play,
  compass: Compass,
  check: CheckCircle2,
  cpu: Cpu,
  file: FileText
};

export const TileAtomRenderer: React.FC<TileRendererProps> = ({ descriptor, context }) => {
  const isCompact = context.isCompact || context.size === "small";

  return (
    <div 
      className="w-full h-full flex flex-col justify-between p-4 rounded-3xl relative overflow-hidden text-zinc-900 dark:text-zinc-100 select-none"
      style={{
        background: descriptor.background || undefined
      }}
    >
      {/* 头部标题与徽标 */}
      {(descriptor.title || descriptor.liveBadge) && (
        <div className="flex items-center justify-between gap-2 mb-2 w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            {descriptor.title && (
              <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {descriptor.title}
              </h4>
            )}
            {descriptor.subtitle && !isCompact && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                · {descriptor.subtitle}
              </span>
            )}
          </div>
          {descriptor.liveBadge !== undefined && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              {descriptor.liveBadge}
            </span>
          )}
        </div>
      )}

      {/* 原子节点列表 */}
      <div className="flex-1 flex flex-col justify-around gap-2 w-full">
        {descriptor.children?.map((node, idx) => (
          <AtomNodeItem key={idx} node={node} context={context} isCompact={isCompact} />
        ))}
      </div>
    </div>
  );
};

const AtomNodeItem: React.FC<{ node: TileAtomNode; context: WidgetContext; isCompact: boolean }> = ({
  node,
  context,
  isCompact
}) => {
  switch (node.type) {
    case "text": {
      if (node.variant === "metric") {
        return (
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {node.value}
          </div>
        );
      }
      if (node.variant === "title") {
        return (
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {node.value}
          </div>
        );
      }
      if (node.variant === "badge") {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 w-fit">
            {node.value}
          </span>
        );
      }
      return (
        <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {node.value}
        </div>
      );
    }

    case "icon": {
      const IconComponent = ICON_MAP[node.value.toLowerCase()] || Sparkles;
      return (
        <div className="p-2 rounded-2xl bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 w-fit shadow-2xs">
          <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
      );
    }

    case "metric": {
      const isPositive = node.trend && node.trend.startsWith("+");
      return (
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {node.label}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 flex items-baseline gap-1">
              <span>{node.value}</span>
              {node.unit && <span className="text-xs font-normal text-zinc-400">{node.unit}</span>}
            </div>
          </div>
          {node.trend && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                isPositive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              }`}
            >
              {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              <span>{node.trend}</span>
            </span>
          )}
        </div>
      );
    }

    case "progress": {
      const max = node.max || 100;
      const pct = Math.min(100, Math.max(0, Math.round((node.value / max) * 100)));
      return (
        <div className="space-y-1 w-full">
          {node.label && (
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>{node.label}</span>
              <span className="font-semibold">{pct}%</span>
            </div>
          )}
          <div className="w-full h-2 rounded-full bg-zinc-200/70 dark:bg-zinc-700/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    }

    case "chart": {
      // 简易 Mini Sparkline SVG 图表
      const data = node.data || [];
      if (data.length < 2) return null;
      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;
      const width = 180;
      const height = 40;
      const points = data
        .map((val, idx) => {
          const x = (idx / (data.length - 1)) * width;
          const y = height - ((val - min) / range) * (height - 8) - 4;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

      return (
        <div className="w-full py-1">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10 overflow-visible">
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      );
    }

    case "button": {
      return (
        <button
          onClick={() => {
            if (node.action && context.actions[node.action]) {
              context.actions[node.action](node.payload);
            }
          }}
          className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
        >
          <span>{node.label}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    case "list": {
      return (
        <div className="space-y-1.5 w-full">
          {node.items.slice(0, isCompact ? 2 : 4).map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (item.url && context.openUrl) {
                  context.openUrl(item.url);
                } else if (item.action && context.actions[item.action]) {
                  context.actions[item.action](item.payload);
                }
              }}
              className="flex items-center justify-between p-1.5 rounded-xl hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-xs"
            >
              <div className="min-w-0 pr-2">
                <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.title}</div>
                {item.subtitle && (
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{item.subtitle}</div>
                )}
              </div>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shrink-0">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }

    case "image": {
      return (
        <div className="w-full h-full rounded-2xl overflow-hidden relative shadow-inner">
          <img
            src={node.url}
            alt={node.alt || "Tile background"}
            className="w-full h-full object-cover"
          />
          {node.overlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          )}
        </div>
      );
    }

    default:
      return null;
  }
};
