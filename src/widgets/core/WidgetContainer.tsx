import React from "react";
import type { TileWidth } from "../../lib/tileLayoutEngine.js";
import { Loader2, AlertCircle, Inbox } from "lucide-react";

export type WidgetPaddingMode = "none" | "compact" | "normal" | "spacious";
export type WidgetSkeletonType = "card" | "list" | "text" | "chart";

export interface WidgetContainerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  id?: string;
  widgetId?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  size?: TileWidth;
  isCompact?: boolean;
  hideHeader?: boolean;
  noPadding?: boolean;
  padding?: WidgetPaddingMode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  surfaceClassName?: string;
  isLoading?: boolean;
  skeletonType?: WidgetSkeletonType;
  error?: Error | string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  border?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

const PADDING_CLASSES: Record<WidgetPaddingMode, string> = {
  none: "p-0",
  compact: "p-2.5",
  normal: "p-4",
  spacious: "p-6"
};

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  id,
  widgetId,
  title,
  subtitle,
  icon,
  badge,
  actions,
  size,
  isCompact = false,
  hideHeader = false,
  noPadding = false,
  padding,
  className = "",
  headerClassName = "",
  contentClassName = "",
  surfaceClassName = "",
  isLoading = false,
  skeletonType = "card",
  error = null,
  isEmpty = false,
  emptyMessage = "暂无数据",
  border = true,
  onClick,
  children,
  ...rest
}) => {
  const effectivePadding: WidgetPaddingMode = noPadding
    ? "none"
    : padding || (isCompact ? "compact" : "normal");

  const hasHeader = !hideHeader && Boolean(title || icon || badge || actions);

  return (
    <div
      id={id || widgetId}
      data-widget-id={widgetId || id}
      onClick={onClick}
      className={`relative flex flex-col h-full w-full rounded-2xl overflow-hidden bg-card text-card-foreground transition-all duration-200 ${
        border ? "border border-border/60 shadow-xs" : ""
      } ${surfaceClassName} ${className}`}
      {...rest}
    >
      {hasHeader && (
        <div
          className={`flex items-center justify-between gap-2 border-b border-border/40 select-none ${
            isCompact ? "px-3 py-2" : "px-4 py-3"
          } ${headerClassName}`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {icon && <div className="shrink-0 flex items-center">{icon}</div>}
            <div className="min-w-0 flex-1">
              {title && (
                <h3
                  className={`font-medium tracking-tight truncate ${
                    isCompact ? "text-xs" : "text-sm"
                  }`}
                >
                  {title}
                </h3>
              )}
              {subtitle && !isCompact && (
                <p className="text-[11px] text-muted-foreground truncate leading-tight">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {(badge || actions) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {badge}
              {actions}
            </div>
          )}
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto ${
          PADDING_CLASSES[effectivePadding]
        } ${contentClassName}`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2 text-muted-foreground animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-xs">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[120px] p-4 text-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-medium">
              {typeof error === "string" ? error : error.message || "加载失败"}
            </span>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[120px] p-4 text-center gap-2 text-muted-foreground">
            <Inbox className="w-5 h-5 shrink-0 opacity-50" />
            <span className="text-xs">{emptyMessage}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export function withWidgetContainer<P extends object>(
  Component: React.ComponentType<P>,
  containerPropsFactory?: (props: P) => Partial<WidgetContainerProps>
): React.FC<P & Partial<WidgetContainerProps>> {
  return function WrappedWidget(props: P & Partial<WidgetContainerProps>) {
    const computedProps = containerPropsFactory ? containerPropsFactory(props) : {};
    return (
      <WidgetContainer {...computedProps} {...props}>
        <Component {...props} />
      </WidgetContainer>
    );
  };
}
