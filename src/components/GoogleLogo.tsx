import React from "react";

interface GoogleLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
  badgeText?: string;
}

export const GoogleLogo: React.FC<GoogleLogoProps> = ({
  size = "md",
  className = "",
  showBadge = true,
  badgeText = "Agent"
}) => {
  const iconSizeClasses = {
    sm: "w-7 h-7 rounded-lg",
    md: "w-9 h-9 rounded-xl",
    lg: "w-12 h-12 rounded-2xl",
    xl: "w-16 h-16 sm:w-20 sm:h-20 rounded-3xl"
  };

  const textClasses = {
    sm: "text-lg font-bold tracking-tight",
    md: "text-xl sm:text-2xl font-bold tracking-tight",
    lg: "text-3xl sm:text-4xl font-bold tracking-tight",
    xl: "text-4xl sm:text-5xl font-extrabold tracking-tight"
  };

  const badgeSizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-0.5",
    lg: "text-xs px-3 py-1",
    xl: "text-sm px-3.5 py-1"
  };

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Cerlesse Brand Image Icon */}
      <div
        className={`flex items-center justify-center overflow-hidden border border-zinc-200/60 dark:border-zinc-800/80 shadow-2xs transition-transform duration-200 hover:scale-105 shrink-0 bg-white dark:bg-zinc-900 ${iconSizeClasses[size]}`}
      >
        <img
          src="/logo.png"
          alt="Cerlesse"
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/logo.jpg";
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-zinc-900 dark:text-zinc-100 font-bold tracking-tight ${textClasses[size]}`}>
          Cerlesse
        </span>

        {showBadge && (
          <span
            className={`font-semibold rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 self-center ${badgeSizeClasses[size]}`}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
