import React from "react";
import { TileSchemaDescriptor, TileAtomNode, WidgetContext } from "./sdk/types.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { Progress } from "../components/ui/progress.js";
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
      className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl bg-card p-4 text-card-foreground select-none ring-1 ring-foreground/10"
      style={{
        background: descriptor.background || undefined
      }}
    >
      {/* 头部标题与徽标 */}
      {(descriptor.title || descriptor.liveBadge) && (
        <div className="mb-2 flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {descriptor.title && (
              <h4 className="truncate text-xs font-semibold text-foreground">
                {descriptor.title}
              </h4>
            )}
            {descriptor.subtitle && !isCompact && (
              <span className="truncate text-xs text-muted-foreground">
                · {descriptor.subtitle}
              </span>
            )}
          </div>
          {descriptor.liveBadge !== undefined && (
            <Badge variant="secondary" className="shrink-0">
              {descriptor.liveBadge}
            </Badge>
          )}
        </div>
      )}

      {/* 原子节点列表 */}
      <div className="flex w-full flex-1 flex-col justify-around gap-2">
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
          <div className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {node.value}
          </div>
        );
      }
      if (node.variant === "title") {
        return (
          <div className="text-sm font-semibold text-foreground">
            {node.value}
          </div>
        );
      }
      if (node.variant === "badge") {
        return (
          <Badge variant="secondary" className="w-fit">
            {node.value}
          </Badge>
        );
      }
      return (
        <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {node.value}
        </div>
      );
    }

    case "icon": {
      const IconComponent = ICON_MAP[node.value.toLowerCase()] || Sparkles;
      return (
        <div className="w-fit rounded-lg border border-border bg-muted p-2">
          <IconComponent className="size-5 text-foreground" />
        </div>
      );
    }

    case "metric": {
      const isPositive = node.trend && node.trend.startsWith("+");
      return (
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {node.label}
            </div>
            <div className="flex items-baseline gap-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              <span>{node.value}</span>
              {node.unit && <span className="text-xs font-normal text-muted-foreground">{node.unit}</span>}
            </div>
          </div>
          {node.trend && (
            <Badge variant={isPositive ? "default" : "secondary"} className="gap-0.5">
              {isPositive ? <TrendingUp /> : <TrendingDown />}
              <span>{node.trend}</span>
            </Badge>
          )}
        </div>
      );
    }

    case "progress": {
      const max = node.max || 100;
      const pct = Math.min(100, Math.max(0, Math.round((node.value / max) * 100)));
      return (
        <div className="w-full space-y-1">
          {node.label && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{node.label}</span>
              <span className="font-medium tabular-nums">{pct}%</span>
            </div>
          )}
          <Progress value={pct} />
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
          <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full overflow-visible">
            <polyline
              fill="none"
              className="stroke-foreground/60"
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
        <Button
          onClick={() => {
            if (node.action && context.actions[node.action]) {
              context.actions[node.action](node.payload);
            }
          }}
          className="w-full"
        >
          <span>{node.label}</span>
          <ArrowRight />
        </Button>
      );
    }

    case "list": {
      return (
        <div className="w-full space-y-1">
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
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <div className="min-w-0 pr-2">
                <div className="truncate font-medium text-foreground">{item.title}</div>
                {item.subtitle && (
                  <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                )}
              </div>
              {item.badge && (
                <Badge variant="secondary" className="shrink-0">
                  {item.badge}
                </Badge>
              )}
            </div>
          ))}
        </div>
      );
    }

    case "image": {
      return (
        <div className="relative h-full w-full overflow-hidden rounded-lg">
          <img
            src={node.url}
            alt={node.alt || "Tile background"}
            className="h-full w-full object-cover"
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
