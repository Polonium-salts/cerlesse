import React from "react";
import { cn } from "../../lib/utils.js";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";
    
    const variants = {
      default: "bg-zinc-100 text-zinc-900 shadow hover:bg-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
      secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
      outline: "border border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100",
      ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100",
      destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
      link: "text-zinc-900 dark:text-zinc-100 underline-offset-4 hover:underline"
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-lg px-6 text-base",
      icon: "h-9 w-9"
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
