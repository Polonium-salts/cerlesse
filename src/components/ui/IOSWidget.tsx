import React from "react";
import { cn } from "../../lib/utils.js";

interface IOSWidgetProps {
  id?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
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
  className,
  headerClassName,
  contentClassName,
  children,
  noPadding = false,
  onClick
}) => {
  const hasHeader = Boolean(title || icon || badge || actions);

  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-[22px] bg-white dark:bg-[#161619] text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-all duration-200 overflow-hidden",
        onClick && "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/60",
            headerClassName
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {title && (
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                    {title}
                  </h3>
                )}
                {badge}
              </div>
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              {actions}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "flex-1 flex flex-col",
          !noPadding && "p-5 sm:p-6",
          hasHeader && !noPadding && "pt-4 sm:pt-5",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
};
