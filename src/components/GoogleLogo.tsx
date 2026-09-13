import React from "react";
import { Badge } from "./ui/badge.js";

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
    md: "w-9 h-9 rounded-lg",
    lg: "w-12 h-12 rounded-xl",
    xl: "w-16 h-16 sm:w-20 sm:h-20 rounded-xl"
  };

  const textClasses = {
    sm: "text-lg font-medium tracking-tight",
    md: "text-xl sm:text-2xl font-medium tracking-tight",
    lg: "text-3xl sm:text-4xl font-medium tracking-tight",
    xl: "text-4xl sm:text-5xl font-medium tracking-tight"
  };

  const badgeTextClasses = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-xs",
    xl: "text-sm"
  };

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* 品牌位图（彩色位图资产是单色约束的登记例外之一，见 guard_monochrome.mjs [C]） */}
      <div
        className={`flex items-center justify-center overflow-hidden border border-border bg-card shrink-0 ${iconSizeClasses[size]}`}
      >
        <img
          src="/logo.png"
          alt="Cerlesse"
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            // 兜底也必须是黑白资源：原兜底 /logo.jpg 是彩色位图，已随单色约束移除
            (e.currentTarget as HTMLImageElement).src = "/favicon.png";
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-foreground tracking-tight ${textClasses[size]}`}>
          Cerlesse
        </span>

        {showBadge && (
          <Badge variant="secondary" className={`self-center ${badgeTextClasses[size]}`}>
            {badgeText}
          </Badge>
        )}
      </div>
    </div>
  );
};
