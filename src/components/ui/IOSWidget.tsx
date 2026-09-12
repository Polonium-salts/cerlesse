import React from "react";
import { cn } from "../../lib/utils.js";
import { WidgetPlannedSize } from "../../types.js";

interface IOSWidgetProps {
  id?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  size?: WidgetPlannedSize;
  onResize?: (size: WidgetPlannedSize) => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
  noPadding?: boolean;
  onClick?: () => void;
}

export const IOSWidget: React.FC<IOSWidgetProps> = ({
  id,
  title,
  subtitle,
  icon,
  badge,
  actions,
  size,
  onResize,
  className,
  headerClassName,
  contentClassName,
  children,
  noPadding = false,
  onClick
}) => {
  const hasHeader = Boolean(title || icon || badge || actions || onResize);
  const isSmall = size === "small";

  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-[22px] bg-white/95 dark:bg-[#161619]/95 backdrop-blur-md text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-all duration-200 overflow-hidden",
        onClick && "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-2.5 sm:pb-3 border-b border-zinc-100 dark:border-zinc-800/60",
            isSmall && "px-3.5 pt-3.5 pb-2",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {icon && (
              <div className={cn(
                "rounded-xl bg-zinc-100 dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs",
                isSmall ? "w-7 h-7 text-xs" : "w-8 h-8"
              )}>
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {title && (
                  <h3 className={cn(
                    "font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate",
                    isSmall ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                  )}>
                    {title}
                  </h3>
                )}
                {badge}
              </div>
              {subtitle && !isSmall && (
                <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pl-1">
            {/* iOS/Android Widget Size Switcher Pill */}
            {onResize && (
              <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/60 dark:border-zinc-700/60 text-zinc-400">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResize("small"); }}
                  title="2x2 方块 (小号)"
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer",
                    size === "small" 
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-bold" 
                      : "hover:text-zinc-700 dark:hover:text-zinc-200"
                  )}
                >
                  2x2
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResize("medium"); }}
                  title="4x2 横条 (中号)"
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer",
                    size === "medium" 
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-bold" 
                      : "hover:text-zinc-700 dark:hover:text-zinc-200"
                  )}
                >
                  4x2
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResize("large"); }}
                  title="4x4 大方块 (大号)"
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer",
                    size === "large" 
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-bold" 
                      : "hover:text-zinc-700 dark:hover:text-zinc-200"
                  )}
                >
                  4x4
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResize("full"); }}
                  title="4x8 全宽横幅"
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer",
                    size === "full" 
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-bold" 
                      : "hover:text-zinc-700 dark:hover:text-zinc-200"
                  )}
                >
                  全宽
                </button>
              </div>
            )}

            {actions}
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex-1 flex flex-col",
          !noPadding && (isSmall ? "p-3.5 sm:p-4" : "p-4 sm:p-6"),
          hasHeader && !noPadding && (isSmall ? "pt-2.5 sm:pt-3" : "pt-3.5 sm:pt-4"),
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
};
