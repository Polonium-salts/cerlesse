import React from "react";
import { cn } from "../../lib/utils.js";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900",
    secondary: "border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200",
    outline: "text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800",
    success: "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    warning: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    destructive: "border-transparent bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
